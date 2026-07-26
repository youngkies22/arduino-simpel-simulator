import { patchModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { RgbRender } from './Render';

export interface RgbState {
  r: number;
  g: number;
  b: number;
}

type Channel = 'r' | 'g' | 'b';

function channelFor(portId: string): Channel | undefined {
  if (portId === 'red') return 'r';
  if (portId === 'green') return 'g';
  if (portId === 'blue') return 'b';
  return undefined;
}

export const rgbModule: ModuleDefinition<RgbState> = {
  id: 'rgb',
  title: 'RGB LED',
  category: 'output',
  icon: 'Palette',
  ports: [
    { id: 'red', label: 'Merah (PWM)', kind: 'pwm', required: true },
    { id: 'green', label: 'Hijau (PWM)', kind: 'pwm', required: true },
    { id: 'blue', label: 'Biru (PWM)', kind: 'pwm', required: true },
    // Anggap common-cathode (kaki ke-4 ke GND) — sama seperti LED biasa.
    { id: 'common', label: 'Common (GND)', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { r: 0, g: 0, b: 0 },
  RenderComponent: RgbRender,
  runtimeHandlers: {
    onDigitalWrite: (instanceId, value, portId) => {
      const channel = channelFor(portId);
      if (!channel) return;
      patchModuleState<RgbState>(instanceId, { [channel]: value === 1 ? 255 : 0 } as Partial<RgbState>);
    },
    onAnalogWrite: (instanceId, value, portId) => {
      const channel = channelFor(portId);
      if (!channel) return;
      patchModuleState<RgbState>(instanceId, { [channel]: value } as Partial<RgbState>);
    },
  },
};
