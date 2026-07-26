import type { ModuleInstance } from './wiringStore';

export interface PinBinding {
  moduleInstanceId: string;
  moduleId: string;
  portId: string;
}

/**
 * Menerjemahkan daftar ModuleInstance (hasil pilihan pin via dropdown di kartu part)
 * menjadi mapping pinId ('D13', 'A0', ...) -> modul yang tersambung di sana.
 */
export function resolvePinMapping(modules: ModuleInstance[]): Map<string, PinBinding> {
  const mapping = new Map<string, PinBinding>();

  for (const m of modules) {
    for (const [portId, pinId] of Object.entries(m.pins)) {
      if (!pinId) continue;
      mapping.set(pinId, { moduleInstanceId: m.instanceId, moduleId: m.moduleId, portId });
    }
  }

  return mapping;
}
