import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILTIN_CONSTANTS, BUILTIN_FUNCTIONS, BUILTIN_OBJECTS } from '../arduinoCompletions';

const INTERPRETER_SRC = readFileSync(join(__dirname, '../../interpreter/arduinoInterpreter.ts'), 'utf-8');

/**
 * Autocomplete yang menyarankan fungsi TIDAK ADA lebih berbahaya daripada tidak ada
 * autocomplete sama sekali: siswa menulis kode yang "terlihat benar" lalu gagal saat
 * dijalankan, dan mereka tidak punya cara tahu itu bukan salah mereka. Test ini
 * memastikan tiap saran memang dikenali interpreter.
 */
describe('saran autocomplete hanya berisi yang didukung interpreter', () => {
  it.each(BUILTIN_FUNCTIONS.map((f) => f.label))('fungsi %s ditangani interpreter', (label) => {
    expect(INTERPRETER_SRC).toContain(`case '${label}':`);
  });

  it.each(BUILTIN_CONSTANTS.map((c) => c.label))('konstanta %s didefinisikan interpreter', (label) => {
    expect(INTERPRETER_SRC).toContain(`define('${label}'`);
  });

  it.each(Object.keys(BUILTIN_OBJECTS))('objek %s didefinisikan interpreter', (name) => {
    expect(INTERPRETER_SRC).toContain(`define('${name}'`);
  });

  it('tiap saran punya penjelasan bahasa Indonesia (bukan label kosong)', () => {
    const all = [...BUILTIN_FUNCTIONS, ...BUILTIN_CONSTANTS, ...Object.values(BUILTIN_OBJECTS).flat()];
    for (const entry of all) {
      expect(entry.info.trim(), `info kosong: ${entry.label}`).not.toBe('');
    }
  });

  it('tidak ada label ganda di daftar fungsi', () => {
    const labels = BUILTIN_FUNCTIONS.map((f) => f.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
