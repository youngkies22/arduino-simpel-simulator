import { useEffect, useRef, useState } from 'react';
import { MAX_PLOT_SERIES, seriesColor } from './plotPalette';

interface SerialPlotterProps {
  /** Tiap entri = satu baris angka dari Serial.println (bisa multi-kolom). */
  samples: number[][];
}

const PAD_LEFT = 44;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 18;

/** Angka sumbu: ringkas tapi tidak menyesatkan (0.05 tidak boleh jadi "0"). */
function formatTick(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(2);
}

/** Grafik garis dari data Serial Plotter. Sumbu-X = urutan sample (bukan waktu asli),
 * sama seperti Serial Plotter di Arduino IDE. */
export function SerialPlotter({ samples }: SerialPlotterProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // Ukuran diukur dari elemennya, BUKAN viewBox tetap + preserveAspectRatio="none":
  // cara itu meregangkan teks sumbu jadi gepeng saat rasio panel berubah.
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [samples.length === 0]);

  if (samples.length === 0) {
    return (
      <div className="plotter plotter--empty">
        <p>
          Belum ada data. Plotter menggambar baris Serial yang isinya <strong>angka saja</strong>, misalnya{' '}
          <code>Serial.println(nilai);</code> — beberapa nilai dalam satu baris (dipisah spasi/koma) jadi beberapa garis.
        </p>
      </div>
    );
  }

  const seriesCount = Math.min(
    samples.reduce((max, row) => Math.max(max, row.length), 0),
    MAX_PLOT_SERIES,
  );

  // Skala Y dari seluruh data yang tampil. Rentang datar (semua nilai sama) diberi
  // padding supaya garisnya tidak menempel di tepi atas/bawah.
  let min = Infinity;
  let max = -Infinity;
  for (const row of samples) {
    for (let i = 0; i < seriesCount; i++) {
      const v = row[i];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const VIEW_W = Math.max(size.w, PAD_LEFT + PAD_RIGHT + 40);
  const VIEW_H = Math.max(size.h, PAD_TOP + PAD_BOTTOM + 30);
  const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const xAt = (i: number) => PAD_LEFT + (samples.length === 1 ? plotW / 2 : (i / (samples.length - 1)) * plotW);
  const yAt = (v: number) => PAD_TOP + plotH - ((v - min) / (max - min)) * plotH;

  const paths: string[] = [];
  for (let s = 0; s < seriesCount; s++) {
    let d = '';
    let penDown = false;
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i][s];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        // Baris yang kolomnya lebih sedikit: putuskan garis, jangan tarik ke 0.
        penDown = false;
        continue;
      }
      d += `${penDown ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`;
      penDown = true;
    }
    paths.push(d);
  }

  const ticks = [min, (min + max) / 2, max];
  const latest = samples[samples.length - 1];
  const shown = hoverIndex !== null ? samples[hoverIndex] : latest;

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xInView = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const ratio = (xInView - PAD_LEFT) / plotW;
    const idx = Math.round(ratio * (samples.length - 1));
    setHoverIndex(idx >= 0 && idx < samples.length ? idx : null);
  };

  return (
    <div className="plotter">
      <div className="plotter__canvas" ref={boxRef}>
      <svg
        ref={svgRef}
        className="plotter__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`Grafik serial, ${seriesCount} seri, ${samples.length} sample`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="plotter__grid" x1={PAD_LEFT} x2={VIEW_W - PAD_RIGHT} y1={yAt(t)} y2={yAt(t)} />
            <text className="plotter__tick" x={PAD_LEFT - 6} y={yAt(t)} textAnchor="end" dominantBaseline="middle">
              {formatTick(t)}
            </text>
          </g>
        ))}

        {hoverIndex !== null && (
          <line className="plotter__crosshair" x1={xAt(hoverIndex)} x2={xAt(hoverIndex)} y1={PAD_TOP} y2={PAD_TOP + plotH} />
        )}

        {paths.map((d, s) => (
          <path key={s} className="plotter__line" d={d} stroke={seriesColor(s)} />
        ))}

        {hoverIndex !== null &&
          Array.from({ length: seriesCount }, (_, s) => samples[hoverIndex][s]).map((v, s) =>
            typeof v === 'number' && Number.isFinite(v) ? (
              <circle key={s} className="plotter__dot" cx={xAt(hoverIndex)} cy={yAt(v)} r={4} fill={seriesColor(s)} />
            ) : null,
          )}

        <text className="plotter__count" x={VIEW_W - PAD_RIGHT} y={VIEW_H - 4} textAnchor="end">
          {samples.length} sample
        </text>
      </svg>
      </div>

      {/* Legenda selalu ada (identitas seri tidak boleh ditandai warna saja) dan sekaligus
          jadi label langsung nilai terakhir / nilai yang sedang di-hover. */}
      <ul className="plotter__legend">
        {Array.from({ length: seriesCount }, (_, s) => (
          <li key={s} className="plotter__legend-item">
            <span className="plotter__swatch" style={{ background: seriesColor(s) }} aria-hidden="true" />
            <span className="plotter__legend-name">{seriesCount === 1 ? 'Nilai' : `Seri ${s + 1}`}</span>
            <span className="plotter__legend-value">
              {typeof shown?.[s] === 'number' && Number.isFinite(shown[s]) ? shown[s] : '—'}
            </span>
          </li>
        ))}
        {hoverIndex !== null && <li className="plotter__legend-at">sample #{hoverIndex + 1}</li>}
      </ul>
    </div>
  );
}
