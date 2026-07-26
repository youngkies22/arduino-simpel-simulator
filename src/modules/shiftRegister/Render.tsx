import type { ModuleRenderProps } from '../types';
import type { ShiftRegisterState } from './definition';

export function ShiftRegisterRender({ state }: ModuleRenderProps<ShiftRegisterState>) {
  const bits = Array.from({ length: 8 }, (_, i) => (state.value >> (7 - i)) & 1);
  return (
    <div className="shift-register-render">
      {bits.map((bit, i) => (
        <span key={i} className={`shift-register-render__led${bit ? ' shift-register-render__led--on' : ''}`} />
      ))}
    </div>
  );
}
