import type { ModuleRenderProps } from '../types';
import type { RelayState } from './definition';

export function RelayRender({ state }: ModuleRenderProps<RelayState>) {
  return (
    <div className={`relay-render${state.on ? ' relay-render--on' : ''}`}>
      <div className="relay-render__indicator" />
      <div className="relay-render__bulb" />
    </div>
  );
}
