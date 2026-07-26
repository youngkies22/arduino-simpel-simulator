import './bufferPolyfill';
import { base64ToBytes } from './base64';
import { compileSketch } from './compileClient';
import { bootloadEsp, type EspFlashSegment } from './esptoolProtocol';
import { isWebSerialSupported } from './flashArduino';
import { WebSerialStream } from './webSerialStream';

/** ROM bootloader ESP32/ESP8266 disebut siap kalau chip sudah tersambung dan
 * di-boot ulang ke mode download; kita bicara di baud tetap ini sepanjang sesi
 * (protokol ROM tanpa stub tidak butuh baud-rate switching untuk data sekecil
 * sketch pelajar — lebih sederhana & lebih kompatibel daripada mengganti baud). */
const ESP_BAUD_RATE = 115200;
const ESP_TIMEOUT_MS = 4_000;
/** FLASH_BEGIN mem-erase flash secara blocking di sisi chip sebelum membalas —
 * bisa puluhan detik untuk region beberapa ratus KB, jadi timeout-nya jauh lebih
 * longgar daripada command lain. */
const ESP_ERASE_TIMEOUT_MS = 60_000;

export interface EspUploadCallbacks {
  onLog?: (line: string) => void;
  onProgress?: (progress: { segmentIndex: number; totalSegments: number; blockIndex: number; totalBlocks: number }) => void;
}

/**
 * Alur lengkap upload ke ESP32/ESP8266: minta user pilih port (HARUS dipanggil langsung
 * dari klik tombol, supaya "user activation" browser belum kedaluwarsa) -> compile lewat
 * compile-server -> tulis tiap segmen ke flash lewat ROM bootloader.
 *
 * BEDA dari AVR (`uploadSketchToBoard`): board TIDAK direset otomatis ke mode download —
 * user diminta menekan tombol BOOT/FLASH manual dulu (lihat komentar di esptoolProtocol.ts
 * soal kenapa). Port selalu ditutup lagi di akhir, sukses maupun gagal.
 */
export async function uploadSketchToEspBoard(source: string, fqbn: string, chip: 'esp32' | 'esp8266', callbacks: EspUploadCallbacks = {}): Promise<void> {
  const { onLog, onProgress } = callbacks;
  const log = onLog ?? (() => {});

  if (!isWebSerialSupported()) {
    throw new Error('Browser ini belum mendukung Web Serial API. Pakai Chrome atau Edge di PC/laptop.');
  }

  log('Mengompilasi kode di server...');
  const result = await compileSketch(source, fqbn);
  if (result.log) {
    for (const line of result.log.split('\n')) if (line.trim()) log(line);
  }
  if (!result.ok || result.format !== 'esp-bin' || !result.segments) {
    throw new Error(result.error ?? 'Kompilasi gagal.');
  }
  log('Kompilasi berhasil.');

  const segments: EspFlashSegment[] = result.segments.map((s) => ({ offset: s.offset, data: base64ToBytes(s.dataBase64) }));

  log('Pilih port board di dialog browser...');
  const port = await navigator.serial!.requestPort();
  await port.open({ baudRate: ESP_BAUD_RATE });
  log('Port tersambung.');
  log('Pastikan board sudah di mode download: tekan & tahan tombol BOOT/FLASH, tekan-lepas RST/EN, baru lepas BOOT/FLASH.');

  const stream = new WebSerialStream(port);
  stream.start();

  try {
    await bootloadEsp(stream, segments, {
      chip,
      timeoutMs: ESP_TIMEOUT_MS,
      eraseTimeoutMs: ESP_ERASE_TIMEOUT_MS,
      onLog: log,
      onProgress: (segmentIndex, totalSegments, blockIndex, totalBlocks) => onProgress?.({ segmentIndex, totalSegments, blockIndex, totalBlocks }),
    });
    log('Selesai! Sketch sudah berjalan di board.');
  } finally {
    await stream.stop();
    await port.close().catch(() => {});
  }
}
