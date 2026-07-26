import { create } from 'zustand';

export type UploadPhase = 'idle' | 'running' | 'success' | 'error';

export interface UploadProgressState {
  phase: 'write' | 'verify';
  percent: number;
}

interface UploadState {
  open: boolean;
  /** Judul console — dipakai ulang untuk dua alur berbeda: "Upload ke Board" (AVR, Web
   * Serial) dan "Compile & Unduh .bin" (ESP32/ESP8266, belum ada flashing langsung). */
  title: string;
  phase: UploadPhase;
  lines: string[];
  progress: UploadProgressState | null;
  start: (title?: string) => void;
  appendLine: (line: string) => void;
  setProgress: (progress: UploadProgressState | null) => void;
  finish: (phase: 'success' | 'error', message: string) => void;
  close: () => void;
}

/** State panel console gaya IDE — log baris-per-baris + progress bar, dipakai baik
 * untuk upload AVR maupun compile+unduh ESP32/ESP8266. */
export const useUploadStore = create<UploadState>((set, get) => ({
  open: false,
  title: 'Upload ke Board',
  phase: 'idle',
  lines: [],
  progress: null,

  start: (title = 'Upload ke Board') => set({ open: true, title, phase: 'running', lines: [], progress: null }),

  appendLine: (line) => set({ lines: [...get().lines, line] }),

  setProgress: (progress) => set({ progress }),

  finish: (phase, message) => set({ phase, lines: [...get().lines, message], progress: null }),

  close: () => set({ open: false }),
}));
