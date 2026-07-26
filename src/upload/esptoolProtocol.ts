/**
 * Implementasi protokol ROM bootloader ESP32/ESP8266 (dipakai `esptool.py` resmi
 * Espressif) sendiri, dari nol — bukan port library. Ini BUKAN protokol STK500 yang
 * dipakai `stk500Protocol.ts` untuk AVR; ESP32/ESP8266 pakai bootloader ROM chip yang
 * bicara SLIP framing lewat serial.
 *
 * Sengaja jalur "ROM loader langsung" (mode `--no-stub` di esptool.py), BUKAN jalur stub
 * loader (esptool.py normalnya meng-upload program kecil dulu ke RAM chip supaya transfer
 * berikutnya lebih cepat). ROM loader jauh lebih sederhana untuk diimplementasikan ulang
 * (tidak perlu menyertakan biner stub per-chip) dengan konsekuensi flashing lebih lambat —
 * dianggap sepadan untuk ukuran sketch pelajar (biasanya di bawah 1MB).
 *
 * PENTING — keterbatasan yang jujur perlu diketahui: kode ini ditulis mengikuti dokumentasi
 * protokol resmi (https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/serial-protocol.html)
 * dan diuji lewat bootloader ROM PALSU (lihat esptoolProtocol.test.ts) — BUKAN board fisik
 * sungguhan, karena lingkungan pengembangan ini tidak punya akses ke ESP32/ESP8266 asli.
 * Uji dulu dengan board fisik sebelum dipakai siswa secara luas.
 *
 * Board TIDAK direset otomatis ke mode download (beda dari AVR yang auto-reset lewat pulsa
 * DTR/RTS) — user diminta menekan tombol BOOT/FLASH secara manual sebelum sync(), karena
 * rangkaian auto-reset beda-beda antar board ESP (NodeMCU vs DevKit vs modul generik) dan
 * SEMUANYA tetap mendukung mode manual, jadi ini pilihan yang paling kompatibel/aman.
 */
import type { Stk500Stream } from './webSerialStream';

export const ESP_CMD = {
  FLASH_BEGIN: 0x02,
  FLASH_DATA: 0x03,
  FLASH_END: 0x04,
  SYNC: 0x08,
  SPI_ATTACH: 0x0d,
} as const;

const SLIP_END = 0xc0;
const SLIP_ESC = 0xdb;
const SLIP_ESC_END = 0xdc;
const SLIP_ESC_ESC = 0xdd;

/** Ukuran blok tulis flash untuk ROM loader (bukan stub) — nilai baku esptool.py. */
export const ESP_FLASH_BLOCK_SIZE = 0x400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slipEncode(payload: Uint8Array): Uint8Array {
  const out: number[] = [SLIP_END];
  for (const b of payload) {
    if (b === SLIP_END) out.push(SLIP_ESC, SLIP_ESC_END);
    else if (b === SLIP_ESC) out.push(SLIP_ESC, SLIP_ESC_ESC);
    else out.push(b);
  }
  out.push(SLIP_END);
  return new Uint8Array(out);
}

/** Checksum sederhana ("seed" 0xEF di-XOR semua byte data) — cuma dipakai untuk
 * payload FLASH_DATA, command lain checksum-nya selalu 0. */
export function espDataChecksum(data: Uint8Array): number {
  let cs = 0xef;
  for (const b of data) cs ^= b;
  return cs;
}

function u32le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function padTo(data: Uint8Array, size: number, fill: number): Uint8Array {
  if (data.length >= size) return data;
  // Padding 0xFF (bukan 0x00) meniru nilai byte flash yang belum ditulis/sudah di-erase —
  // sisa byte "kosong" di blok terakhir jadi tidak berarti apa-apa buat firmware.
  const out = new Uint8Array(size).fill(fill);
  out.set(data);
  return out;
}

/** Membangun header 8-byte + data satu paket perintah (arah 0x00 = host->device),
 * lalu bungkus SLIP — siap dikirim lewat stream.write(). */
export function buildCommandFrame(command: number, data: Uint8Array, checksum = 0): Uint8Array {
  const header = new Uint8Array(8);
  header[0] = 0x00; // direction: request
  header[1] = command;
  header[2] = data.length & 0xff;
  header[3] = (data.length >> 8) & 0xff;
  header.set(u32le(checksum), 4);
  return slipEncode(concatBytes(header, data));
}

/** Baca satu frame SLIP utuh dari stream (byte demi byte lewat readExact(1, ...)):
 * lewati noise sampai ketemu SLIP_END pembuka, kumpulkan (dengan unescape) sampai
 * SLIP_END penutup berikutnya. */
export async function readSlipFrame(stream: Stk500Stream, timeoutMs: number): Promise<Uint8Array> {
  let b = await stream.readExact(1, timeoutMs);
  while (b[0] !== SLIP_END) b = await stream.readExact(1, timeoutMs);

  const out: number[] = [];
  for (;;) {
    const next = await stream.readExact(1, timeoutMs);
    if (next[0] === SLIP_END) {
      if (out.length === 0) continue; // SLIP_END dobel (bingkai kosong) — abaikan, terus baca.
      return new Uint8Array(out);
    }
    if (next[0] === SLIP_ESC) {
      const esc = await stream.readExact(1, timeoutMs);
      out.push(esc[0] === SLIP_ESC_END ? SLIP_END : esc[0] === SLIP_ESC_ESC ? SLIP_ESC : esc[0]);
    } else {
      out.push(next[0]);
    }
  }
}

export interface EspResponse {
  command: number;
  /** Field "value" 4-byte di header — isinya register value untuk READ_REG, 0 untuk command lain. */
  value: number;
  status: number;
  errorCode: number;
}

/** Parse satu frame SLIP yang sudah di-unescape jadi struktur respons ROM loader.
 * 2 byte TERAKHIR dari `data` (bukan seluruh payload) adalah status & kode error —
 * ini konvensi ROM loader (bukan stub loader, yang pakai 4 byte trailer). */
export function parseResponseFrame(frame: Uint8Array): EspResponse {
  if (frame.length < 10) throw new Error(`Frame respons ROM bootloader terlalu pendek (${frame.length} byte).`);
  const command = frame[1];
  const size = frame[2] | (frame[3] << 8);
  const value = (frame[4] | (frame[5] << 8) | (frame[6] << 16) | (frame[7] << 24)) >>> 0;
  const data = frame.slice(8, 8 + size);
  if (data.length < 2) throw new Error('Data respons ROM bootloader kurang dari 2 byte (harusnya minimal status+error).');
  return { command, value, status: data[data.length - 2], errorCode: data[data.length - 1] };
}

async function readResponse(stream: Stk500Stream, timeoutMs: number): Promise<EspResponse> {
  return parseResponseFrame(await readSlipFrame(stream, timeoutMs));
}

async function sendCommand(stream: Stk500Stream, command: number, data: Uint8Array, checksum: number): Promise<void> {
  await stream.write(buildCommandFrame(command, data, checksum));
}

function statusError(action: string, resp: EspResponse): Error {
  return new Error(`ROM bootloader menolak ${action} (status=0x${resp.status.toString(16)}, error=0x${resp.errorCode.toString(16)}).`);
}

const SYNC_PAYLOAD = new Uint8Array([0x07, 0x07, 0x12, 0x20, ...new Array(32).fill(0x55)]);

/**
 * Sinkronisasi ke ROM bootloader. Board HARUS sudah di mode download (tombol
 * BOOT/FLASH ditekan) sebelum ini dipanggil — fungsi ini TIDAK mereset board.
 * ROM bootloader membalas SYNC dengan beberapa frame berturut-turut (bukan cuma
 * satu) — semuanya "dikuras" dengan timeout pendek per frame sampai tidak ada lagi
 * yang datang, meniru esptool.py.
 */
export async function sync(stream: Stk500Stream, timeoutMs: number): Promise<void> {
  // Balasan PERTAMA ditunggu sampai `timeoutMs` penuh (board yang lambat masuk mode
  // download butuh waktu) — balasan susulan (ROM mengirim beberapa sekaligus) cuma
  // dikuras cepat karena kalau memang ada, pasti sudah menumpuk di buffer saat ini.
  const DRAIN_TIMEOUT_MS = 150;
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await sendCommand(stream, ESP_CMD.SYNC, SYNC_PAYLOAD, 0);
      const first = await readResponse(stream, timeoutMs);
      let ok = first.command === ESP_CMD.SYNC && first.status === 0;
      for (let i = 0; i < 7; i++) {
        try {
          const resp = await readResponse(stream, DRAIN_TIMEOUT_MS);
          if (resp.command === ESP_CMD.SYNC && resp.status === 0) ok = true;
        } catch {
          break; // Tidak ada frame lagi dalam jendela waktu pendek -> selesai menguras.
        }
      }
      if (ok) return;
      lastError = new Error('Tidak ada balasan SYNC yang valid.');
    } catch (err) {
      lastError = err;
    }
    await sleep(150);
  }
  throw lastError instanceof Error
    ? new Error(`Sinkronisasi ke board gagal: ${lastError.message}. Pastikan board di mode download (tekan BOOT/FLASH, tekan-lepas RST, baru lepas BOOT/FLASH) lalu coba lagi.`)
    : new Error('Sinkronisasi ke board gagal. Pastikan board di mode download lalu coba lagi.');
}

/** Wajib untuk ESP32 sebelum operasi flash (memberi tahu ROM pin SPI flash yang dipakai —
 * 0 = pakai default board). ESP8266 tidak punya/tidak perlu command ini. */
export async function spiAttach(stream: Stk500Stream, timeoutMs: number): Promise<void> {
  await sendCommand(stream, ESP_CMD.SPI_ATTACH, new Uint8Array(8), 0);
  const resp = await readResponse(stream, timeoutMs);
  if (resp.status !== 0) throw statusError('SPI_ATTACH', resp);
}

async function flashBegin(stream: Stk500Stream, eraseSize: number, numBlocks: number, blockSize: number, offset: number, timeoutMs: number): Promise<void> {
  const data = concatBytes(u32le(eraseSize), u32le(numBlocks), u32le(blockSize), u32le(offset));
  await sendCommand(stream, ESP_CMD.FLASH_BEGIN, data, 0);
  // Erase blocking di sisi chip bisa lama untuk region besar -> timeout longgar (`timeoutMs`
  // di sini SENGAJA beda/lebih besar dari command lain, lihat pemanggil `bootloadEsp`).
  const resp = await readResponse(stream, timeoutMs);
  if (resp.status !== 0) throw statusError('FLASH_BEGIN (erase)', resp);
}

async function flashDataBlock(stream: Stk500Stream, chunk: Uint8Array, sequence: number, timeoutMs: number): Promise<void> {
  const data = concatBytes(u32le(chunk.length), u32le(sequence), u32le(0), u32le(0), chunk);
  await sendCommand(stream, ESP_CMD.FLASH_DATA, data, espDataChecksum(chunk));
  const resp = await readResponse(stream, timeoutMs);
  if (resp.status !== 0) throw statusError(`FLASH_DATA (blok ${sequence})`, resp);
}

async function flashEnd(stream: Stk500Stream, reboot: boolean, timeoutMs: number): Promise<void> {
  await sendCommand(stream, ESP_CMD.FLASH_END, u32le(reboot ? 0 : 1), 0);
  const resp = await readResponse(stream, timeoutMs);
  if (resp.status !== 0) throw statusError('FLASH_END', resp);
}

export interface EspFlashSegment {
  offset: number;
  data: Uint8Array;
}

export interface EspBootloadOptions {
  chip: 'esp32' | 'esp8266';
  /** Timeout untuk SYNC/SPI_ATTACH/FLASH_DATA/FLASH_END — operasi cepat. */
  timeoutMs: number;
  /** Timeout khusus FLASH_BEGIN — chip meng-erase flash secara blocking sebelum
   * membalas, bisa puluhan detik untuk region besar. */
  eraseTimeoutMs: number;
  onProgress?: (segmentIndex: number, totalSegments: number, blockIndex: number, totalBlocks: number) => void;
  onLog?: (line: string) => void;
}

/**
 * Tulis semua segmen ke flash lewat ROM bootloader: sync -> (SPI_ATTACH khusus esp32) ->
 * per segmen: FLASH_BEGIN (erase) -> FLASH_DATA per blok 1KB -> FLASH_END. Segmen TERAKHIR
 * dikasih flag reboot supaya board langsung menjalankan firmware baru begitu selesai.
 */
export async function bootloadEsp(stream: Stk500Stream, segments: EspFlashSegment[], opts: EspBootloadOptions): Promise<void> {
  const { chip, timeoutMs, eraseTimeoutMs, onProgress, onLog } = opts;

  onLog?.('Sinkronisasi ke ROM bootloader...');
  await sync(stream, timeoutMs);
  onLog?.('Tersambung ke bootloader.');

  if (chip === 'esp32') {
    await spiAttach(stream, timeoutMs);
  }

  for (let s = 0; s < segments.length; s++) {
    const { offset, data } = segments[s];
    const numBlocks = Math.max(1, Math.ceil(data.length / ESP_FLASH_BLOCK_SIZE));
    onLog?.(`Menulis ${data.length} byte ke 0x${offset.toString(16)} (${numBlocks} blok)...`);

    await flashBegin(stream, data.length, numBlocks, ESP_FLASH_BLOCK_SIZE, offset, eraseTimeoutMs);

    for (let b = 0; b < numBlocks; b++) {
      const start = b * ESP_FLASH_BLOCK_SIZE;
      const raw = data.slice(start, start + ESP_FLASH_BLOCK_SIZE);
      const chunk = padTo(raw, ESP_FLASH_BLOCK_SIZE, 0xff);
      await flashDataBlock(stream, chunk, b, timeoutMs);
      onProgress?.(s, segments.length, b + 1, numBlocks);
    }

    const isLastSegment = s === segments.length - 1;
    await flashEnd(stream, isLastSegment, timeoutMs);
  }

  onLog?.('Flash selesai — board akan restart menjalankan sketch baru.');
}
