import type { ModuleRenderProps } from '../types';
import type { StepperState } from './definition';

export function StepperRender({ state }: ModuleRenderProps<StepperState>) {
  return (
    <div className="stepper-render">
      <div className="stepper-render__gear" style={{ transform: `rotate(${state.angle % 360}deg)` }} />
      <span className="stepper-render__steps">{state.steps} langkah</span>
    </div>
  );
}
