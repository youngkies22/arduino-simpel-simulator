import { useSimulationStore } from '../../simulation/simulationStore';
import type { ModuleDefinition } from '../types';
import { LedRender, type LedState } from './Render';

export const ledModule: ModuleDefinition<LedState> = {
  id: 'led',
  title: 'LED',
  category: 'output',
  icon: 'Lightbulb',
  ports: [
    // 'digital' (bukan 'pwm') sengaja: LED cukup digitalWrite() di pin manapun;
    // pin ber-PWM (kinds mencakup 'digital' juga) tetap otomatis cocok karena superset.
    { id: 'anode', label: 'Anoda (+)', kind: 'digital', required: true },
    { id: 'cathode', label: 'Katoda (GND)', kind: 'ground', required: false },
  ],
  paramSchema: [
    {
      key: 'color',
      label: 'Warna',
      type: 'select',
      default: 'red',
      options: [
        { value: 'red', label: 'Merah' },
        { value: 'green', label: 'Hijau' },
        { value: 'blue', label: 'Biru' },
        { value: 'yellow', label: 'Kuning' },
      ],
    },
  ],
  initialState: { on: false, brightness: 0 },
  RenderComponent: LedRender,
  runtimeHandlers: {
    onDigitalWrite: (instanceId, value) => {
      useSimulationStore.getState().setModuleState(instanceId, () => ({ on: value === 1, brightness: value === 1 ? 255 : 0 }));
    },
    onAnalogWrite: (instanceId, value) => {
      useSimulationStore.getState().setModuleState(instanceId, () => ({ on: value > 0, brightness: value }));
    },
  },
};
