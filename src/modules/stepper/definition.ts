import { updateModuleState } from '../moduleRuntimeHelpers';
import type { ModuleDefinition } from '../types';
import { StepperRender } from './Render';

export interface StepperState {
  steps: number;
  angle: number;
}

export const stepperModule: ModuleDefinition<StepperState> = {
  id: 'stepper',
  title: 'Stepper Motor',
  category: 'actuator',
  icon: 'Cog',
  ports: [
    { id: 'in1', label: 'IN1', kind: 'digital', required: true },
    { id: 'in2', label: 'IN2', kind: 'digital', required: false },
    { id: 'in3', label: 'IN3', kind: 'digital', required: false },
    { id: 'in4', label: 'IN4', kind: 'digital', required: false },
    { id: 'vcc', label: 'VCC (5V)', kind: 'power', required: false },
    { id: 'gnd', label: 'GND', kind: 'ground', required: false },
  ],
  paramSchema: [],
  initialState: { steps: 0, angle: 0 },
  RenderComponent: StepperRender,
  runtimeHandlers: {
    onStepperStep: (instanceId, steps, stepsPerRevolution) => {
      updateModuleState<StepperState>(instanceId, (prev) => ({
        steps: prev.steps + steps,
        angle: prev.angle + (steps * 360) / stepsPerRevolution,
      }));
    },
  },
};
