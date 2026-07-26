import type { BoardId } from '../boardId';
import type { PortKind } from '../modules/types';

export type { BoardId };

/**
 * Tabel pin fisik per board — SUMBER KEBENARAN untuk apa yang boleh disambung ke apa.
 * Dipakai oleh PartCard (opsi <select> pin), pinOptions (validasi kompatibilitas),
 * BoardCanvasNode (gambar & label di kanvas), dan wiringAwareController (menerjemahkan
 * nomor pin yang dipakai sketch, mis. `digitalWrite(2, ...)`, balik ke id pin fisik).
 */
export interface PhysicalPin {
  /** Id handle di kanvas, mis. 'D13', 'GPIO2', '3V3', 'GND-1'. */
  id: string;
  /** Nomor pin versi interpreter — angka PERSIS yang ditulis di kode sketch
   * (mis. `pinMode(2, OUTPUT)` -> internalNumber 2). Beda skema per board:
   * Uno pakai offset khusus buat A0..A5 (14..19, konvensi resmi Arduino AVR),
   * ESP32/ESP8266 langsung nomor GPIO apa adanya (tidak ada offset semacam itu). */
  internalNumber?: number;
  /** Kapabilitas elektris pin ini — port modul hanya boleh disambung ke pin yang kind-nya cocok. */
  kinds: PortKind[];
  label: string;
}

const PWM_DIGITAL_PINS_UNO = new Set([3, 5, 6, 9, 10, 11]);

function unoDigitalPins(): PhysicalPin[] {
  const pins: PhysicalPin[] = [];
  for (let n = 0; n <= 13; n++) {
    const kinds: PortKind[] = PWM_DIGITAL_PINS_UNO.has(n) ? ['digital', 'pwm'] : ['digital'];
    pins.push({ id: `D${n}`, internalNumber: n, kinds, label: PWM_DIGITAL_PINS_UNO.has(n) ? `D${n} (PWM)` : `D${n}` });
  }
  return pins;
}

function unoAnalogPins(): PhysicalPin[] {
  const pins: PhysicalPin[] = [];
  for (let i = 0; i <= 5; i++) {
    pins.push({ id: `A${i}`, internalNumber: 14 + i, kinds: ['analog', 'digital'], label: `A${i}` });
  }
  return pins;
}

const UNO_PINS: PhysicalPin[] = [
  ...unoDigitalPins(),
  ...unoAnalogPins(),
  { id: '5V', kinds: ['power'], label: '5V' },
  { id: '3V3', kinds: ['power'], label: '3.3V' },
  { id: 'GND-1', kinds: ['ground'], label: 'GND' },
  { id: 'GND-2', kinds: ['ground'], label: 'GND' },
];

/**
 * GPIO umum dipakai bebas di board DevKit 30-pin (yang paling banyak dipakai pemula —
 * cocok dengan FQBN `esp32:esp32:esp32` "ESP32 Dev Module" di boardStore.ts). SENGAJA
 * tidak menyertakan GPIO6-11 (tersambung ke flash internal, tidak berfungsi kalau
 * dipakai) dan GPIO1/3 (dipakai jalur USB-Serial, dipakai bebas bisa merusak komunikasi
 * Serial Monitor). GPIO34/35/36/39 cuma bisa untuk INPUT (tidak punya driver output di
 * hardware asli) — kalau tetap ditandai bisa 'digital' output, siswa bisa "berhasil"
 * pasang LED ke situ di simulator padahal di board fisik TIDAK AKAN pernah menyala.
 */
const ESP32_IO_PINS = [2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33];
const ESP32_INPUT_ONLY_PINS = [34, 35, 36, 39];

const ESP32_PINS: PhysicalPin[] = [
  ...ESP32_IO_PINS.map((n) => ({ id: `GPIO${n}`, internalNumber: n, kinds: ['digital', 'pwm', 'analog'] as PortKind[], label: `GPIO${n}` })),
  ...ESP32_INPUT_ONLY_PINS.map((n) => ({ id: `GPIO${n}`, internalNumber: n, kinds: ['analog'] as PortKind[], label: `GPIO${n} (input only)` })),
  { id: 'VIN', kinds: ['power'], label: 'VIN (5V)' },
  { id: '3V3', kinds: ['power'], label: '3.3V' },
  { id: 'GND-1', kinds: ['ground'], label: 'GND' },
  { id: 'GND-2', kinds: ['ground'], label: 'GND' },
];

/**
 * Label D0-D8 gaya papan NodeMCU (yang dicetak di board fisiknya & dipakai hampir semua
 * tutorial) -> nomor GPIO ASLI yang dikirim ke chip (beda dari labelnya sendiri!). Cocok
 * dengan FQBN `esp8266:esp8266:nodemcuv2` di boardStore.ts. GPIO6-11 (flash internal) dan
 * GPIO1/3 (USB-Serial) sengaja tidak disertakan, sama alasannya dengan ESP32 di atas.
 * D0 (GPIO16) SENGAJA tidak ditandai 'pwm' -- pin itu satu-satunya yang tidak
 * punya hardware PWM/interrupt di chip ESP8266 asli.
 */
const NODEMCU_DIGITAL: { label: string; gpio: number; pwm: boolean }[] = [
  { label: 'D0', gpio: 16, pwm: false },
  { label: 'D1', gpio: 5, pwm: true },
  { label: 'D2', gpio: 4, pwm: true },
  { label: 'D3', gpio: 0, pwm: true },
  { label: 'D4', gpio: 2, pwm: true },
  { label: 'D5', gpio: 14, pwm: true },
  { label: 'D6', gpio: 12, pwm: true },
  { label: 'D7', gpio: 13, pwm: true },
  { label: 'D8', gpio: 15, pwm: true },
];

const ESP8266_PINS: PhysicalPin[] = [
  ...NODEMCU_DIGITAL.map(({ label, gpio, pwm }) => ({
    id: label,
    internalNumber: gpio,
    kinds: (pwm ? ['digital', 'pwm'] : ['digital']) as PortKind[],
    label: `${label} (GPIO${gpio})`,
  })),
  // Cuma 1 pin analog di seluruh board (beda jauh dari Uno yang punya 6) -- keterbatasan
  // hardware ESP8266 asli, bukan penyederhanaan simulator ini.
  { id: 'A0', internalNumber: 17, kinds: ['analog'], label: 'A0' },
  { id: 'VIN', kinds: ['power'], label: 'VIN' },
  { id: '3V3', kinds: ['power'], label: '3.3V' },
  { id: 'GND-1', kinds: ['ground'], label: 'GND' },
  { id: 'GND-2', kinds: ['ground'], label: 'GND' },
];

const PINS_BY_BOARD: Record<BoardId, PhysicalPin[]> = {
  uno: UNO_PINS,
  esp32: ESP32_PINS,
  esp8266: ESP8266_PINS,
};

export function pinsForBoard(boardId: BoardId): PhysicalPin[] {
  return PINS_BY_BOARD[boardId];
}

export function findPinById(boardId: BoardId, id: string): PhysicalPin | undefined {
  return PINS_BY_BOARD[boardId].find((p) => p.id === id);
}

export function findPinByInternalNumber(boardId: BoardId, n: number): PhysicalPin | undefined {
  return PINS_BY_BOARD[boardId].find((p) => p.internalNumber === n);
}
