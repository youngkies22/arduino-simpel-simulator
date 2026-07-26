import type { ModuleRenderProps } from '../types';
import { patchModuleState } from '../moduleRuntimeHelpers';
import type { DhtState } from './definition';

export function DhtRender({ instanceId, state }: ModuleRenderProps<DhtState>) {
  return (
    <div className="dht-render">
      <label>
        <span>{state.temperature}°C</span>
        <input
          type="range"
          min={-10}
          max={50}
          value={state.temperature}
          onChange={(e) => patchModuleState<DhtState>(instanceId, { temperature: Number(e.target.value) })}
        />
      </label>
      <label>
        <span>{state.humidity}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={state.humidity}
          onChange={(e) => patchModuleState<DhtState>(instanceId, { humidity: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
