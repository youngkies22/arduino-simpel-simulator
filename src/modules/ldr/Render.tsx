import { Moon, Sun } from 'lucide-react';
import type { ModuleRenderProps } from '../types';
import { patchModuleState } from '../moduleRuntimeHelpers';
import type { LdrState } from './definition';

export function LdrRender({ instanceId, state }: ModuleRenderProps<LdrState>) {
  return (
    <div className="slider-render">
      {state.value > 512 ? <Sun size={16} /> : <Moon size={16} />}
      <input
        type="range"
        min={0}
        max={1023}
        value={state.value}
        onChange={(e) => patchModuleState<LdrState>(instanceId, { value: Number(e.target.value) })}
      />
      <span className="slider-render__value">{state.value}</span>
    </div>
  );
}
