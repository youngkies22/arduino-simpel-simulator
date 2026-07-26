import { getModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { UltrasonicRender } from './Render';

export interface UltrasonicState {
  distanceCm: number;
}

export const ultrasonicModule: ModuleDefinition<UltrasonicState> = {
  id: 'ultrasonic',
  title: 'Ultrasonic HC-SR04',
  category: 'sensor',
  icon: 'Radar',
  ports: [
    { id: 'trig', label: 'Trig', kind: 'digital', required: false },
    { id: 'echo', label: 'Echo', kind: 'digital', required: true },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { distanceCm: 100 },
  RenderComponent: UltrasonicRender,
  runtimeHandlers: {
    // pulseIn() dipanggil sketch pada pin echo -> durasi mikrodetik = jarak_cm * 58,
    // rumus fisik yang sama seperti versi Flutter lama.
    pulseIn: (instanceId) => Math.round((getModuleState<UltrasonicState>(instanceId)?.distanceCm ?? 100) * 58),
  },
};
