import { describe, expect, it } from 'vitest';
import { ArduinoInterpreter } from '../arduinoInterpreter';
import { TestHardware } from './testHardware';

/** setup() lalu loop() tanpa henti sampai stop() dipanggil -- run() TIDAK BOLEH di-await
 * duluan (baru akan resolve setelah stop), jadi panggil stop() setelah jeda singkat,
 * BARU await promise-nya. Pola yang sama dipakai wiringAwareController.test.ts. */
async function runBriefly(interp: ArduinoInterpreter, source: string): Promise<void> {
  const runPromise = interp.run(source);
  await new Promise((r) => setTimeout(r, 30));
  interp.stop();
  await runPromise;
}

/**
 * LED_BUILTIN & A0..A5 BUKAN detail kosmetik — nilainya harus persis cocok dengan
 * boardPinLayout.ts, kalau tidak `digitalWrite(LED_BUILTIN, HIGH)` di sketch siswa
 * akan menyalakan pin yang salah (atau pin yang tidak ada sama sekali) dibanding yang
 * tersambung di kanvas untuk board itu.
 */
describe('konstanta LED_BUILTIN/A0..A5 per board', () => {
  it('Uno: LED_BUILTIN=13, A0..A5=14..19', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw, 'uno');
    await runBriefly(
      interp,
      `
      void setup() {
        pinMode(LED_BUILTIN, OUTPUT);
        digitalWrite(LED_BUILTIN, HIGH);
        analogRead(A0);
        analogRead(A5);
      }
      void loop() { delay(100000); }
    `,
    );

    expect(hw.calls).toContain('pinMode(13,1)');
    expect(hw.calls).toContain('digitalWrite(13,1)');
  }, 10000);

  it('ESP32: LED_BUILTIN=2', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw, 'esp32');
    await runBriefly(
      interp,
      `
      void setup() {
        pinMode(LED_BUILTIN, OUTPUT);
        digitalWrite(LED_BUILTIN, HIGH);
      }
      void loop() { delay(100000); }
    `,
    );
    expect(hw.calls).toContain('pinMode(2,1)');
  }, 10000);

  it('ESP32: A0 TIDAK didefinisikan (lempar error yang jelas, bukan nilai ngawur hasil tebakan)', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw, 'esp32');
    await expect(
      interp.run(`
        void setup() { analogRead(A0); }
        void loop() {}
      `),
    ).rejects.toThrow(/A0/);
  });

  it('ESP8266: LED_BUILTIN=2, A0=17 (definisi resmi core esp8266)', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw, 'esp8266');
    await runBriefly(
      interp,
      `
      void setup() {
        pinMode(LED_BUILTIN, OUTPUT);
        digitalWrite(LED_BUILTIN, HIGH);
        analogRead(A0);
      }
      void loop() { delay(100000); }
    `,
    );

    expect(hw.calls).toContain('pinMode(2,1)');
    expect(hw.calls).toContain('digitalWrite(2,1)');
  }, 10000);

  it('board default (tidak diisi) tetap Uno -- tidak mengubah perilaku kode lama yang belum di-update', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw); // tanpa argumen boardId kedua
    await runBriefly(
      interp,
      `
      void setup() { pinMode(LED_BUILTIN, OUTPUT); }
      void loop() { delay(100000); }
    `,
    );
    expect(hw.calls).toContain('pinMode(13,1)');
  }, 10000);
});
