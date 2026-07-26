import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompileResult } from '../compileClient';
import { downloadCompileResult, flashInstructionsFor } from '../downloadCompiled';

// jsdom belum implement URL.createObjectURL/revokeObjectURL — di-stub supaya
// downloadCompileResult() bisa diuji tanpa benar-benar men-download apa pun.
let clickedNames: string[] = [];

beforeEach(() => {
  clickedNames = [];
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  const originalClick = HTMLAnchorElement.prototype.click;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clickedNames.push(this.download);
  });
  return () => {
    HTMLAnchorElement.prototype.click = originalClick;
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

const HEX_RESULT: CompileResult = { ok: true, format: 'hex', hex: ':1000...', log: 'sukses' };

const ESP32_RESULT: CompileResult = {
  ok: true,
  format: 'esp-bin',
  segments: [
    { offset: 0x1000, dataBase64: btoa('bootloader-bytes') },
    { offset: 0x8000, dataBase64: btoa('partitions-bytes') },
    { offset: 0x10000, dataBase64: btoa('app-bytes') },
  ],
};

const ESP8266_RESULT: CompileResult = {
  ok: true,
  format: 'esp-bin',
  segments: [{ offset: 0x0, dataBase64: btoa('app-bytes') }],
};

describe('downloadCompileResult', () => {
  it('mengunduh satu file .hex untuk format AVR', () => {
    downloadCompileResult('Sketch Saya', HEX_RESULT);
    expect(clickedNames).toEqual(['Sketch_Saya.hex']);
  });

  it('mengunduh 3 file terpisah untuk ESP32, nama mengandung peran + offset', () => {
    downloadCompileResult('ESP32 Dev Module', ESP32_RESULT);
    expect(clickedNames).toEqual([
      'ESP32_Dev_Module_bootloader_0x1000.bin',
      'ESP32_Dev_Module_partitions_0x8000.bin',
      'ESP32_Dev_Module_app_0x10000.bin',
    ]);
  });

  it('mengunduh 1 file untuk ESP8266 tanpa embel-embel peran', () => {
    downloadCompileResult('ESP8266 (NodeMCU 1.0)', ESP8266_RESULT);
    expect(clickedNames).toEqual(['ESP8266_(NodeMCU_1.0)_0x0.bin']);
  });

  it('melempar error kalau compile gagal (ok: false)', () => {
    expect(() => downloadCompileResult('x', { ok: false, error: 'Kompilasi gagal.' })).toThrow('Kompilasi gagal.');
    expect(clickedNames).toEqual([]);
  });

  it('melempar error kalau format esp-bin tapi segments kosong', () => {
    expect(() => downloadCompileResult('x', { ok: true, format: 'esp-bin', segments: [] })).toThrow();
  });

  it('melempar error kalau format hex tapi field hex tidak ada', () => {
    expect(() => downloadCompileResult('x', { ok: true, format: 'hex' })).toThrow();
  });
});

describe('flashInstructionsFor', () => {
  it('null untuk format hex (AVR pakai Web Serial, bukan esptool)', () => {
    expect(flashInstructionsFor(HEX_RESULT, 'esp32')).toBeNull();
  });

  it('mencantumkan semua offset segmen untuk esp32', () => {
    const cmd = flashInstructionsFor(ESP32_RESULT, 'esp32');
    expect(cmd).toBe('esptool.py --chip esp32 write_flash 0x1000 <file_0x1000.bin> 0x8000 <file_0x8000.bin> 0x10000 <file_0x10000.bin>');
  });

  it('satu offset untuk esp8266', () => {
    expect(flashInstructionsFor(ESP8266_RESULT, 'esp8266')).toBe('esptool.py --chip esp8266 write_flash 0x0 <file_0x0.bin>');
  });
});
