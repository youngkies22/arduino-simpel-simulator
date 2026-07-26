import { buttonModule } from './button/definition';
import { buzzerModule } from './buzzer/definition';
import { dhtModule } from './dht/definition';
import { ldrModule } from './ldr/definition';
import { lcdModule, lcdI2cModule } from './lcd/definition';
import { ledModule } from './led/definition';
import { pirModule } from './pir/definition';
import { potModule } from './pot/definition';
import { relayModule } from './relay/definition';
import { rfidModule } from './rfid/definition';
import { rgbModule } from './rgb/definition';
import { servoModule } from './servo/definition';
import { shiftRegisterModule } from './shiftRegister/definition';
import { stepperModule } from './stepper/definition';
import { toggleModule } from './toggle/definition';
import type { ModuleDefinition } from './types';
import { ultrasonicModule } from './ultrasonic/definition';

/**
 * Registry menyimpan modul dengan TState yang berbeda-beda per modul (LED
 * punya LedState, servo punya ServoState, dst) — heterogen secara desain,
 * jadi dipakai `ModuleDefinition<any>` di sini secara sengaja (bukan
 * kelalaian tipe). Tiap modul individual tetap type-safe penuh di file
 * definition.ts masing-masing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModuleDefinition = ModuleDefinition<any>;

/** Daftar semua part yang tersedia di palet kanvas. */
export const MODULE_REGISTRY: AnyModuleDefinition[] = [
  ledModule,
  buttonModule,
  buzzerModule,
  toggleModule,
  pirModule,
  rgbModule,
  potModule,
  ldrModule,
  dhtModule,
  ultrasonicModule,
  servoModule,
  stepperModule,
  relayModule,
  rfidModule,
  shiftRegisterModule,
  lcdModule,
  lcdI2cModule,
];

const byId = new Map<string, AnyModuleDefinition>(MODULE_REGISTRY.map((def) => [def.id, def]));

export function getModuleDefinition(moduleId: string): AnyModuleDefinition | undefined {
  return byId.get(moduleId);
}
