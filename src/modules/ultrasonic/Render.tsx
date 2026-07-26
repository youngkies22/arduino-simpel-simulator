import type { ModuleRenderProps } from '../types';
import { patchModuleState } from '../moduleRuntimeHelpers';
import type { UltrasonicState } from './definition';

export function UltrasonicRender({ instanceId, state }: ModuleRenderProps<UltrasonicState>) {
  return (
    <div className="slider-render">
      <input
        type="range"
        min={2}
        max={400}
        value={state.distanceCm}
        onChange={(e) => patchModuleState<UltrasonicState>(instanceId, { distanceCm: Number(e.target.value) })}
      />
      <span className="slider-render__value">{state.distanceCm} cm</span>
    </div>
  );
}
