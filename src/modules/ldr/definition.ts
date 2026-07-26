import { getModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { LdrRender } from './Render';

export interface LdrState {
  value: number;
}

export const ldrModule: ModuleDefinition<LdrState> = {
  id: 'ldr',
  title: 'LDR (Sensor Cahaya)',
  category: 'sensor',
  icon: 'Sun',
  ports: [
    { id: 'signal', label: 'Signal (Analog)', kind: 'analog', required: true },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { value: 512 },
  RenderComponent: LdrRender,
  runtimeHandlers: {
    analogRead: (instanceId) => getModuleState<LdrState>(instanceId)?.value ?? 0,
  },
};
