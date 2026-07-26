/**
 * Implementasi protokol STK500v1 (bootloader Optiboot di Arduino Uno) sendiri — awalnya
 * project ini pakai paket npm `stk500`, tapi paket itu punya bug nyata: dua tempat
 * (`verifySignature` & `verifyPage`) menulis `match = Buffer.concat(...)` TANPA
 * `var`/`let`/`const`. Di Node (CJS, mode sloppy) itu cuma bikin variabel global diam-diam
 * dan tetap jalan; begitu di-bundle jadi ES module asli buat browser (selalu strict mode),
 * assignment ke variabel yang belum dideklarasikan itu melempar
 * `ReferenceError: match is not defined` — persis error yang muncul di browser sungguhan.
 * Daripada nambal paket pihak ketiga yang usianya sudah lama, protokolnya (sudah divalidasi
 * lewat test simulasi bootloader) dipindah ke sini supaya sepenuhnya di bawah kendali kita,
 * sekalian dikasih progress per halaman buat tampilan upload gaya IDE.
 */
import type { Stk500Stream } from './webSerialStream';

const STK = {
  GET_SYNC: 0x30,
  SET_DEVICE: 0x42,
  ENTER_PROGMODE: 0x50,
  LOAD_ADDRESS: 0x55,
  PROG_PAGE: 0x64,
  LEAVE_PROGMODE: 0x51,
  READ_SIGN: 0x75,
  READ_PAGE: 0x74,
  EOP: 0x20,
  OK: 0x10,
  INSYNC: 0x14,
  NOSYNC: 0x15,
} as const;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

/** Baca byte satu-satu sampai ketemu INSYNC/NOSYNC (buang noise/sisa banner bootloader di
 * depannya — sama seperti js-stk500v1/lib/receiveData.js), lalu lanjutkan baca sisa respons. */
async function readAlignedResponse(stream: Stk500Stream, expectedLength: number, timeoutMs: number): Promise<Uint8Array> {
  for (;;) {
    const first = await stream.readExact(1, timeoutMs);
    if (first[0] === STK.INSYNC || first[0] === STK.NOSYNC) {
      if (expectedLength <= 1) return first;
      const rest = await stream.readExact(expectedLength - 1, timeoutMs);
      const combined = new Uint8Array(expectedLength);
      combined.set(first, 0);
      combined.set(rest, 1);
      return combined;
    }
    // Byte bukan awal respons yang valid — buang, lanjut cari INSYNC/NOSYNC berikutnya.
  }
}

async function command(
  stream: Stk500Stream,
  cmdBytes: number[],
  expectedLength: number,
  timeoutMs: number,
  expectedResponse?: number[],
): Promise<Uint8Array> {
  await stream.write(new Uint8Array([...cmdBytes, STK.EOP]));
  const data = await readAlignedResponse(stream, expectedLength, timeoutMs);
  if (expectedResponse && !bytesEqual(data, new Uint8Array(expectedResponse))) {
    throw new Error(`Board membalas tidak sesuai untuk perintah 0x${cmdBytes[0].toString(16)}: ${toHex(data)}`);
  }
  return data;
}

async function sync(stream: Stk500Stream, timeoutMs: number): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await command(stream, [STK.GET_SYNC], 2, timeoutMs, [STK.INSYNC, STK.OK]);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Sinkronisasi ke bootloader gagal.');
}

async function verifySignature(stream: Stk500Stream, signature: number[], timeoutMs: number): Promise<void> {
  await command(stream, [STK.READ_SIGN], 1 + signature.length + 1, timeoutMs, [STK.INSYNC, ...signature, STK.OK]);
}

async function setDevice(stream: Stk500Stream, timeoutMs: number): Promise<void> {
  // 20 parameter SET_DEVICE (page size, polling, dst.) — Optiboot pada praktiknya tidak
  // peduli detail ini, jadi cukup dikirim nol semua (sama seperti contoh resmi js-stk500v1).
  await command(stream, [STK.SET_DEVICE, ...new Array(20).fill(0)], 2, timeoutMs, [STK.INSYNC, STK.OK]);
}

async function enterProgrammingMode(stream: Stk500Stream, timeoutMs: number): Promise<void> {
  await command(stream, [STK.ENTER_PROGMODE], 2, timeoutMs, [STK.INSYNC, STK.OK]);
}

async function leaveProgrammingMode(stream: Stk500Stream, timeoutMs: number): Promise<void> {
  await command(stream, [STK.LEAVE_PROGMODE], 2, timeoutMs, [STK.INSYNC, STK.OK]);
}

async function loadAddress(stream: Stk500Stream, wordAddress: number, timeoutMs: number): Promise<void> {
  await command(stream, [STK.LOAD_ADDRESS, wordAddress & 0xff, (wordAddress >> 8) & 0xff], 2, timeoutMs, [
    STK.INSYNC,
    STK.OK,
  ]);
}

async function programPage(stream: Stk500Stream, data: Uint8Array, timeoutMs: number): Promise<void> {
  const lenHigh = (data.length >> 8) & 0xff;
  const lenLow = data.length & 0xff;
  await command(stream, [STK.PROG_PAGE, lenHigh, lenLow, 0x46, ...data], 2, timeoutMs, [STK.INSYNC, STK.OK]);
}

async function verifyPage(stream: Stk500Stream, expected: Uint8Array, timeoutMs: number): Promise<void> {
  const lenHigh = (expected.length >> 8) & 0xff;
  const lenLow = expected.length & 0xff;
  const expectedResponse = [STK.INSYNC, ...expected, STK.OK];
  await command(stream, [STK.READ_PAGE, lenHigh, lenLow, 0x46], expectedResponse.length, timeoutMs, expectedResponse);
}

export interface BootloadOptions {
  /** Signature 3-byte chip target (ATmega328P Uno = [0x1e, 0x95, 0x0f]). */
  signature: number[];
  /** Ukuran halaman flash (byte) — 128 untuk Optiboot di Uno. */
  pageSize: number;
  timeoutMs: number;
  /** Dipanggil tiap satu halaman selesai ditulis/diverifikasi — buat progress bar gaya IDE. */
  onProgress?: (phase: 'write' | 'verify', pageIndex: number, totalPages: number) => void;
}

/** Tulis `hexData` (hasil decode Intel HEX) ke board lewat protokol STK500v1 penuh:
 * sync -> cek signature chip -> set opsi -> masuk mode program -> tulis tiap halaman ->
 * verifikasi tiap halaman -> keluar mode program. */
export async function bootload(stream: Stk500Stream, hexData: Uint8Array, opts: BootloadOptions): Promise<void> {
  const { signature, pageSize, timeoutMs, onProgress } = opts;

  // Sync dikirim 3x berturut-turut (masing-masing dengan retry sendiri) — meniru avrdude,
  // buat "membersihkan" state bootloader dari sisa transmisi sebelumnya.
  await sync(stream, timeoutMs);
  await sync(stream, timeoutMs);
  await sync(stream, timeoutMs);

  await verifySignature(stream, signature, timeoutMs);
  await setDevice(stream, timeoutMs);
  await enterProgrammingMode(stream, timeoutMs);

  const totalPages = Math.max(1, Math.ceil(hexData.length / pageSize));

  let pageIndex = 0;
  for (let addr = 0; addr < hexData.length; addr += pageSize) {
    const chunk = hexData.slice(addr, Math.min(addr + pageSize, hexData.length));
    await loadAddress(stream, addr >> 1, timeoutMs);
    await programPage(stream, chunk, timeoutMs);
    pageIndex++;
    onProgress?.('write', pageIndex, totalPages);
  }

  pageIndex = 0;
  for (let addr = 0; addr < hexData.length; addr += pageSize) {
    const chunk = hexData.slice(addr, Math.min(addr + pageSize, hexData.length));
    await loadAddress(stream, addr >> 1, timeoutMs);
    await verifyPage(stream, chunk, timeoutMs);
    pageIndex++;
    onProgress?.('verify', pageIndex, totalPages);
  }

  await leaveProgrammingMode(stream, timeoutMs);
}
