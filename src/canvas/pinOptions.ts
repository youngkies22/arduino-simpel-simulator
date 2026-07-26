import { pinsForBoard, type BoardId, type PhysicalPin } from './boardPinLayout';
import type { ModuleInstance } from './wiringStore';
import type { ModulePort } from '../modules/types';

export interface PinOption {
  pin: PhysicalPin;
  disabled: boolean;
}

export interface PinOptionGroup {
  group: string;
  options: PinOption[];
}

const GROUP_ORDER = ['Digital', 'Analog', 'Power', 'Ground'] as const;

function groupOf(pin: PhysicalPin): (typeof GROUP_ORDER)[number] {
  if (pin.id.startsWith('D')) return 'Digital';
  if (pin.id.startsWith('A')) return 'Analog';
  if (pin.kinds.includes('ground')) return 'Ground';
  return 'Power';
}

/** Pin daya/ground (5V, 3.3V, GND) mewakili rel bersama di breadboard nyata — boleh
 * dipakai banyak modul sekaligus, beda dari pin sinyal (digital/analog/pwm) yang
 * cuma boleh satu sambungan karena satu pin sinyal cuma bisa mewakili satu modul. */
function isShareableKind(kind: ModulePort['kind']): boolean {
  return kind === 'ground' || kind === 'power';
}

/**
 * Daftar pin yang kompatibel secara elektris dengan sebuah port, dikelompokkan
 * untuk ditampilkan sebagai <optgroup>. Pin sinyal yang sudah dipakai port lain
 * ditandai disabled (satu pin sinyal = satu sambungan); pin ground/power TIDAK
 * pernah ditandai disabled karena boleh dipakai banyak modul sekaligus.
 */
export function pinOptionsForPort(
  boardId: BoardId,
  port: ModulePort,
  modules: ModuleInstance[],
  instanceId: string,
  portId: string,
): PinOptionGroup[] {
  const shareable = isShareableKind(port.kind);
  const usedElsewhere = new Set<string>();
  if (!shareable) {
    for (const m of modules) {
      for (const [pId, pinId] of Object.entries(m.pins)) {
        if (!pinId) continue;
        if (m.instanceId === instanceId && pId === portId) continue;
        usedElsewhere.add(pinId);
      }
    }
  }

  const groups = new Map<string, PinOption[]>();
  for (const pin of pinsForBoard(boardId)) {
    if (!pin.kinds.includes(port.kind)) continue;
    const group = groupOf(pin);
    const list = groups.get(group) ?? [];
    list.push({ pin, disabled: usedElsewhere.has(pin.id) });
    groups.set(group, list);
  }

  return GROUP_ORDER.filter((g) => groups.has(g)).map((group) => ({ group, options: groups.get(group)! }));
}
