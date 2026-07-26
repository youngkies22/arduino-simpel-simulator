import { safeFileName } from '../projects/projectStore';
import { base64ToBytes } from './base64';
import type { CompiledSegment, CompileResult } from './compileClient';

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Nama file per segmen: alamat flash-nya ikut di nama supaya jelas cara pakainya
 * dengan esptool/NodeMCU-PyFlasher tanpa perlu baca dokumentasi terpisah, misal
 * `sketch_0x1000_bootloader.bin`. */
function segmentFileName(baseName: string, segment: CompiledSegment, index: number, total: number): string {
  const offsetHex = `0x${segment.offset.toString(16)}`;
  // Nama peran cuma buat 3-segmen ESP32 (bootloader/partitions/app) yang urutannya
  // TETAP mengikuti server.js — untuk 1-segmen (ESP8266) tidak perlu embel-embel.
  const roleNames = ['bootloader', 'partitions', 'app'];
  const role = total > 1 ? `_${roleNames[index] ?? `segment${index}`}` : '';
  return `${baseName}${role}_${offsetHex}.bin`;
}

/**
 * Mengunduh hasil compile sesuai formatnya:
 * - 'hex' (AVR): satu file .hex teks Intel HEX.
 * - 'esp-bin' (ESP32/ESP8266): satu file .bin per segmen, alamat flash-nya ada di nama
 *   file. Sengaja TIDAK digabung jadi satu image (rawan salah padding) — instruksi flash
 *   per-segmen ditampilkan di UI pemanggil.
 *
 * @throws Error kalau `result.ok` false atau field yang dibutuhkan formatnya tidak ada.
 */
export function downloadCompileResult(name: string, result: CompileResult): void {
  if (!result.ok) throw new Error(result.error ?? 'Kompilasi gagal.');

  const baseName = safeFileName(name);

  if (result.format === 'hex') {
    if (!result.hex) throw new Error('Respons server tidak berisi file .hex.');
    triggerDownload(`${baseName}.hex`, new Blob([result.hex], { type: 'text/plain;charset=utf-8' }));
    return;
  }

  if (result.format === 'esp-bin') {
    if (!result.segments || result.segments.length === 0) throw new Error('Respons server tidak berisi data biner.');
    result.segments.forEach((segment, i) => {
      const bytes = base64ToBytes(segment.dataBase64);
      triggerDownload(segmentFileName(baseName, segment, i, result.segments!.length), new Blob([bytes], { type: 'application/octet-stream' }));
    });
    return;
  }

  throw new Error(`Format hasil compile tidak dikenal: ${String(result.format)}`);
}

/** Instruksi flash manual yang ditampilkan setelah unduhan — beda board beda alat.
 * esptool.py dipilih sebagai contoh karena resmi dari Espressif & lintas platform (PC). */
export function flashInstructionsFor(result: CompileResult, chip: 'esp32' | 'esp8266'): string | null {
  if (result.format !== 'esp-bin' || !result.segments) return null;
  const flags = result.segments.map((s) => `0x${s.offset.toString(16)} <file_0x${s.offset.toString(16)}.bin>`).join(' ');
  return `esptool.py --chip ${chip} write_flash ${flags}`;
}
