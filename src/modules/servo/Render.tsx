import type { ModuleRenderProps } from '../types';
import type { ServoState } from './definition';

export function ServoRender({ state }: ModuleRenderProps<ServoState>) {
  // 0..180 derajat sketch dipetakan ke -90..90 derajat visual (dial menghadap ke atas saat 90).
  const rotation = state.angle - 90;
  return (
    <div className="servo-render">
      <div className="servo-render__dial">
        <div className="servo-render__needle" style={{ transform: `rotate(${rotation}deg)` }} />
      </div>
      <span className="servo-render__angle">{state.angle}°</span>
    </div>
  );
}
