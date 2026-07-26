import type { ModuleParamField } from '../modules/types';

/** Input generik yang di-generate otomatis dari ModuleParamField (dipakai part yang tidak punya ParamForm kustom). */
export function AutoField({ field, value, onChange }: { field: ModuleParamField; value: unknown; onChange: (v: unknown) => void }) {
  if (field.type === 'select') {
    return (
      <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={Number(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    );
  }
  if (field.type === 'color') {
    return <input type="color" value={String(value)} onChange={(e) => onChange(e.target.value)} />;
  }
  return <input type="text" value={String(value)} onChange={(e) => onChange(e.target.value)} />;
}
