import type { Node } from '@xyflow/react';

/**
 * Batas jumlah projek yang boleh disimpan di browser. localStorage biasanya ~5MB dan satu
 * projek cuma beberapa KB (kode + posisi node), jadi 20 masih sangat aman — batasnya ada
 * supaya siswa tidak menumpuk projek tanpa sadar sampai kuota browser penuh, bukan karena
 * ukurannya mepet.
 */
export const MAX_PROJECTS = 20;

const STORAGE_KEY = 'arduino-wokwi-clone-projects';

/** Satu projek tersimpan: kode DAN rangkaian kanvas, supaya dibuka lagi persis seperti
 * saat ditinggalkan (bukan cuma kodenya). */
export interface SavedProject {
  id: string;
  name: string;
  source: string;
  /** Node React Flow (papan + part beserta posisi, parameter, dan pin pilihannya). */
  nodes: Node[];
  /** Epoch ms — dipakai mengurutkan daftar (terbaru di atas). */
  savedAt: number;
}

/** Dibaca ulang tiap kali (bukan di-cache) supaya tetap benar kalau app dibuka di dua tab. */
export function listProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as SavedProject[]).filter((p) => p && typeof p.id === 'string' && typeof p.source === 'string');
  } catch {
    // JSON rusak / localStorage diblokir — anggap belum ada projek, jangan bikin app mati.
    return [];
  }
}

function writeProjects(projects: SavedProject[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export class ProjectStorageFullError extends Error {
  constructor() {
    super(`Penyimpanan penuh (maksimal ${MAX_PROJECTS} projek). Hapus salah satu projek dulu.`);
    this.name = 'ProjectStorageFullError';
  }
}

/**
 * Simpan projek. Kalau sudah ada projek dengan nama sama (tanpa peduli huruf besar/kecil),
 * projek itu DITIMPA — bukan bikin duplikat, supaya siswa yang menekan "Simpan" berulang
 * kali tidak menghabiskan kuota dengan salinan nama yang sama.
 *
 * @throws {ProjectStorageFullError} kalau nama baru dan kuota sudah penuh.
 */
export function saveProject(name: string, source: string, nodes: Node[]): SavedProject {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nama projek tidak boleh kosong.');

  const projects = listProjects();
  const existing = projects.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());

  if (!existing && projects.length >= MAX_PROJECTS) throw new ProjectStorageFullError();

  const project: SavedProject = {
    id: existing?.id ?? crypto.randomUUID(),
    name: trimmed,
    source,
    nodes,
    savedAt: Date.now(),
  };

  writeProjects(existing ? projects.map((p) => (p.id === existing.id ? project : p)) : [...projects, project]);
  return project;
}

export function deleteProject(id: string): void {
  writeProjects(listProjects().filter((p) => p.id !== id));
}

export function getProject(id: string): SavedProject | undefined {
  return listProjects().find((p) => p.id === id);
}

/** Buang karakter yang dilarang di nama file Windows/Linux supaya unduhan tidak gagal. */
export function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_');
  return cleaned || 'sketch';
}

/** Unduh kode sebagai file .ino — file inilah yang bisa dibuka di Arduino IDE asli. */
export function downloadSketch(name: string, source: string): void {
  const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(name)}.ino`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
