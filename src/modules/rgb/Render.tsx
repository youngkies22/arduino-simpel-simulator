import type { ModuleRenderProps } from '../types';
import type { RgbState } from './definition';

export function RgbRender({ state }: ModuleRenderProps<RgbState>) {
  const color = `rgb(${state.r}, ${state.g}, ${state.b})`;
  const isOn = state.r > 0 || state.g > 0 || state.b > 0;
  return (
    <div
      className="rgb-render"
      style={{ backgroundColor: color, boxShadow: isOn ? `0 0 14px 4px ${color}` : 'none' }}
    />
  );
}
