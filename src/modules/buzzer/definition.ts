import { patchModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { BuzzerRender } from './Render';

export interface BuzzerState {
  active: boolean;
  frequency: number;
}

export const buzzerModule: ModuleDefinition<BuzzerState> = {
  id: 'buzzer',
  title: 'Buzzer',
  category: 'output',
  icon: 'Volume2',
  ports: [
    { id: 'signal', label: 'Signal', kind: 'digital', required: true },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { active: false, frequency: 0 },
  RenderComponent: BuzzerRender,
  runtimeHandlers: {
    onTone: (instanceId, frequency, durationMs) => {
      patchModuleState<BuzzerState>(instanceId, { active: true, frequency });
      if (durationMs !== undefined) {
        setTimeout(() => patchModuleState<BuzzerState>(instanceId, { active: false }), durationMs);
      }
    },
    onNoTone: (instanceId) => patchModuleState<BuzzerState>(instanceId, { active: false }),
  },
};
