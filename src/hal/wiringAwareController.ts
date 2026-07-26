/**
 * Implementasi HardwareInterface yang me-resolve modul dari hasil wiring
 * dinamis di kanvas (pinMap), BUKAN dari pin hardcoded seperti
 * `SimulatorController` di proyek Flutter lama.
 *
 * Method pin-keyed (digitalWrite, analogRead, servoWrite, shiftOut, dst)
 * mencari modul yang tersambung ke pin tsb lewat pinMap, lalu dispatch ke
 * ModuleRuntimeHandlers modul itu — pola dispatch table per modul (didaftarkan
 * lewat registry), bukan if/else panjang per jenis modul di sini. `portId`
 * ikut diteruskan supaya modul multi-port (mis. RGB LED punya port
 * red/green/blue) tahu port mana yang menerima efek.
 *
 * Method non-pin-keyed (readTemperature/Humidity, lcd*, stepperStep, rfid*)
 * — di HAL Dart lama pun sudah global tanpa argumen pin (mis.
 * `hardware.readTemperature()` tidak tahu DHT yang mana; ini simplifikasi
 * yang SUDAH ADA di app lama, bukan regresi proyek baru). Di sini di-resolve
 * lewat `findFirstBoundInstance(moduleId)`: modul tsb harus tetap disambung
 * ke SATU pin manapun di kanvas (validasi "ada di rangkaian"), tapi pin
 * spesifiknya tidak memengaruhi perilaku — sama seperti keterbatasan app lama.
 */
import type { DigitalValue, HardwareInterface, PinMode } from './hardwareInterface';
import type { BoardId } from '../boardId';
import { findPinByInternalNumber } from '../canvas/boardPinLayout';
import type { PinBinding } from '../canvas/resolvePinMapping';

/** Dua varian part LCD (paralel HD44780 & I2C backpack) berbagi HAL & state yang sama —
 * bedanya cuma jumlah pin yang perlu disambung user di kanvas. */
const LCD_MODULE_IDS = ['lcd', 'lcd-i2c'];

export interface ModuleRuntimeHandlers {
  onPinMode?(instanceId: string, pin: number, mode: PinMode, portId: string): void;
  onDigitalWrite?(instanceId: string, value: DigitalValue, portId: string): void;
  digitalRead?(instanceId: string, portId: string): DigitalValue;
  analogRead?(instanceId: string, portId: string): number;
  onAnalogWrite?(instanceId: string, value: number, portId: string): void;
  onServoWrite?(instanceId: string, angle: number, portId: string): void;
  onServoDetach?(instanceId: string, portId: string): void;
  onTone?(instanceId: string, frequency: number, durationMs: number | undefined, portId: string): void;
  onNoTone?(instanceId: string, portId: string): void;
  pulseIn?(instanceId: string, portId: string): number;
  onShiftOut?(instanceId: string, value: number, bitOrder: number, portId: string): void;
  // ----- Non-pin-keyed (lihat catatan di atas) -----
  readTemperature?(instanceId: string): number;
  readHumidity?(instanceId: string): number;
  onLcdBegin?(instanceId: string, cols: number, rows: number): void;
  onLcdPrint?(instanceId: string, text: string): void;
  onLcdClear?(instanceId: string): void;
  onLcdSetCursor?(instanceId: string, col: number, row: number): void;
  onStepperStep?(instanceId: string, steps: number, stepsPerRevolution: number): void;
  rfidNewCardPresent?(instanceId: string): boolean;
  rfidUid?(instanceId: string): number[];
}

export interface ModuleRuntimeRegistry {
  handlersFor(moduleId: string): ModuleRuntimeHandlers | undefined;
}

export interface UnconnectedPinListener {
  (pin: number, action: string): void;
}

/** Jembatan ke serialStore — dipakai agar Serial.print/println tampil di Serial Monitor. */
export interface SerialBridge {
  print(text: string): void;
  println(text: string): void;
  available(): number;
  read(): number;
  peek(): number;
}

/** Jembatan opsional ke store snapshot pin — dipakai modul "catch-all" seperti digitalPinsPanel. */
export interface PinSnapshotBridge {
  setMode(pin: number, mode: PinMode): void;
  setDigital(pin: number, value: DigitalValue): void;
  setPwm(pin: number, value: number): void;
}

export interface WiringAwareControllerOptions {
  onUnconnectedPin?: UnconnectedPinListener;
  serial?: SerialBridge;
  pinSnapshot?: PinSnapshotBridge;
}

export class WiringAwareController implements HardwareInterface {
  private readonly pinMap: Map<string, PinBinding>;
  private readonly boardId: BoardId;
  private readonly registry: ModuleRuntimeRegistry;
  private readonly onUnconnectedPin?: UnconnectedPinListener;
  private readonly serialBridge?: SerialBridge;
  private readonly pinSnapshot?: PinSnapshotBridge;
  private readonly warnedPins = new Set<string>();

  constructor(pinMap: Map<string, PinBinding>, boardId: BoardId, registry: ModuleRuntimeRegistry, options?: WiringAwareControllerOptions) {
    this.pinMap = pinMap;
    this.boardId = boardId;
    this.registry = registry;
    this.onUnconnectedPin = options?.onUnconnectedPin;
    this.serialBridge = options?.serial;
    this.pinSnapshot = options?.pinSnapshot;
  }

  private resolve(pin: number): { binding: PinBinding; handlers: ModuleRuntimeHandlers } | undefined {
    const physicalPin = findPinByInternalNumber(this.boardId, pin);
    const pinId = physicalPin?.id ?? `D${pin}`;
    const binding = this.pinMap.get(pinId);
    if (!binding) return undefined;
    const handlers = this.registry.handlersFor(binding.moduleId);
    if (!handlers) return undefined;
    return { binding, handlers };
  }

  /** Untuk method HAL non-pin-keyed: cari instance modul tsb di manapun ia disambung di kanvas.
   * Menerima beberapa moduleId sekaligus (mis. 'lcd' & 'lcd-i2c') karena satu perintah HAL
   * (mis. lcdPrint) bisa jadi dilayani beberapa varian part yang berbeda wiring-nya saja. */
  private findFirstBoundInstance(moduleIds: string | string[]): { instanceId: string; handlers: ModuleRuntimeHandlers } | undefined {
    const ids = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
    for (const binding of this.pinMap.values()) {
      if (ids.includes(binding.moduleId)) {
        const handlers = this.registry.handlersFor(binding.moduleId);
        if (handlers) return { instanceId: binding.moduleInstanceId, handlers };
      }
    }
    return undefined;
  }

  private reportUnconnected(pin: number, action: string): void {
    const key = `${pin}:${action}`;
    if (this.warnedPins.has(key)) return;
    this.warnedPins.add(key);
    this.onUnconnectedPin?.(pin, action);
  }

  pinMode(pin: number, mode: PinMode): void {
    this.pinSnapshot?.setMode(pin, mode);
    const r = this.resolve(pin);
    if (!r) return; // Pin dangling: aman, tidak crash (meniru hardware nyata).
    r.handlers.onPinMode?.(r.binding.moduleInstanceId, pin, mode, r.binding.portId);
  }

  digitalWrite(pin: number, value: DigitalValue): void {
    this.pinSnapshot?.setDigital(pin, value);
    const r = this.resolve(pin);
    if (!r) {
      this.reportUnconnected(pin, 'digitalWrite');
      return;
    }
    r.handlers.onDigitalWrite?.(r.binding.moduleInstanceId, value, r.binding.portId);
  }

  digitalRead(pin: number): DigitalValue {
    const r = this.resolve(pin);
    if (!r?.handlers.digitalRead) return 0;
    return r.handlers.digitalRead(r.binding.moduleInstanceId, r.binding.portId);
  }

  analogRead(pin: number): number {
    const r = this.resolve(pin);
    if (!r?.handlers.analogRead) return 0;
    return r.handlers.analogRead(r.binding.moduleInstanceId, r.binding.portId);
  }

  analogWrite(pin: number, value: number): void {
    this.pinSnapshot?.setPwm(pin, value);
    const r = this.resolve(pin);
    if (!r) {
      this.reportUnconnected(pin, 'analogWrite');
      return;
    }
    r.handlers.onAnalogWrite?.(r.binding.moduleInstanceId, value, r.binding.portId);
  }

  servoWrite(pin: number, angle: number): void {
    const r = this.resolve(pin);
    if (!r) {
      this.reportUnconnected(pin, 'servoWrite');
      return;
    }
    r.handlers.onServoWrite?.(r.binding.moduleInstanceId, angle, r.binding.portId);
  }

  servoDetach(pin: number): void {
    const r = this.resolve(pin);
    r?.handlers.onServoDetach?.(r.binding.moduleInstanceId, r.binding.portId);
  }

  tone(pin: number, frequency: number, durationMs?: number): void {
    const r = this.resolve(pin);
    if (!r) {
      this.reportUnconnected(pin, 'tone');
      return;
    }
    r.handlers.onTone?.(r.binding.moduleInstanceId, frequency, durationMs, r.binding.portId);
  }

  noTone(pin: number): void {
    const r = this.resolve(pin);
    r?.handlers.onNoTone?.(r.binding.moduleInstanceId, r.binding.portId);
  }

  pulseIn(pin: number, _state: DigitalValue): number {
    const r = this.resolve(pin);
    if (!r?.handlers.pulseIn) return 0;
    return r.handlers.pulseIn(r.binding.moduleInstanceId, r.binding.portId);
  }

  shiftOut(dataPin: number, _clockPin: number, bitOrder: number, value: number): void {
    const r = this.resolve(dataPin);
    if (!r) {
      this.reportUnconnected(dataPin, 'shiftOut');
      return;
    }
    r.handlers.onShiftOut?.(r.binding.moduleInstanceId, value, bitOrder, r.binding.portId);
  }

  // ----- Serial: diteruskan ke serialStore lewat SerialBridge -----
  serialBegin(_baud: number): void {}
  serialPrint(text: string): void {
    this.serialBridge?.print(text);
  }
  serialPrintln(text: string): void {
    this.serialBridge?.println(text);
  }
  serialAvailable(): number {
    return this.serialBridge?.available() ?? 0;
  }
  serialRead(): number {
    return this.serialBridge?.read() ?? -1;
  }
  serialPeek(): number {
    return this.serialBridge?.peek() ?? -1;
  }

  // ----- Non-pin-keyed: DHT, LCD, Stepper, RFID -----
  stepperStep(steps: number, stepsPerRevolution: number): void {
    const r = this.findFirstBoundInstance('stepper');
    r?.handlers.onStepperStep?.(r.instanceId, steps, stepsPerRevolution);
  }
  lcdBegin(cols: number, rows: number): void {
    const r = this.findFirstBoundInstance(LCD_MODULE_IDS);
    r?.handlers.onLcdBegin?.(r.instanceId, cols, rows);
  }
  lcdPrint(text: string): void {
    const r = this.findFirstBoundInstance(LCD_MODULE_IDS);
    r?.handlers.onLcdPrint?.(r.instanceId, text);
  }
  lcdClear(): void {
    const r = this.findFirstBoundInstance(LCD_MODULE_IDS);
    r?.handlers.onLcdClear?.(r.instanceId);
  }
  lcdSetCursor(col: number, row: number): void {
    const r = this.findFirstBoundInstance(LCD_MODULE_IDS);
    r?.handlers.onLcdSetCursor?.(r.instanceId, col, row);
  }
  readTemperature(): number {
    const r = this.findFirstBoundInstance('dht');
    return r?.handlers.readTemperature?.(r.instanceId) ?? 25;
  }
  readHumidity(): number {
    const r = this.findFirstBoundInstance('dht');
    return r?.handlers.readHumidity?.(r.instanceId) ?? 50;
  }
  rfidNewCardPresent(): boolean {
    const r = this.findFirstBoundInstance('rfid');
    return r?.handlers.rfidNewCardPresent?.(r.instanceId) ?? false;
  }
  rfidUid(): number[] {
    const r = this.findFirstBoundInstance('rfid');
    return r?.handlers.rfidUid?.(r.instanceId) ?? [];
  }
}
