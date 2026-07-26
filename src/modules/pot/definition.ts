import { getModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { PotRender } from './Render';

export interface PotState {
  value: number;
}

export const potModule: ModuleDefinition<PotState> = {
  id: 'pot',
  title: 'Potentiometer',
  category: 'input',
  icon: 'CircleDashed',
  ports: [
    { id: 'signal', label: 'Signal (Analog)', kind: 'analog', required: true },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { value: 512 },
  RenderComponent: PotRender,
  runtimeHandlers: {
    analogRead: (instanceId) => getModuleState<PotState>(instanceId)?.value ?? 0,
  },
};
