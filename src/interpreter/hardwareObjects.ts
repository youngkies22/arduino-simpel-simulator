/**
 * Representasi runtime dari objek hardware yang dideklarasikan user di sketch:
 * Servo, LiquidCrystal, Serial, dst. Method-methodnya di-dispatch oleh interpreter.
 * Port 1:1 dari `hardware_objects.dart`.
 */

/** Instance runtime dari `Servo` yang dibuat user (contoh: `Servo myservo;`). */
export class ServoInstance {
  /** Pin tempat servo ter-attach (undefined = belum attach). */
  pin?: number;
  /** Sudut terakhir yang ditulis (0..180). */
  angle = 0;
}

/** Instance runtime dari `LiquidCrystal lcd(rs, en, d4, d5, d6, d7);`. */
export class LcdInstance {
  readonly pins: number[];
  constructor(pins: number[]) {
    this.pins = pins;
  }
}

/** Objek marker untuk `Serial` (satu-satunya instance global). */
export class SerialInstance {
  /** Baud rate dari Serial.begin(); 0 berarti belum dipanggil. */
  baudRate = 0;
}

/** EEPROM virtual 1024 byte. Isinya statis (bertahan antar Run, module-scope singleton). */
export class EepromInstance {
  static readonly size = 1024;
  static readonly bytes: number[] = new Array(EepromInstance.size).fill(0);
  static readonly objects = new Map<number, unknown>();
}

/** Instance `DHT dht(pin, DHT11);` — sensor suhu & kelembapan virtual. */
export class DhtInstance {
  readonly pin: number;
  /** 11 = DHT11, 22 = DHT22. */
  readonly type: number;
  constructor(pin: number, type: number) {
    this.pin = pin;
    this.type = type;
  }
}

/** Instance `Stepper stepper(stepsPerRev, in1, in2, in3, in4);`. */
export class StepperInstance {
  readonly stepsPerRevolution: number;
  /** Kecepatan (RPM) dari setSpeed() — hanya informatif di simulator. */
  rpm = 0;
  constructor(stepsPerRevolution: number) {
    this.stepsPerRevolution = stepsPerRevolution;
  }
}

/**
 * Instance `MFRC522 rfid(SS_PIN, RST_PIN);` — pembaca RFID virtual.
 * Kartu "ditempelkan" lewat panel simulator; UID dapat dibaca lewat
 * `rfid.uid.uidByte[i]` atau `rfid.getUidString()`.
 */
export class RfidInstance {
  /** UID kartu terakhir yang berhasil dibaca (4 byte), kosong sebelum ada kartu. */
  uid: number[] = [];

  /** UID sebagai teks hex, mis. "A3 5F 01 9C". */
  get uidString(): string {
    return this.uid.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }
}

/** Objek marker untuk `Wire` (I2C virtual — semua operasi no-op). */
export class WireInstance {}

/** Objek marker untuk `SPI` (SPI virtual — transfer() selalu 0). */
export class SpiInstance {}
