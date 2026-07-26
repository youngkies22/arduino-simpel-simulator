/**
 * Warna seri Serial Plotter. BUKAN dipilih dengan selera — divalidasi dengan
 * `validate_palette.js` terhadap surface gelap kanvas plot (#0c0e12, sama dengan
 * `--bg`), mode dark:
 *
 *   4 warna pertama : LOLOS semua-pasangan (--pairs all)  <- kasus umum 1-4 seri
 *   6 warna penuh   : LOLOS pasangan bersebelahan
 *
 * Semua lolos band lightness OKLCH 0.48-0.67, chroma >= 0.1, dan kontras >= 3:1
 * terhadap surface.
 *
 * URUTAN INI TETAP — jangan diacak dan jangan di-cycle. Seri ke-7 dst. tidak dapat
 * warna baru hasil generate (lihat MAX_PLOT_SERIES); identitas seri juga ditandai
 * lewat label langsung di legenda, bukan warna saja.
 */
export const PLOT_SERIES_COLORS = [
  '#ef4444', // merah
  '#059669', // hijau
  '#0284c7', // biru
  '#4f46e5', // nila
  '#d97706', // jingga
  '#9333ea', // ungu
] as const;

/** Lebih dari ini tidak digambar — menambah warna berarti meng-cycle palet (identitas
 * seri jadi ambigu). Plot serial di kelas praktis tidak pernah sebanyak ini. */
export const MAX_PLOT_SERIES = PLOT_SERIES_COLORS.length;

export function seriesColor(index: number): string {
  return PLOT_SERIES_COLORS[index] ?? PLOT_SERIES_COLORS[PLOT_SERIES_COLORS.length - 1];
}
