import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWiringStore } from '../../canvas/wiringStore';
import { BOARD_OPTIONS, DEFAULT_BOARD_ID, boardById, useBoardStore } from '../boardStore';

const SERVER_SRC = readFileSync(join(__dirname, '../../../compile-server/server.js'), 'utf-8');
const STORAGE_KEY = 'arduino-wokwi-clone-board';

beforeEach(() => {
  localStorage.clear();
  // Store zustand itu singleton bertahan lintas test dalam satu file — direset manual
  // di sini (bukan cuma localStorage.clear()) supaya tiap test mulai dari kondisi bersih,
  // independen dari state hydration saat modul pertama kali di-import.
  useBoardStore.setState({ boardId: DEFAULT_BOARD_ID });
  useWiringStore.setState({ nodes: useWiringStore.getState().nodes.filter((n) => n.type !== 'module') });
});

describe('BOARD_OPTIONS', () => {
  it('FQBN esp32 cocok dengan deteksi platform "esp32:esp32" di compile-server', () => {
    // server.js: const isEsp32 = platform === 'esp32:esp32' (platform = 2 komponen pertama FQBN).
    const esp32 = BOARD_OPTIONS.find((b) => b.id === 'esp32');
    expect(esp32?.fqbn.split(':').slice(0, 2).join(':')).toBe('esp32:esp32');
    expect(SERVER_SRC).toContain("platform === 'esp32:esp32'");
  });

  it('FQBN esp8266 cocok dengan deteksi platform "esp8266:esp8266" di compile-server', () => {
    const esp8266 = BOARD_OPTIONS.find((b) => b.id === 'esp8266');
    expect(esp8266?.fqbn.split(':').slice(0, 2).join(':')).toBe('esp8266:esp8266');
    expect(SERVER_SRC).toContain("platform === 'esp8266:esp8266'");
  });

  it('board AVR (Uno) tidak dianggap esp32/esp8266 oleh deteksi platform yang sama', () => {
    const uno = BOARD_OPTIONS.find((b) => b.id === 'uno');
    const platform = uno?.fqbn.split(':').slice(0, 2).join(':');
    expect(platform).not.toBe('esp32:esp32');
    expect(platform).not.toBe('esp8266:esp8266');
  });

  it('kind cocok dengan platform-nya: hanya arduino:avr yang kind "avr"', () => {
    for (const board of BOARD_OPTIONS) {
      const platform = board.fqbn.split(':').slice(0, 2).join(':');
      expect(board.kind).toBe(platform === 'arduino:avr' ? 'avr' : 'esp');
    }
  });

  it('tidak ada id atau fqbn ganda', () => {
    expect(new Set(BOARD_OPTIONS.map((b) => b.id)).size).toBe(BOARD_OPTIONS.length);
    expect(new Set(BOARD_OPTIONS.map((b) => b.fqbn)).size).toBe(BOARD_OPTIONS.length);
  });
});

describe('penyimpanan pilihan board (useBoardStore)', () => {
  it('default ke board pertama (Uno)', () => {
    expect(useBoardStore.getState().boardId).toBe(BOARD_OPTIONS[0].id);
  });

  it('setBoardId mengubah state DAN menyimpannya ke localStorage', () => {
    useBoardStore.getState().setBoardId('esp32');
    expect(useBoardStore.getState().boardId).toBe('esp32');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').state.boardId).toBe('esp32');
  });

  it('pilihan board terbaca lagi setelah store dibuat ulang (mensimulasikan reload halaman)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { boardId: 'esp8266' }, version: 0 }));
    vi.resetModules();
    const fresh = await import('../boardStore');
    expect(fresh.useBoardStore.getState().boardId).toBe('esp8266');
  });

  it('setBoardId membuang semua sambungan pin tersimpan (id pin sama bisa berarti pin fisik berbeda di board lain)', () => {
    const instanceId = useWiringStore.getState().addModule('led', {});
    useWiringStore.getState().setPin(instanceId, 'anode', 'D13', 'uno');
    expect(useWiringStore.getState().getModuleInstances()[0].pins).toEqual({ anode: 'D13' });

    useBoardStore.getState().setBoardId('esp32');

    expect(useWiringStore.getState().getModuleInstances()[0].pins).toEqual({});
  });

  it('id tersimpan yang tidak dikenal (data lama/rusak) jatuh ke default, bukan diteruskan mentah', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { boardId: 'board-yang-sudah-dihapus' }, version: 0 }));
    vi.resetModules();
    const fresh = await import('../boardStore');
    expect(fresh.useBoardStore.getState().boardId).toBe(fresh.DEFAULT_BOARD_ID);
  });

  it('boardById fallback ke board pertama untuk id tak dikenal', () => {
    expect(boardById('tidak-ada').id).toBe(BOARD_OPTIONS[0].id);
  });
});
