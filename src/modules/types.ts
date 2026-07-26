import type { ComponentType } from 'react';
import type { ModuleRuntimeHandlers } from '../hal/wiringAwareController';

export type PortKind = 'digital' | 'analog' | 'pwm' | 'power' | 'ground';

export interface ModulePort {
  id: string;
  label: string;
  kind: PortKind;
  required: boolean;
}

export interface ModuleParamOption {
  value: string;
  label: string;
}

export interface ModuleParamField {
  key: string;
  label: string;
  type: 'select' | 'number' | 'text' | 'color';
  options?: ModuleParamOption[];
  min?: number;
  max?: number;
  step?: number;
  default: unknown;
}

export interface ModuleRenderProps<TState = unknown> {
  instanceId: string;
  state: TState;
  params: Record<string, unknown>;
}

export interface ModuleFormProps {
  instanceId: string;
  params: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}

export type ModuleCategory = 'output' | 'input' | 'sensor' | 'actuator' | 'display' | 'communication';

export interface ModuleDefinition<TState = unknown> {
  /** Id stabil, dipersist di wiring layout — jangan diubah setelah dirilis. */
  id: string;
  title: string;
  category: ModuleCategory;
  /** Nama ikon lucide-react, mis. 'Lightbulb'. */
  icon: string;
  ports: ModulePort[];
  paramSchema: ModuleParamField[];
  initialState: TState;
  RenderComponent: ComponentType<ModuleRenderProps<TState>>;
  /** Jika tidak diisi, form parameter di-generate otomatis dari paramSchema. */
  ParamForm?: ComponentType<ModuleFormProps>;
  /**
   * Dispatch table HAL untuk modul ini (dipanggil WiringAwareController saat
   * pin yang tersambung ke modul ini menerima efek hardware dari kode sketch
   * yang ditulis/di-paste user di editor). Satu objek statis dipakai untuk
   * SEMUA instance modul ini di kanvas — method-nya menerima instanceId untuk
   * membedakan instance mana yang harus di-update.
   */
  runtimeHandlers?: ModuleRuntimeHandlers;
}
