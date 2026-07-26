import type { ModuleRenderProps } from '../types';

export interface LedState {
  on: boolean;
  brightness: number;
}

const COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
};

export function LedRender({ state, params }: ModuleRenderProps<LedState>) {
  const color = COLOR_HEX[(params.color as string) ?? 'red'] ?? COLOR_HEX.red;
  return (
    <div
      className="led-render"
      style={{
        backgroundColor: state.on ? color : '#3a3a3a',
        boxShadow: state.on ? `0 0 12px 4px ${color}` : 'none',
      }}
    />
  );
}
