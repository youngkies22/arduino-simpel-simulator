import { patchModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { ShiftRegisterRender } from './Render';

export interface ShiftRegisterState {
  value: number;
}

function reverseByte(b: number): number {
  let result = 0;
  for (let i = 0; i < 8; i++) {
    result = (result << 1) | ((b >> i) & 1);
  }
  return result;
}

export const shiftRegisterModule: ModuleDefinition<ShiftRegisterState> = {
  id: 'shiftRegister',
  title: 'Shift Register 74HC595',
  category: 'output',
  icon: 'AlignJustify',
  ports: [
    { id: 'data', label: 'Data', kind: 'digital', required: true },
    { id: 'clock', label: 'Clock', kind: 'digital', required: false },
    { id: 'latch', label: 'Latch', kind: 'digital', required: false },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { value: 0 },
  RenderComponent: ShiftRegisterRender,
  runtimeHandlers: {
    // bitOrder 0 = LSBFIRST -> balik urutan bit supaya tampilan Q7..Q0 konsisten (sama seperti app lama).
    onShiftOut: (instanceId, value, bitOrder) => {
      const displayValue = bitOrder === 0 ? reverseByte(value & 0xff) : value & 0xff;
      patchModuleState<ShiftRegisterState>(instanceId, { value: displayValue });
    },
  },
};
