import { describe, expect, it } from 'vitest';
import type { PinBinding } from '../../canvas/resolvePinMapping';
import { ArduinoInterpreter } from '../../interpreter/arduinoInterpreter';
import type { ModuleRuntimeHandlers, ModuleRuntimeRegistry } from '../wiringAwareController';
import { WiringAwareController } from '../wiringAwareController';

class FakeLedRegistry implements ModuleRuntimeRegistry {
  readonly writes: boolean[] = [];
  private readonly handlers: ModuleRuntimeHandlers = {
    onDigitalWrite: (_instanceId, value) => this.writes.push(value === 1),
  };
  handlersFor(moduleId: string): ModuleRuntimeHandlers | undefined {
    return moduleId === 'led' ? this.handlers : undefined;
  }
}

describe('WiringAwareController (integrasi end-to-end tanpa UI)', () => {
  it('LED yang disambung ke D13 menyala saat sketch digitalWrite(13, HIGH)', async () => {
    const pinMap = new Map<string, PinBinding>([['D13', { moduleInstanceId: 'led-1', moduleId: 'led', portId: 'anode' }]]);
    const registry = new FakeLedRegistry();
    const hardware = new WiringAwareController(pinMap, 'uno', registry);
    const interpreter = new ArduinoInterpreter(hardware);

    const runPromise = interpreter.run(`
      void setup(){ pinMode(13, OUTPUT); digitalWrite(13, HIGH); }
      void loop(){ delay(10000); }
    `);
    await new Promise((r) => setTimeout(r, 30));
    interpreter.stop();
    await runPromise;

    expect(registry.writes).toContain(true);
  }, 10000);

  it('verifikasi kunci: memindah kabel LED dari D13 ke D9 (dan sketch memakai pin 9) tetap berfungsi', async () => {
    const registry = new FakeLedRegistry();

    const pinMap = new Map<string, PinBinding>([['D9', { moduleInstanceId: 'led-1', moduleId: 'led', portId: 'anode' }]]);
    const hardware = new WiringAwareController(pinMap, 'uno', registry);
    const interpreter = new ArduinoInterpreter(hardware);

    const runPromise = interpreter.run(`
      void setup(){ pinMode(9, OUTPUT); digitalWrite(9, HIGH); }
      void loop(){ delay(10000); }
    `);
    await new Promise((r) => setTimeout(r, 30));
    interpreter.stop();
    await runPromise;

    expect(registry.writes).toContain(true);
  }, 10000);

  it('pin yang tidak disambung modul apapun tidak melempar error (aman seperti pin dangling)', async () => {
    const registry = new FakeLedRegistry();
    const hardware = new WiringAwareController(new Map(), 'uno', registry);
    const interpreter = new ArduinoInterpreter(hardware);

    const runPromise = interpreter.run(`
      void setup(){ pinMode(13, OUTPUT); digitalWrite(13, HIGH); }
      void loop(){ delay(10000); }
    `);
    await new Promise((r) => setTimeout(r, 30));
    interpreter.stop();
    await expect(runPromise).resolves.toBeUndefined();
  }, 10000);
});
