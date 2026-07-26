import { getModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { DhtRender } from './Render';

export interface DhtState {
  temperature: number;
  humidity: number;
}

export const dhtModule: ModuleDefinition<DhtState> = {
  id: 'dht',
  title: 'DHT11/22',
  category: 'sensor',
  icon: 'Thermometer',
  // Pin data DHT nyata cuma satu; kita tetap wajibkan modul tersambung ke
  // SATU pin manapun supaya findFirstBoundInstance() bisa menemukannya
  // (readTemperature/readHumidity di HAL asli memang global, tanpa argumen pin).
  ports: [
    { id: 'signal', label: 'Data', kind: 'digital', required: true },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { temperature: 25, humidity: 50 },
  RenderComponent: DhtRender,
  runtimeHandlers: {
    readTemperature: (instanceId) => getModuleState<DhtState>(instanceId)?.temperature ?? 25,
    readHumidity: (instanceId) => getModuleState<DhtState>(instanceId)?.humidity ?? 50,
  },
};
