/** URL compile-server bawaan — dipakai kalau tidak ada override sama sekali. */
export const FALLBACK_COMPILE_SERVER_URL = 'https://compile.codeteam.id';

const STORAGE_KEY = 'arduino-wokwi-clone-compile-server-url';

/** URL dari build (.env / VITE_COMPILE_SERVER_URL), kalau diisi saat build. */
function buildTimeUrl(): string | undefined {
  const configured = import.meta.env.VITE_COMPILE_SERVER_URL as string | undefined;
  return configured?.trim() ? configured : undefined;
}

/** URL default (tanpa override user): dari build kalau ada, kalau tidak ya bawaan. */
export function defaultCompileServerUrl(): string {
  return buildTimeUrl() ?? FALLBACK_COMPILE_SERVER_URL;
}

/** Override yang diset user lewat dialog Pengaturan (null = belum pernah diubah). */
export function storedCompileServerUrl(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)?.trim();
    return saved ? saved : null;
  } catch {
    // localStorage bisa dilempar SecurityError di mode privat/iframe tertentu —
    // jangan sampai bikin fitur upload mati total gara-gara ini.
    return null;
  }
}

/**
 * URL yang benar-benar dipakai saat compile. Urutan prioritas:
 * 1. Setelan user di browser (dialog Pengaturan) — supaya ganti server/domain tidak
 *    perlu build ulang & deploy ulang.
 * 2. VITE_COMPILE_SERVER_URL saat build.
 * 3. FALLBACK_COMPILE_SERVER_URL.
 */
export function compileServerUrl(): string {
  return (storedCompileServerUrl() ?? defaultCompileServerUrl()).replace(/\/+$/, '');
}

/** Simpan override user. String kosong = hapus override (balik ke default). */
export function setCompileServerUrl(url: string): void {
  try {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sama seperti di atas: gagal simpan tidak boleh melempar ke pemanggil.
  }
}
