import type { ModuleRenderProps } from '../types';
import { patchModuleState } from '../moduleRuntimeHelpers';
import type { ButtonState } from './definition';

export function ButtonRender({ instanceId, state }: ModuleRenderProps<ButtonState>) {
  const press = () => patchModuleState<ButtonState>(instanceId, { pressed: true });
  const release = () => patchModuleState<ButtonState>(instanceId, { pressed: false });

  return (
    <button
      type="button"
      className={`button-render${state.pressed ? ' button-render--pressed' : ''}`}
      onMouseDown={press}
      onMouseUp={release}
      onMouseLeave={release}
      onTouchStart={press}
      onTouchEnd={release}
    >
      {state.pressed ? 'DITEKAN' : 'Tekan'}
    </button>
  );
}
