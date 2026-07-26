import { describe, expect, it } from 'vitest';
import { resolvePinMapping } from '../resolvePinMapping';
import type { ModuleInstance } from '../wiringStore';

function moduleInstance(overrides: Partial<ModuleInstance>): ModuleInstance {
  return { instanceId: 'led-1', moduleId: 'led', params: {}, pins: {}, ...overrides };
}

describe('resolvePinMapping', () => {
  it('memetakan satu modul yang disambung ke pin D13', () => {
    const modules = [moduleInstance({ pins: { anode: 'D13' } })];

    const mapping = resolvePinMapping(modules);

    expect(mapping.size).toBe(1);
    expect(mapping.get('D13')).toEqual({ moduleInstanceId: 'led-1', moduleId: 'led', portId: 'anode' });
  });

  it('memindah pin sebuah port menghasilkan mapping baru yang benar (verifikasi kunci: resolusi dinamis)', () => {
    const onD13 = [moduleInstance({ pins: { anode: 'D13' } })];
    const onD9 = [moduleInstance({ pins: { anode: 'D9' } })];

    expect(resolvePinMapping(onD13).has('D13')).toBe(true);
    expect(resolvePinMapping(onD13).has('D9')).toBe(false);
    expect(resolvePinMapping(onD9).has('D9')).toBe(true);
    expect(resolvePinMapping(onD9).has('D13')).toBe(false);
  });

  it('memetakan beberapa port dalam satu modul (mis. RGB) ke pin masing-masing', () => {
    const modules = [
      moduleInstance({ instanceId: 'rgb-1', moduleId: 'rgb', pins: { red: 'D9', green: 'D10', blue: 'D11' } }),
    ];

    const mapping = resolvePinMapping(modules);

    expect(mapping.size).toBe(3);
    expect(mapping.get('D9')).toEqual({ moduleInstanceId: 'rgb-1', moduleId: 'rgb', portId: 'red' });
    expect(mapping.get('D11')).toEqual({ moduleInstanceId: 'rgb-1', moduleId: 'rgb', portId: 'blue' });
  });

  it('mengabaikan port yang belum diberi pin', () => {
    const modules = [moduleInstance({ pins: {} })];
    const mapping = resolvePinMapping(modules);
    expect(mapping.size).toBe(0);
  });

  it('menggabungkan pin dari banyak modul sekaligus', () => {
    const modules = [
      moduleInstance({ instanceId: 'led-1', moduleId: 'led', pins: { anode: 'D13' } }),
      moduleInstance({ instanceId: 'button-1', moduleId: 'button', pins: { signal: 'D2' } }),
    ];

    const mapping = resolvePinMapping(modules);

    expect(mapping.size).toBe(2);
    expect(mapping.get('D2')).toEqual({ moduleInstanceId: 'button-1', moduleId: 'button', portId: 'signal' });
  });
});
