import { patchModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { RelayRender } from './Render';

export interface RelayState {
  on: boolean;
}

export const relayModule: ModuleDefinition<RelayState> = {
  id: 'relay',
  title: 'Relay',
  category: 'output',
  icon: 'ToggleRight',
  ports: [
    { id: 'signal', label: 'Signal', kind: 'digital', required: true },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { on: false },
  RenderComponent: RelayRender,
  runtimeHandlers: {
    onDigitalWrite: (instanceId, value) => patchModuleState<RelayState>(instanceId, { on: value === 1 }),
  },
};
