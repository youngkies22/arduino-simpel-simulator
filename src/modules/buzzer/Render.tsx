import { Volume2, VolumeX } from 'lucide-react';
import type { ModuleRenderProps } from '../types';
import type { BuzzerState } from './definition';

export function BuzzerRender({ state }: ModuleRenderProps<BuzzerState>) {
  return (
    <div className={`buzzer-render${state.active ? ' buzzer-render--active' : ''}`}>
      {state.active ? <Volume2 size={28} /> : <VolumeX size={28} />}
      {state.active && <span className="buzzer-render__freq">{state.frequency} Hz</span>}
    </div>
  );
}
