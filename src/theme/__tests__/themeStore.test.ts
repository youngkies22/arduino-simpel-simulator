import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeStore } from '../themeStore';

const STORAGE_KEY = 'arduino-wokwi-clone-theme';

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({ theme: 'dark' });
  document.documentElement.removeAttribute('data-theme');
});

describe('useThemeStore', () => {
  it('default ke dark', () => {
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('setTheme mengubah state, menyimpan ke localStorage, DAN menerapkan atribut ke <html>', () => {
    useThemeStore.getState().setTheme('light');

    expect(useThemeStore.getState().theme).toBe('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggleTheme bolak-balik dark <-> light', () => {
    const { toggleTheme } = useThemeStore.getState();

    toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');

    toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('tema tersimpan terbaca lagi saat modul dibuat ulang (mensimulasikan reload halaman)', async () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    vi.resetModules();
    const fresh = await import('../themeStore');
    expect(fresh.useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('nilai tersimpan yang tidak dikenal (data lama/rusak) jatuh ke dark, bukan diteruskan mentah', async () => {
    localStorage.setItem(STORAGE_KEY, 'sepia');
    vi.resetModules();
    const fresh = await import('../themeStore');
    expect(fresh.useThemeStore.getState().theme).toBe('dark');
  });
});
