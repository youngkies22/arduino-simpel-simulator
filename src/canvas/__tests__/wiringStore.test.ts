import { beforeEach, describe, expect, it } from 'vitest';
import { BOARD_NODE_ID, useWiringStore } from '../wiringStore';

const store = () => useWiringStore.getState();

beforeEach(() => {
  useWiringStore.setState({ nodes: store().nodes.filter((n) => n.id === BOARD_NODE_ID) });
});

describe('resetModules', () => {
  it('membuang semua part TAPI board tetap ada', () => {
    store().addModule('led', {});
    store().addModule('buzzer', {});
    expect(store().getModuleInstances()).toHaveLength(2);
    expect(store().nodes.some((n) => n.id === BOARD_NODE_ID)).toBe(true);

    store().resetModules();

    expect(store().getModuleInstances()).toEqual([]);
    expect(store().nodes.some((n) => n.id === BOARD_NODE_ID)).toBe(true);
    expect(store().nodes).toHaveLength(1);
  });

  it('aman dipanggil di kanvas yang sudah kosong (cuma board)', () => {
    expect(store().getModuleInstances()).toEqual([]);
    expect(() => store().resetModules()).not.toThrow();
    expect(store().nodes.some((n) => n.id === BOARD_NODE_ID)).toBe(true);
  });
});
