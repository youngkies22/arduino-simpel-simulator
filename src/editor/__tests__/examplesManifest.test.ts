import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SKETCH_EXAMPLES } from '../examples';

const EXAMPLES_DIR = join(__dirname, '../../../public/examples');

/** Manifest di examples.ts ditulis tangan (judul & deskripsi bahasa Indonesia tidak bisa
 * diturunkan otomatis dari nama file). Test ini menjaga supaya file yang ditambah/dihapus
 * di public/examples/ tidak diam-diam bikin daftar di UI jadi tidak sinkron. */
describe('manifest contoh sketch', () => {
  const filesOnDisk = readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith('.ino'))
    .sort();

  it('mencantumkan persis semua file .ino yang ada di public/examples', () => {
    expect(SKETCH_EXAMPLES.map((e) => e.file).sort()).toEqual(filesOnDisk);
  });

  it('urut sesuai nomor file supaya jadi urutan materi dari dasar ke kompleks', () => {
    expect(SKETCH_EXAMPLES.map((e) => e.file)).toEqual([...SKETCH_EXAMPLES.map((e) => e.file)].sort());
  });

  it('setiap contoh punya judul dan deskripsi yang terisi', () => {
    for (const example of SKETCH_EXAMPLES) {
      expect(example.title.trim(), `judul kosong: ${example.file}`).not.toBe('');
      expect(example.description.trim(), `deskripsi kosong: ${example.file}`).not.toBe('');
    }
  });
});
