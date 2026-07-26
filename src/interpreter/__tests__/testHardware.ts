import type { DigitalValue, HardwareInterface, PinMode } from '../../hal/hardwareInterface';

/** HAL mock permisif untuk test — mencatat panggilan & mengembalikan nilai default aman. */
export class TestHardware implements HardwareInterface {
  readonly calls: string[] = [];
  readonly serialOut: string[] = [];
  private readonly pinValues = new Map<number, DigitalValue>();

  pinMode(pin: number, mode: PinMode): void {
    this.calls.push(`pinMode(${pin},${mode})`);
  }
  digitalWrite(pin: number, value: DigitalValue): void {
    this.calls.push(`digitalWrite(${pin},${value})`);
    this.pinValues.set(pin, value);
  }
  digitalRead(pin: number): DigitalValue {
    return this.pinValues.get(pin) ?? 0;
  }
  analogRead(_pin: number): number {
    return 512;
  }
  analogWrite(pin: number, value: number): void {
    this.calls.push(`analogWrite(${pin},${value})`);
  }
  servoWrite(_pin: number, _angle: number): void {}
  servoDetach(_pin: number): void {}
  tone(_pin: number, _frequency: number, _durationMs?: number): void {}
  noTone(_pin: number): void {}
  lcdBegin(_cols: number, _rows: number): void {}
  lcdPrint(_text: string): void {}
  lcdClear(): void {}
  lcdSetCursor(_col: number, _row: number): void {}
  serialBegin(_baud: number): void {}
  serialPrint(text: string): void {
    this.serialOut.push(text);
  }
  serialPrintln(text: string): void {
    this.serialOut.push(text + '\n');
  }
  serialAvailable(): number {
    return 0;
  }
  serialRead(): number {
    return -1;
  }
  serialPeek(): number {
    return -1;
  }
  readTemperature(): number {
    return 25;
  }
  readHumidity(): number {
    return 50;
  }
  pulseIn(_pin: number, _state: DigitalValue): number {
    return 1000;
  }
  shiftOut(_dataPin: number, _clockPin: number, _bitOrder: number, _value: number): void {}
  stepperStep(_steps: number, _stepsPerRevolution: number): void {}
  rfidNewCardPresent(): boolean {
    return false;
  }
  rfidUid(): number[] {
    return [];
  }
}
