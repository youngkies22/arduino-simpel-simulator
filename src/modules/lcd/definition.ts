import { getModuleState, patchModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition, ModulePort } from '../types';
import { LcdRender } from './Render';

const COLS = 16;
const ROWS = 2;

export interface LcdState {
  lines: string[];
  col: number;
  row: number;
}

function blankLines(): string[] {
  return Array.from({ length: ROWS }, () => ' '.repeat(COLS));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

const RUNTIME_HANDLERS: ModuleDefinition<LcdState>['runtimeHandlers'] = {
  // Ukuran cols/rows dari argumen begin()/init() diabaikan — LCD virtual selalu 16x2,
  // sama seperti keterbatasan lcd_widget.dart lama.
  onLcdBegin: (instanceId) => patchModuleState<LcdState>(instanceId, { lines: blankLines(), col: 0, row: 0 }),
  onLcdClear: (instanceId) => patchModuleState<LcdState>(instanceId, { lines: blankLines(), col: 0, row: 0 }),
  onLcdSetCursor: (instanceId, col, row) =>
    patchModuleState<LcdState>(instanceId, { col: clamp(col, 0, COLS - 1), row: clamp(row, 0, ROWS - 1) }),
  onLcdPrint: (instanceId, text) => {
    const state = getModuleState<LcdState>(instanceId) ?? { lines: blankLines(), col: 0, row: 0 };
    const lines = [...state.lines];
    const chars = lines[state.row].split('');
    let col = state.col;
    for (const ch of text) {
      if (col >= COLS) break; // Terpotong tanpa wrap otomatis, sama seperti app lama.
      chars[col] = ch;
      col++;
    }
    lines[state.row] = chars.join('');
    patchModuleState<LcdState>(instanceId, { lines, col });
  },
};

/** LCD paralel HD44780 klasik — 6 pin data (RS, EN, D4-D7) harus disambung manual,
 * sesuai `LiquidCrystal lcd(rs, en, d4, d5, d6, d7);`. */
export const lcdModule: ModuleDefinition<LcdState> = {
  id: 'lcd',
  title: 'LCD 16x2',
  category: 'display',
  icon: 'MonitorSmartphone',
  ports: [
    { id: 'rs', label: 'RS', kind: 'digital', required: true },
    { id: 'en', label: 'EN', kind: 'digital', required: false },
    { id: 'd4', label: 'D4', kind: 'digital', required: false },
    { id: 'd5', label: 'D5', kind: 'digital', required: false },
    { id: 'd6', label: 'D6', kind: 'digital', required: false },
    { id: 'd7', label: 'D7', kind: 'digital', required: false },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { lines: blankLines(), col: 0, row: 0 },
  RenderComponent: LcdRender,
  runtimeHandlers: RUNTIME_HANDLERS,
};

const I2C_PORTS: ModulePort[] = [
  { id: 'sda', label: 'SDA', kind: 'digital', required: true },
  { id: 'scl', label: 'SCL', kind: 'digital', required: true },
  { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
  { id: 'gnd', label: 'GND', kind: 'ground', required: false },
];

/** LCD dengan modul backpack I2C (PCF8574) — cuma 2 pin (SDA/SCL), jauh lebih gampang
 * disambung daripada varian paralel. Sesuai `LiquidCrystal_I2C lcd(0x27, 16, 2);`, lalu
 * `lcd.init()` (bukan `begin()`) — parser & interpreter sudah menerima keduanya. */
export const lcdI2cModule: ModuleDefinition<LcdState> = {
  id: 'lcd-i2c',
  title: 'LCD 16x2 (I2C)',
  category: 'display',
  icon: 'MonitorSmartphone',
  ports: I2C_PORTS,
  paramSchema: [],
  initialState: { lines: blankLines(), col: 0, row: 0 },
  RenderComponent: LcdRender,
  runtimeHandlers: RUNTIME_HANDLERS,
};
