import type { ModuleRenderProps } from '../types';
import { patchModuleState } from '../moduleRuntimeHelpers';
import type { RfidState } from './definition';

function randomUid(): number[] {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256));
}

function uidString(uid: number[]): string {
  return uid.length ? uid.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ') : '-- -- -- --';
}

/** Dua kartu independen (A & B) — masing-masing punya UID & tombol sendiri, supaya sketch
 * bisa diuji dengan dua kartu berbeda (mis. kartu terdaftar vs kartu asing). */
export function RfidRender({ instanceId, state }: ModuleRenderProps<RfidState>) {
  const tap = (card: 'uidA' | 'uidB') => {
    const uid = state[card].length ? state[card] : randomUid();
    patchModuleState<RfidState>(instanceId, { tapPending: true, [card]: uid, activeUid: uid } as Partial<RfidState>);
  };
  const randomize = (card: 'uidA' | 'uidB') => patchModuleState<RfidState>(instanceId, { [card]: randomUid() } as Partial<RfidState>);

  return (
    <div className="rfid-render">
      {(
        [
          ['A', 'uidA'],
          ['B', 'uidB'],
        ] as const
      ).map(([label, card]) => (
        <div key={card} className="rfid-render__card">
          <span className="rfid-render__label">Kartu {label}</span>
          <span className="rfid-render__uid">{uidString(state[card])}</span>
          <div className="rfid-render__actions">
            <button type="button" onClick={() => tap(card)}>
              Tempel
            </button>
            <button type="button" onClick={() => randomize(card)}>
              Acak
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
