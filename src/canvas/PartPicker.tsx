import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ModuleIcon } from './moduleIcons';
import { MODULE_REGISTRY } from '../modules/registry';
import type { ModuleCategory } from '../modules/types';

const CATEGORY_LABEL: Record<ModuleCategory, string> = {
  output: 'Output',
  input: 'Input',
  sensor: 'Sensor',
  actuator: 'Aktuator',
  display: 'Display',
  communication: 'Komunikasi',
};

const CATEGORY_ORDER: ModuleCategory[] = ['output', 'input', 'sensor', 'actuator', 'display', 'communication'];

interface PartPickerProps {
  onPick: (moduleId: string) => void;
  onClose: () => void;
}

/** Panel "tambah part": ketuk/klik langsung menambah part ke daftar — tanpa drag, ramah HP. */
export function PartPicker({ onPick, onClose }: PartPickerProps) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle ? MODULE_REGISTRY.filter((def) => def.title.toLowerCase().includes(needle)) : MODULE_REGISTRY;
    const map = new Map<ModuleCategory, typeof MODULE_REGISTRY>();
    for (const def of filtered) {
      const list = map.get(def.category) ?? [];
      list.push(def);
      map.set(def.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((category) => ({ category, defs: map.get(category)! }));
  }, [query]);

  return (
    <div className="part-picker-overlay" onClick={onClose}>
      <div className="part-picker" role="dialog" aria-label="Tambah part" onClick={(e) => e.stopPropagation()}>
        <div className="part-picker__header">
          <input
            autoFocus
            type="text"
            inputMode="search"
            placeholder="Cari part..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="part-picker__search"
          />
          <button type="button" className="part-picker__close" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="part-picker__body">
          {grouped.map(({ category, defs }) => (
            <div key={category} className="part-picker__group">
              <div className="part-picker__group-title">{CATEGORY_LABEL[category]}</div>
              <div className="part-picker__grid">
                {defs.map((def) => (
                  <button key={def.id} type="button" className="part-picker__item" onClick={() => onPick(def.id)}>
                    <ModuleIcon name={def.icon} size={22} />
                    <span>{def.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && <p className="part-picker__empty">Tidak ada part yang cocok.</p>}
        </div>
      </div>
    </div>
  );
}
