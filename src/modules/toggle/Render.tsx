import type { ModuleRenderProps } from '../types';
import { patchModuleState } from '../moduleRuntimeHelpers';
import type { ToggleState } from './definition';

export function ToggleRender({ instanceId, state }: ModuleRenderProps<ToggleState>) {
  return (
    <label className="toggle-render">
      <input
        type="checkbox"
        checked={state.on}
        onChange={(e) => patchModuleState<ToggleState>(instanceId, { on: e.target.checked })}
      />
      <span>{state.on ? 'ON' : 'OFF'}</span>
    </label>
  );
}
