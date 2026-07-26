import { beforeEach, describe, expect, it } from 'vitest';
import { useSerialStore } from '../serialStore';

const store = () => useSerialStore.getState();

beforeEach(() => {
  store().reset();
});

describe('pengumpulan data Serial Plotter', () => {
  it('merakit satu baris dari beberapa print() — idiom Arduino yang lazim', () => {
    // Persis seperti public/examples/18_serial_plotter.ino.
    store().print('12.5');
    store().print(',');
    store().println('-3');

    expect(store().plotSamples).toEqual([[12.5, -3]]);
  });

  it('memisah kolom dengan spasi maupun tab', () => {
    store().println('1 2\t3');
    expect(store().plotSamples).toEqual([[1, 2, 3]]);
  });

  it('mengabaikan baris yang mengandung teks, bukan angka saja', () => {
    store().println('Suhu: 30');
    store().println('30');

    expect(store().plotSamples).toEqual([[30]]);
  });

  it('belum memanen apa pun sebelum baris diakhiri newline', () => {
    store().print('42');
    expect(store().plotSamples).toEqual([]);

    store().println('');
    expect(store().plotSamples).toEqual([[42]]);
  });

  it('memanen beberapa baris sekaligus dari satu print bernewline banyak', () => {
    store().print('1\n2\n3\n');
    expect(store().plotSamples).toEqual([[1], [2], [3]]);
  });

  it('reset & clear membuang data plotter dan potongan baris yang menggantung', () => {
    store().print('99');
    store().clearBuffer();
    store().println('');

    // '99' harus ikut terbuang saat clear, bukan nempel ke baris berikutnya.
    expect(store().plotSamples).toEqual([]);
  });
});
