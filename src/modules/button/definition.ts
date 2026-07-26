import type { PinMode } from '../../hal/hardwareInterface';
import { getModuleState, patchModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { ButtonRender } from './Render';

export interface ButtonState {
  pressed: boolean;
  pinMode: PinMode;
}

export const buttonModule: ModuleDefinition<ButtonState> = {
  id: 'button',
  title: 'Push Button',
  category: 'input',
  icon: 'CircleDot',
  ports: [
    { id: 'signal', label: 'Signal', kind: 'digital', required: true },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { pressed: false, pinMode: 0 },
  RenderComponent: ButtonRender,
  runtimeHandlers: {
    onPinMode: (instanceId, _pin, mode) => patchModuleState<ButtonState>(instanceId, { pinMode: mode }),
    digitalRead: (instanceId) => {
      const state = getModuleState<ButtonState>(instanceId) ?? { pressed: false, pinMode: 0 };
      // INPUT_PULLUP (mode 2) membalik logika: ditekan -> LOW.
      if (state.pinMode === 2) return state.pressed ? 0 : 1;
      return state.pressed ? 1 : 0;
    },
  },
};
