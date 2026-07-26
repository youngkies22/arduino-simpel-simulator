/**
 * Hardware Abstraction Layer (HAL): kontrak antara interpreter dan simulator.
 * Interpreter tidak tahu-menahu soal UI/canvas — ia hanya memanggil method
 * di interface ini. Port 1:1 dari `hardware_interface.dart` proyek Flutter lama.
 */

/** 0=INPUT, 1=OUTPUT, 2=INPUT_PULLUP */
export type PinMode = 0 | 1 | 2;
/** 0=LOW, 1=HIGH */
export type DigitalValue = 0 | 1;

export interface HardwareInterface {
  // ----- Pin digital & analog -----
  pinMode(pin: number, mode: PinMode): void;
  digitalWrite(pin: number, value: DigitalValue): void;
  /** Mengembalikan 0 atau 1. */
  digitalRead(pin: number): DigitalValue;
  /** Mengembalikan 0..1023. */
  analogRead(pin: number): number;
  /** PWM 0..255. */
  analogWrite(pin: number, value: number): void;

  // ----- Servo -----
  /** Menggerakkan servo pada pin ke angle derajat (0..180). */
  servoWrite(pin: number, angle: number): void;
  servoDetach(pin: number): void;

  // ----- Buzzer -----
  tone(pin: number, frequency: number, durationMs?: number): void;
  noTone(pin: number): void;

  // ----- LCD 16x2 -----
  lcdBegin(cols: number, rows: number): void;
  lcdPrint(text: string): void;
  lcdClear(): void;
  lcdSetCursor(col: number, row: number): void;

  // ----- Serial -----
  serialBegin(baud: number): void;
  serialPrint(text: string): void;
  serialPrintln(text: string): void;
  /** Jumlah byte input yang belum dibaca. */
  serialAvailable(): number;
  /** Ambil satu byte input (-1 jika kosong). */
  serialRead(): number;
  /** Lihat byte berikutnya tanpa mengambil (-1 jika kosong). */
  serialPeek(): number;

  // ----- Sensor virtual -----
  /** Suhu virtual (slider DHT) dalam °C. */
  readTemperature(): number;
  /** Kelembapan virtual (slider DHT) dalam %. */
  readHumidity(): number;
  /** Durasi echo ultrasonic (mikrodetik) = jarak_cm * 58. */
  pulseIn(pin: number, state: DigitalValue): number;

  // ----- Shift register & stepper -----
  shiftOut(dataPin: number, clockPin: number, bitOrder: number, value: number): void;
  /** steps negatif = mundur. */
  stepperStep(steps: number, stepsPerRevolution: number): void;

  // ----- RFID RC522 virtual -----
  /** true satu kali tiap kartu "ditempelkan" (one-shot, meniru PICC_IsNewCardPresent). */
  rfidNewCardPresent(): boolean;
  /** UID (4 byte) kartu virtual yang sedang ditempelkan. */
  rfidUid(): number[];
}
