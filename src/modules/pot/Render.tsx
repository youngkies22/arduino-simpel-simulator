import type { ModuleRenderProps } from '../types';
import { patchModuleState } from '../moduleRuntimeHelpers';
import type { PotState } from './definition';

export function PotRender({ instanceId, state }: ModuleRenderProps<PotState>) {
  return (
    <div className="slider-render">
      <input
        type="range"
        min={0}
        max={1023}
        value={state.value}
        onChange={(e) => patchModuleState<PotState>(instanceId, { value: Number(e.target.value) })}
      />
      <span className="slider-render__value">{state.value}</span>
    </div>
  );
}
