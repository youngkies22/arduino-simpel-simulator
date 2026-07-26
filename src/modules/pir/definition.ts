import { getModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { PirRender } from './Render';

export interface PirState {
  on: boolean;
}

export const pirModule: ModuleDefinition<PirState> = {
  id: 'pir',
  title: 'PIR Motion',
  category: 'input',
  icon: 'PersonStanding',
  ports: [
    { id: 'signal', label: 'Signal', kind: 'digital', required: true },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { on: false },
  RenderComponent: PirRender,
  runtimeHandlers: {
    digitalRead: (instanceId) => (getModuleState<PirState>(instanceId)?.on ? 1 : 0),
  },
};
