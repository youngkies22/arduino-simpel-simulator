import { create } from 'zustand';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'arduino-wokwi-clone-theme';

function readSavedTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Menaruh tema di `<html data-theme="...">` — index.css punya blok
 * `:root[data-theme="light"]` yang meng-override semua token warna dari situ,
 * jadi seluruh app (termasuk native form control lewat `color-scheme`) ikut berubah. */
function applyThemeToDocument(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readSavedTheme(),

  setTheme: (theme) => {
    set({ theme });
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Mode privat / kuota penuh — pilihan tema cukup berlaku untuk sesi ini saja.
    }
  },

  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));

// Diterapkan SEKALI saat modul ini di-import (sebelum React sempat render apa pun),
// bukan cuma di dalam komponen -- supaya tidak ada kedipan "sempat dark sebentar"
// saat halaman dibuka dengan preferensi tema terang tersimpan.
applyThemeToDocument(useThemeStore.getState().theme);
