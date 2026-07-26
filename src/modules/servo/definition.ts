import { patchModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { ServoRender } from './Render';

export interface ServoState {
  angle: number;
  attached: boolean;
}

export const servoModule: ModuleDefinition<ServoState> = {
  id: 'servo',
  title: 'Servo',
  category: 'actuator',
  icon: 'RotateCw',
  // 'digital' (bukan 'pwm'): Servo.attach() bisa ke pin digital manapun di
  // Arduino asli (dikendalikan software timer interrupt, bukan PWM hardware).
  ports: [
    { id: 'signal', label: 'Signal', kind: 'digital', required: true },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { angle: 90, attached: false },
  RenderComponent: ServoRender,
  runtimeHandlers: {
    onServoWrite: (instanceId, angle) => patchModuleState<ServoState>(instanceId, { angle, attached: true }),
    onServoDetach: (instanceId) => patchModuleState<ServoState>(instanceId, { attached: false }),
  },
};
