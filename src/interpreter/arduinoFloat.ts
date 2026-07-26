/**
 * Dart membedakan `int` dan `double` sebagai tipe runtime yang berbeda meski
 * nilainya sama (5 vs 5.0) — pembagian int/int melakukan truncating division,
 * int/double menghasilkan double, dan Serial.print(float) tampil "5.00"
 * sedangkan Serial.print(int) tampil "5". JavaScript/TypeScript hanya punya
 * satu tipe `number`, jadi perbedaan itu HILANG begitu saja (5.0 === 5).
 *
 * ArduinoFloat adalah pembungkus tipis untuk merepresentasikan "double" ala
 * Dart di runtime interpreter ini. Nilai `number` polos merepresentasikan
 * "int". Semua operasi aritmatika & konversi di arduinoInterpreter.ts sengaja
 * mempertahankan pembungkus ini agar semantik sketch Arduino (int vs float)
 * tetap identik dengan versi Flutter/Dart.
 */
export class ArduinoFloat {
  readonly value: number;
  constructor(value: number) {
    this.value = value;
  }
}

/** Nilai numerik runtime: int (number polos) atau float (ArduinoFloat). */
export type ArduinoNum = number | ArduinoFloat;

export function mkFloat(n: number): ArduinoFloat {
  return new ArduinoFloat(n);
}

export function isFloatTyped(v: unknown): v is ArduinoFloat {
  return v instanceof ArduinoFloat;
}

/** Ambil nilai number mentah dari ArduinoNum, tanpa peduli int/float. */
export function rawNum(v: ArduinoNum): number {
  return v instanceof ArduinoFloat ? v.value : v;
}
