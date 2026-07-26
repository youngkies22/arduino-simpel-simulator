import './bufferPolyfill';
import { parse as parseIntelHex } from 'intel-hex';
import { compileSketch } from './compileClient';
import { bootload } from './stk500Protocol';
import { WebSerialStream } from './webSerialStream';

/** Signature ATmega328P (chip di Arduino Uno) — dicek sebelum menulis flash. */
const UNO_SIGNATURE = [0x1e, 0x95, 0x0f];
/** Ukuran halaman flash Optiboot (byte) di Uno. */
const UNO_PAGE_SIZE = 128;
const STK500_TIMEOUT_MS = 400;
const UNO_BAUD_RATE = 115200;

export type UploadProgress = { phase: 'write' | 'verify'; pageIndex: number; totalPages: number };

export interface UploadCallbacks {
  onLog?: (line: string) => void;
  onProgress?: (progress: UploadProgress) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.serial !== 'undefined';
}

/** Pulsa DTR/RTS supaya bootloader Optiboot di board Uno aktif (auto-reset khas board
 * berbasis USB-serial) — sengaja naik-turun-naik supaya ada transisi apapun kondisi awalnya. */
async function pulseAutoReset(port: SerialPort): Promise<void> {
  await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  await sleep(50);
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await sleep(50);
  await port.setSignals({ dataTerminalReady: true, requestToSend: true });
  await sleep(50);
}

/** Tulis file .hex (teks Intel HEX) ke board yang sudah tersambung di `port` (harus sudah `open()`). */
export async function flashHexToPort(port: SerialPort, hexText: string, callbacks: UploadCallbacks = {}): Promise<void> {
  const { onLog, onProgress } = callbacks;
  const log = onLog ?? (() => {});
  const parsed = parseIntelHex(hexText);

  log('Mereset board ke mode bootloader...');
  await pulseAutoReset(port);

  const stream = new WebSerialStream(port);
  stream.start();

  try {
    log(`Menulis ${parsed.data.length} byte ke board (jangan cabut kabel)...`);
    await bootload(stream, parsed.data, {
      signature: UNO_SIGNATURE,
      pageSize: UNO_PAGE_SIZE,
      timeoutMs: STK500_TIMEOUT_MS,
      onProgress: (phase, pageIndex, totalPages) => {
        onProgress?.({ phase, pageIndex, totalPages });
        if (pageIndex === totalPages) {
          log(phase === 'write' ? 'Menulis selesai, memverifikasi...' : 'Verifikasi selesai.');
        }
      },
    });
  } finally {
    await stream.stop();
  }
}

/**
 * Alur lengkap: minta user pilih port (HARUS dipanggil langsung dari klik tombol, supaya
 * "user activation" browser belum kedaluwarsa) -> compile kode di server -> flash .hex ke
 * board. Port selalu ditutup lagi di akhir, sukses maupun gagal.
 */
export async function uploadSketchToBoard(source: string, callbacks: UploadCallbacks = {}): Promise<void> {
  const { onLog } = callbacks;
  const log = onLog ?? (() => {});

  if (!isWebSerialSupported()) {
    throw new Error('Browser ini belum mendukung Web Serial API. Pakai Chrome atau Edge di PC/laptop.');
  }

  log('Pilih port Arduino di dialog browser...');
  const port = await navigator.serial!.requestPort();
  await port.open({ baudRate: UNO_BAUD_RATE });
  log('Port tersambung.');

  try {
    log('Mengompilasi kode di server...');
    const result = await compileSketch(source);
    if (result.log) {
      for (const line of result.log.split('\n')) if (line.trim()) log(line);
    }
    if (!result.ok || !result.hex) {
      throw new Error(result.error ?? 'Kompilasi gagal.');
    }
    log('Kompilasi berhasil.');

    await flashHexToPort(port, result.hex, callbacks);
    log('Selesai! Sketch sudah berjalan di board.');
  } finally {
    await port.close().catch(() => {});
  }
}
