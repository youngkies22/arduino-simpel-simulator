import { create } from 'zustand';
import { resolvePinMapping } from '../canvas/resolvePinMapping';
import { useWiringStore } from '../canvas/wiringStore';
import { WiringAwareController, type ModuleRuntimeRegistry } from '../hal/wiringAwareController';
import { ArduinoInterpreter } from '../interpreter/arduinoInterpreter';
import { getModuleDefinition } from '../modules/registry';
import { serialBridge, useSerialStore } from '../serial/serialStore';
import { useBoardStore } from '../upload/boardStore';

export type SimulationStatus = 'idle' | 'running' | 'stopped' | 'error';

/** Nomor baris sumber error, kalau errornya memang membawa info baris
 * (ArduinoSyntaxError & RuntimeError punya `.line`). Dipakai editor untuk menyorot
 * baris yang bermasalah, bukan cuma menampilkan teks "Line 10: ...". */
function errorLineOf(error: unknown): number | undefined {
  const line = (error as { line?: unknown })?.line;
  return typeof line === 'number' && Number.isFinite(line) && line > 0 ? line : undefined;
}

interface SimulationState {
  status: SimulationStatus;
  errorMessage?: string;
  errorLine?: number;
  /** State runtime tiap instance modul (mis. { on: true } untuk LED), keyed by instanceId. */
  moduleRuntimeState: Record<string, unknown>;
  setModuleState: (instanceId: string, updater: (prev: unknown) => unknown) => void;
  run: (source: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

// Instance ArduinoInterpreter sengaja TIDAK disimpan di state Zustand — ia mesin
// eksekusi imperatif, bukan data reaktif. Dipegang sebagai variabel module-level.
let currentInterpreter: ArduinoInterpreter | null = null;

const registry: ModuleRuntimeRegistry = {
  handlersFor: (moduleId) => getModuleDefinition(moduleId)?.runtimeHandlers,
};

export const useSimulationStore = create<SimulationState>((set, get) => ({
  status: 'idle',
  errorMessage: undefined,
  errorLine: undefined,
  moduleRuntimeState: {},

  setModuleState: (instanceId, updater) =>
    set((state) => ({
      moduleRuntimeState: {
        ...state.moduleRuntimeState,
        [instanceId]: updater(state.moduleRuntimeState[instanceId]),
      },
    })),

  run: async (source) => {
    const wiring = useWiringStore.getState();
    if (wiring.running) return;

    // Snapshot pin mapping sekali saat Start Simulation ditekan — meniru hardware asli
    // (wiring tidak berubah saat program berjalan; UI mengunci pilihan pin lewat `running`).
    const moduleInstances = wiring.getModuleInstances();
    const pinMap = resolvePinMapping(moduleInstances);

    // Modul 'input'/'sensor' (tombol, slider, dst) mewakili tangan pengguna —
    // nilainya HARUS bertahan lewat klik Start berulang (menekan Start tidak
    // memutar ulang posisi slider). Modul 'output'/'actuator'/'display'/
    // 'communication' dikendalikan sketch, jadi direset ke initialState
    // seperti pin yang kembali LOW saat Arduino asli di-restart.
    const previousState = get().moduleRuntimeState;
    const initialModuleState: Record<string, unknown> = {};
    for (const instance of moduleInstances) {
      const def = getModuleDefinition(instance.moduleId);
      if (!def) continue;
      const preserve = def.category === 'input' || def.category === 'sensor';
      const existing = previousState[instance.instanceId];
      initialModuleState[instance.instanceId] = preserve && existing !== undefined ? existing : def.initialState;
    }

    useSerialStore.getState().reset();
    set({ status: 'running', errorMessage: undefined, errorLine: undefined, moduleRuntimeState: initialModuleState });
    wiring.setRunning(true);

    const boardId = useBoardStore.getState().boardId;
    const hardware = new WiringAwareController(pinMap, boardId, registry, {
      serial: serialBridge,
      onUnconnectedPin: (pin, action) => {
        if (!useSerialStore.getState().showSystemMessages) return;
        useSerialStore.getState().println(`// pin ${pin} tidak terhubung ke modul apa pun (${action})`);
      },
    });
    const interpreter = new ArduinoInterpreter(hardware, boardId);
    currentInterpreter = interpreter;

    try {
      await interpreter.run(source);
      set({ status: get().status === 'error' ? get().status : 'stopped' });
    } catch (e) {
      set({ status: 'error', errorMessage: e instanceof Error ? e.message : String(e), errorLine: errorLineOf(e) });
    } finally {
      wiring.setRunning(false);
      currentInterpreter = null;
    }
  },

  stop: () => {
    currentInterpreter?.stop();
  },

  reset: () => {
    currentInterpreter?.stop();
    set({ status: 'idle', errorMessage: undefined, errorLine: undefined, moduleRuntimeState: {} });
  },
}));
