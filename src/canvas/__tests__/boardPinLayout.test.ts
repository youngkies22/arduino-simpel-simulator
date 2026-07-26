import { describe, expect, it } from 'vitest';
import { findPinById, findPinByInternalNumber, pinsForBoard, type BoardId } from '../boardPinLayout';

const BOARD_IDS: BoardId[] = ['uno', 'esp32', 'esp8266'];

describe('pinsForBoard', () => {
  it.each(BOARD_IDS)('%s: tidak ada id pin ganda', (boardId) => {
    const ids = pinsForBoard(boardId).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(BOARD_IDS)('%s: setiap pin sinyal (digital/analog/pwm) py internalNumber unik', (boardId) => {
    const signalPins = pinsForBoard(boardId).filter((p) => p.kinds.some((k) => k !== 'power' && k !== 'ground'));
    const numbers = signalPins.map((p) => p.internalNumber);
    expect(numbers.every((n) => typeof n === 'number')).toBe(true);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('Uno: 14 digital + 6 analog + 2 power + 2 ground', () => {
    const pins = pinsForBoard('uno');
    expect(pins.filter((p) => p.id.startsWith('D'))).toHaveLength(14);
    expect(pins.filter((p) => p.id.startsWith('A'))).toHaveLength(6);
    expect(pins.filter((p) => p.kinds.includes('power'))).toHaveLength(2);
    expect(pins.filter((p) => p.kinds.includes('ground'))).toHaveLength(2);
  });

  it('Uno: A0 = internalNumber 14 (konvensi resmi AVR)', () => {
    expect(findPinById('uno', 'A0')?.internalNumber).toBe(14);
  });

  it('ESP32: pin input-only (34/35/36/39) TIDAK ditandai bisa digital/pwm output', () => {
    for (const id of ['GPIO34', 'GPIO35', 'GPIO36', 'GPIO39']) {
      const pin = findPinById('esp32', id);
      expect(pin?.kinds).toEqual(['analog']);
    }
  });

  it('ESP32: GPIO umum (mis. GPIO2) mendukung digital & pwm', () => {
    const pin = findPinById('esp32', 'GPIO2');
    expect(pin?.kinds).toContain('digital');
    expect(pin?.kinds).toContain('pwm');
  });

  it('ESP32: TIDAK menyertakan GPIO6-11 (flash internal) atau GPIO1/3 (USB-Serial)', () => {
    const ids = pinsForBoard('esp32').map((p) => p.id);
    for (const n of [1, 3, 6, 7, 8, 9, 10, 11]) {
      expect(ids).not.toContain(`GPIO${n}`);
    }
  });

  it('ESP8266: label D0-D8 dipetakan ke nomor GPIO asli (bukan 0-8 apa adanya)', () => {
    // Pemetaan resmi board NodeMCU 1.0 -- salah satu saja ketukar, wiring siswa salah semua.
    expect(findPinById('esp8266', 'D0')?.internalNumber).toBe(16);
    expect(findPinById('esp8266', 'D1')?.internalNumber).toBe(5);
    expect(findPinById('esp8266', 'D2')?.internalNumber).toBe(4);
    expect(findPinById('esp8266', 'D3')?.internalNumber).toBe(0);
    expect(findPinById('esp8266', 'D4')?.internalNumber).toBe(2);
    expect(findPinById('esp8266', 'D5')?.internalNumber).toBe(14);
    expect(findPinById('esp8266', 'D6')?.internalNumber).toBe(12);
    expect(findPinById('esp8266', 'D7')?.internalNumber).toBe(13);
    expect(findPinById('esp8266', 'D8')?.internalNumber).toBe(15);
  });

  it('ESP8266: D0 (GPIO16) TIDAK mendukung PWM (keterbatasan hardware asli)', () => {
    expect(findPinById('esp8266', 'D0')?.kinds).toEqual(['digital']);
  });

  it('ESP8266: cuma 1 pin analog (A0)', () => {
    expect(pinsForBoard('esp8266').filter((p) => p.kinds.includes('analog'))).toHaveLength(1);
  });
});

describe('findPinByInternalNumber', () => {
  it('nomor yang sama menunjuk ke pin FISIK yang berbeda tergantung board', () => {
    // internalNumber 2 = D2 di Uno, tapi = GPIO2 (label D4!) di ESP8266 -- inilah
    // sebabnya ganti board wajib menghapus wiring lama (lihat boardStore.test.ts).
    expect(findPinByInternalNumber('uno', 2)?.id).toBe('D2');
    expect(findPinByInternalNumber('esp8266', 2)?.id).toBe('D4');
    expect(findPinByInternalNumber('esp32', 2)?.id).toBe('GPIO2');
  });

  it('mengembalikan undefined untuk nomor yang tidak ada di board itu', () => {
    expect(findPinByInternalNumber('esp8266', 99)).toBeUndefined();
  });
});
