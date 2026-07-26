import { getModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { ToggleRender } from './Render';

export interface ToggleState {
  on: boolean;
}

export const toggleModule: ModuleDefinition<ToggleState> = {
  id: 'toggle',
  title: 'Toggle Switch',
  category: 'input',
  icon: 'ToggleLeft',
  ports: [
    { id: 'signal', label: 'Signal', kind: 'digital', required: true },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { on: false },
  RenderComponent: ToggleRender,
  runtimeHandlers: {
    digitalRead: (instanceId) => (getModuleState<ToggleState>(instanceId)?.on ? 1 : 0),
  },
};
