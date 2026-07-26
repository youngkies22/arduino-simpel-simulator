import type { Node } from '@xyflow/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_PROJECTS,
  ProjectStorageFullError,
  deleteProject,
  getProject,
  listProjects,
  safeFileName,
  saveProject,
} from '../projectStore';

const NODES: Node[] = [{ id: 'board', type: 'board', position: { x: 0, y: 0 }, data: {} }];

beforeEach(() => {
  localStorage.clear();
});

describe('projectStore', () => {
  it('menyimpan lalu membaca kembali projek beserta rangkaiannya', () => {
    const saved = saveProject('Lampu Lalu Lintas', 'void setup() {}', NODES);

    const loaded = getProject(saved.id);
    expect(loaded?.name).toBe('Lampu Lalu Lintas');
    expect(loaded?.source).toBe('void setup() {}');
    expect(loaded?.nodes).toEqual(NODES);
  });

  it('menimpa projek bernama sama (tanpa peduli huruf besar/kecil), bukan bikin duplikat', () => {
    const first = saveProject('Blink', 'versi 1', NODES);
    const second = saveProject('  blink  ', 'versi 2', NODES);

    expect(listProjects()).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(getProject(first.id)?.source).toBe('versi 2');
  });

  it('menolak nama kosong', () => {
    expect(() => saveProject('   ', 'kode', NODES)).toThrow('Nama projek tidak boleh kosong.');
    expect(listProjects()).toHaveLength(0);
  });

  it(`bisa menampung ${MAX_PROJECTS} projek, lalu menolak yang ke-${MAX_PROJECTS + 1}`, () => {
    for (let i = 1; i <= MAX_PROJECTS; i++) saveProject(`Projek ${i}`, `kode ${i}`, NODES);
    expect(listProjects()).toHaveLength(MAX_PROJECTS);

    expect(() => saveProject('Projek kelebihan', 'kode', NODES)).toThrow(ProjectStorageFullError);
    expect(listProjects()).toHaveLength(MAX_PROJECTS);
  });

  it('tetap boleh menimpa projek lama walau kuota sudah penuh', () => {
    for (let i = 1; i <= MAX_PROJECTS; i++) saveProject(`Projek ${i}`, `kode ${i}`, NODES);

    expect(() => saveProject('Projek 1', 'kode baru', NODES)).not.toThrow();
    expect(listProjects()).toHaveLength(MAX_PROJECTS);
    expect(listProjects().find((p) => p.name === 'Projek 1')?.source).toBe('kode baru');
  });

  it('menghapus projek berdasarkan id', () => {
    const a = saveProject('A', 'kode a', NODES);
    saveProject('B', 'kode b', NODES);

    deleteProject(a.id);

    expect(listProjects().map((p) => p.name)).toEqual(['B']);
  });

  it('mengembalikan daftar kosong kalau data di localStorage rusak', () => {
    localStorage.setItem('arduino-wokwi-clone-projects', '{bukan json valid');
    expect(listProjects()).toEqual([]);
  });
});

describe('safeFileName', () => {
  it('mengubah spasi jadi garis bawah', () => {
    expect(safeFileName('Lampu Lalu Lintas')).toBe('Lampu_Lalu_Lintas');
  });

  it('membuang karakter yang dilarang di nama file', () => {
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij');
  });

  it('memakai "sketch" kalau nama jadi kosong setelah dibersihkan', () => {
    expect(safeFileName('///')).toBe('sketch');
    expect(safeFileName('   ')).toBe('sketch');
  });
});
