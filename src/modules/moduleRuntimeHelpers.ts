import { useSimulationStore } from '../simulation/simulationStore';

/** Baca state runtime instance modul saat ini (dipakai di dalam runtimeHandlers/RenderComponent). */
export function getModuleState<T>(instanceId: string): T | undefined {
  return useSimulationStore.getState().moduleRuntimeState[instanceId] as T | undefined;
}

/** Update state runtime instance modul (merge parsial, mirip setState). */
export function patchModuleState<T extends object>(instanceId: string, patch: Partial<T>): void {
  useSimulationStore.getState().setModuleState(instanceId, (prev) => ({ ...(prev as T), ...patch }));
}

/** Update state runtime instance modul lewat fungsi updater (untuk akumulasi, mis. stepper). */
export function updateModuleState<T>(instanceId: string, updater: (prev: T) => T): void {
  useSimulationStore.getState().setModuleState(instanceId, updater as (prev: unknown) => unknown);
}
