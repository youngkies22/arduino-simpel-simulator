import type { ModuleRenderProps } from '../types';
import type { LcdState } from './definition';

export function LcdRender({ state }: ModuleRenderProps<LcdState>) {
  return (
    <div className="lcd-render">
      {state.lines.map((line, i) => (
        <div key={i} className="lcd-render__line">
          {line}
        </div>
      ))}
    </div>
  );
}
