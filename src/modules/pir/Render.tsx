import type { ModuleRenderProps } from '../types';
import { patchModuleState } from '../moduleRuntimeHelpers';
import type { PirState } from './definition';

export function PirRender({ instanceId, state }: ModuleRenderProps<PirState>) {
  return (
    <label className={`pir-render${state.on ? ' pir-render--active' : ''}`}>
      <input
        type="checkbox"
        checked={state.on}
        onChange={(e) => patchModuleState<PirState>(instanceId, { on: e.target.checked })}
      />
      <span>{state.on ? 'Gerakan!' : 'Diam'}</span>
    </label>
  );
}
