import { describe, expect, it } from 'vitest';
import { ArduinoInterpreter } from '../arduinoInterpreter';
import { TestHardware } from './testHardware';

describe('ArduinoInterpreter - eksekusi dasar', () => {
  it('blink LED: urutan pinMode & digitalWrite benar', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw);
    const source = `
      void setup(){ pinMode(13, OUTPUT); }
      void loop(){
        digitalWrite(13, HIGH);
        delay(50);
        digitalWrite(13, LOW);
        delay(50);
      }
    `;
    const runPromise = interp.run(source);
    await new Promise((r) => setTimeout(r, 180));
    interp.stop();
    await runPromise;

    expect(hw.calls[0]).toBe('pinMode(13,1)');
    expect(hw.calls).toContain('digitalWrite(13,1)');
    expect(hw.calls).toContain('digitalWrite(13,0)');
  }, 10000);

  it('stop() menghentikan delay panjang dengan cepat (<500ms walau delay(10000))', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw);
    const source = `
      void setup(){}
      void loop(){ delay(10000); }
    `;
    const runPromise = interp.run(source);
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 50));
    interp.stop();
    await runPromise;
    expect(Date.now() - start).toBeLessThan(500);
  }, 10000);

  it('melempar error untuk variabel undefined', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw);
    const source = `
      void setup(){}
      void loop(){ int x = y + 1; }
    `;
    await expect(interp.run(source)).rejects.toThrow(/Undefined variable/);
  });

  it('int/float terpisah: 5/2 == 2 (integer division), 5.0/2 == 2.5', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw);
    const source = `
      void setup(){
        int a = 5 / 2;
        float b = 5.0 / 2;
        Serial.begin(9600);
        Serial.println(a);
        Serial.println(b);
      }
      void loop(){ delay(10000); }
    `;
    const runPromise = interp.run(source);
    await new Promise((r) => setTimeout(r, 30));
    interp.stop();
    await runPromise;
    expect(hw.serialOut).toContain('2\n');
    expect(hw.serialOut).toContain('2.50\n');
  }, 10000);

  it('for-loop + array 1D berjalan benar', async () => {
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw);
    const source = `
      void setup(){
        int arr[3] = {10, 20, 30};
        int sum = 0;
        for (int i = 0; i < 3; i++) {
          sum += arr[i];
        }
        Serial.begin(9600);
        Serial.println(sum);
      }
      void loop(){ delay(10000); }
    `;
    const runPromise = interp.run(source);
    await new Promise((r) => setTimeout(r, 30));
    interp.stop();
    await runPromise;
    expect(hw.serialOut).toContain('60\n');
  }, 10000);
});
