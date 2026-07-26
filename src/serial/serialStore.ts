import { create } from 'zustand';
import type { SerialBridge } from '../hal/wiringAwareController';

/** Padanan `kMaxSerialLines` di constants.dart lama. */
const MAX_SERIAL_LINES = 500;

interface SerialState {
  /** Teks lengkap output Serial Monitor (dipecah per baris saat dirender). */
  buffer: string;
  baud: number;
  /** Byte input yang dikirim user lewat kotak kirim, dikonsumsi Serial.read()/available()/peek(). */
  inputQueue: number[];
  /** Sample numerik untuk Serial Plotter (tiap entri = satu baris angka, bisa multi-kolom). */
  plotSamples: number[][];
  /** Potongan baris yang BELUM diakhiri newline. Wajib ada karena idiom Arduino yang
   * lazim adalah `Serial.print(a); Serial.print(","); Serial.println(b);` — satu baris
   * dirakit dari beberapa panggilan. Tanpa ini, yang keburu diparsing cuma teks di
   * println() saja sehingga grafik multi-kolom selalu jadi satu seri. */
  pendingPlotLine: string;
  /** Kalau true, pesan sistem (mis. "pin belum tersambung") ikut tampil di Serial Monitor.
   * Default false — hanya output Serial.print/println dari sketch yang tampil. */
  showSystemMessages: boolean;
  print: (text: string) => void;
  println: (text: string) => void;
  setBaud: (baud: number) => void;
  sendInput: (text: string) => void;
  setShowSystemMessages: (show: boolean) => void;
  /** Tombol "Clear" di Serial Monitor — cuma bersihkan log yang tampil (+ data plotter),
   * BEDA dari `reset()` (dipanggil pas Start Simulation) yang juga membuang antrean input
   * yang belum sempat dibaca sketch. */
  clearBuffer: () => void;
  reset: () => void;
}

function appendCapped(buffer: string, addition: string): string {
  const combined = buffer + addition;
  const lines = combined.split('\n');
  if (lines.length <= MAX_SERIAL_LINES) return combined;
  return lines.slice(lines.length - MAX_SERIAL_LINES).join('\n');
}

/** Baris yang isinya murni angka (mendukung beberapa kolom dipisah spasi/koma/tab) -> sample plotter. */
function tryParsePlotLine(line: string): number[] | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0) return undefined;
  const parts = trimmed.split(/[\s,]+/);
  const nums = parts.map(Number);
  if (nums.some((n) => Number.isNaN(n))) return undefined;
  return nums;
}

/** Menyusun teks yang masuk jadi baris utuh, lalu memanen baris yang sudah lengkap
 * sebagai sample plotter. Mengembalikan sisa potongan yang belum ketemu newline. */
function feedPlot(pending: string, text: string, samples: number[][]): { pending: string; samples: number[][] } {
  if (!text.includes('\n')) return { pending: pending + text, samples };

  const segments = (pending + text).split('\n');
  const rest = segments.pop() ?? '';
  let next = samples;
  for (const line of segments) {
    const sample = tryParsePlotLine(line);
    if (sample) next = [...next.slice(-499), sample];
  }
  return { pending: rest, samples: next };
}

export const useSerialStore = create<SerialState>((set) => ({
  buffer: '',
  baud: 9600,
  inputQueue: [],
  plotSamples: [],
  pendingPlotLine: '',
  showSystemMessages: false,

  print: (text) =>
    set((state) => {
      const fed = feedPlot(state.pendingPlotLine, text, state.plotSamples);
      return { buffer: appendCapped(state.buffer, text), pendingPlotLine: fed.pending, plotSamples: fed.samples };
    }),

  println: (text) =>
    set((state) => {
      const fed = feedPlot(state.pendingPlotLine, text + '\n', state.plotSamples);
      return { buffer: appendCapped(state.buffer, text + '\n'), pendingPlotLine: fed.pending, plotSamples: fed.samples };
    }),

  setBaud: (baud) => set({ baud }),

  sendInput: (text) =>
    set((state) => ({
      inputQueue: [...state.inputQueue, ...Array.from(text).map((c) => c.charCodeAt(0))],
    })),

  setShowSystemMessages: (show) => set({ showSystemMessages: show }),

  clearBuffer: () => set({ buffer: '', plotSamples: [], pendingPlotLine: '' }),

  reset: () => set({ buffer: '', inputQueue: [], plotSamples: [], pendingPlotLine: '' }),
}));

/** Adapter SerialBridge yang meneruskan panggilan HAL ke serialStore. */
export const serialBridge: SerialBridge = {
  print: (text) => useSerialStore.getState().print(text),
  println: (text) => useSerialStore.getState().println(text),
  available: () => useSerialStore.getState().inputQueue.length,
  read: () => {
    const { inputQueue } = useSerialStore.getState();
    if (inputQueue.length === 0) return -1;
    const [first, ...rest] = inputQueue;
    useSerialStore.setState({ inputQueue: rest });
    return first;
  },
  peek: () => {
    const { inputQueue } = useSerialStore.getState();
    return inputQueue.length > 0 ? inputQueue[0] : -1;
  },
};
