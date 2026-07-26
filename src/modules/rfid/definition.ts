import { useSimulationStore } from '../../simulation/simulationStore';
import type { ModuleDefinition } from '../types';
import { RfidRender } from './Render';

export interface RfidState {
  /** UID kartu A & B — dua kartu independen supaya bisa diuji "tempel A" vs "tempel B". */
  uidA: number[];
  uidB: number[];
  /** UID kartu yang terakhir ditempel — inilah yang dibaca rfidUid(). */
  activeUid: number[];
  /** One-shot: true satu kali setelah user menekan "Tempel", dikonsumsi oleh rfidNewCardPresent(). */
  tapPending: boolean;
}

export const rfidModule: ModuleDefinition<RfidState> = {
  id: 'rfid',
  title: 'RFID RC522',
  // 'input', bukan 'communication' -- UID kartu itu identitas fisik yang dipilih
  // user (tombol "Tempel"/"Acak"), sama seperti posisi tombol/slider, BUKAN state
  // yang dikendalikan sketch. Kalau category-nya 'communication', simulationStore.run()
  // mereset uidA/uidB ke initialState ([]) setiap kali "Mulai" ditekan, jadi UID
  // kartu berubah acak tiap run walau user tidak pernah klik "Acak".
  category: 'input',
  icon: 'CreditCard',
  // Sesuai pinout modul RC522 asli: SDA/SS + bus SPI (SCK/MOSI/MISO) + RST.
  ports: [
    { id: 'sda', label: 'SDA (SS)', kind: 'digital', required: true },
    { id: 'sck', label: 'SCK', kind: 'digital', required: false },
    { id: 'mosi', label: 'MOSI', kind: 'digital', required: false },
    { id: 'miso', label: 'MISO', kind: 'digital', required: false },
    { id: 'rst', label: 'RST', kind: 'digital', required: false },
    // RC522 asli 3.3V-only (bukan 5V) — tetap kind 'power' generik biar bisa pakai pin 3.3V.
    { id: 'vcc', label: 'VCC (3.3V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { uidA: [], uidB: [], activeUid: [], tapPending: false },
  RenderComponent: RfidRender,
  runtimeHandlers: {
    rfidNewCardPresent: (instanceId) => {
      const state = useSimulationStore.getState().moduleRuntimeState[instanceId] as RfidState | undefined;
      if (!state?.tapPending) return false;
      // Konsumsi flag one-shot, meniru PICC_IsNewCardPresent() asli.
      useSimulationStore.getState().setModuleState(instanceId, (prev) => ({ ...(prev as RfidState), tapPending: false }));
      return true;
    },
    rfidUid: (instanceId) =>
      (useSimulationStore.getState().moduleRuntimeState[instanceId] as RfidState | undefined)?.activeUid ?? [],
  },
};
