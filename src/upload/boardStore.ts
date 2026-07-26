import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BoardId } from '../boardId';
import { useWiringStore } from '../canvas/wiringStore';

/**
 * Board yang bisa dipilih untuk compile & simulasi. FQBN-nya harus persis dikenali
 * arduino-cli DAN cocok dengan deteksi platform di compile-server
 * (`fqbn.split(':').slice(0,2)`, lihat compile-server/server.js) supaya server tahu
 * format output yang benar (.hex untuk AVR, segmen .bin dengan offset flash untuk
 * esp32/esp8266). `id` dipakai juga sebagai kunci ke tabel pin di boardPinLayout.ts —
 * KEDUANYA harus tetap sinkron (lihat boardStore.test.ts).
 */
export interface BoardOption {
  id: BoardId;
  label: string;
  fqbn: string;
  /** AVR pakai Web Serial (STK500/Optiboot) — "Upload ke Board" cuma didukung untuk ini.
   * Board lain baru bisa compile + unduh .bin (flash manual pakai esptool dkk). */
  kind: 'avr' | 'esp';
}

export const BOARD_OPTIONS: BoardOption[] = [
  { id: 'uno', label: 'Arduino Uno', fqbn: 'arduino:avr:uno', kind: 'avr' },
  { id: 'esp32', label: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32', kind: 'esp' },
  { id: 'esp8266', label: 'ESP8266 (NodeMCU 1.0)', fqbn: 'esp8266:esp8266:nodemcuv2', kind: 'esp' },
];

export const DEFAULT_BOARD_ID: BoardId = BOARD_OPTIONS[0].id;

export function boardById(id: string): BoardOption {
  return BOARD_OPTIONS.find((b) => b.id === id) ?? BOARD_OPTIONS[0];
}

function isKnownBoardId(id: unknown): id is BoardId {
  return typeof id === 'string' && BOARD_OPTIONS.some((b) => b.id === id);
}

interface BoardState {
  boardId: BoardId;
  /** Ganti board aktif. SENGAJA ikut membuang semua pin yang sudah disambung di kanvas
   * (lewat wiringStore.clearAllPins()) -- id pin yang sama (mis. "D2") berarti pin FISIK
   * yang beda total antar board (D2 Uno vs D2/GPIO4 di ESP8266), jadi mempertahankan
   * sambungan lama akan diam-diam salah tersambung alih-alih ketahuan perlu disambung ulang. */
  setBoardId: (id: BoardId) => void;
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      boardId: DEFAULT_BOARD_ID,
      setBoardId: (id) => {
        set({ boardId: id });
        useWiringStore.getState().clearAllPins();
      },
    }),
    {
      name: 'arduino-wokwi-clone-board',
      // Data lama/rusak di localStorage (mis. dari versi sebelum ESP32/ESP8266 ada, atau
      // korup) bisa berisi id yang sekarang tidak dikenal — tanpa validasi ini,
      // `pinsForBoard()` dkk akan menerima id itu mentah-mentah dan meledak (tabel pin-nya
      // undefined) alih-alih jatuh ke default yang aman.
      merge: (persisted, current) => {
        const boardId = (persisted as Partial<BoardState> | undefined)?.boardId;
        return { ...current, boardId: isKnownBoardId(boardId) ? boardId : DEFAULT_BOARD_ID };
      },
    },
  ),
);
