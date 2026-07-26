/**
 * Exception internal untuk mengalirkan kontrol program (break, continue,
 * return, dan stop dari user). Pola standar tree-walking interpreter.
 * Port 1:1 dari `control_flow.dart`.
 */

/** Dilempar saat menemui `break;` — ditangkap oleh loop/switch terdekat. */
export class BreakSignal extends Error {}

/** Dilempar saat menemui `continue;` — ditangkap oleh loop terdekat. */
export class ContinueSignal extends Error {}

/** Dilempar saat menemui `return;` — ditangkap oleh pemanggil fungsi. */
export class ReturnSignal extends Error {
  readonly value: unknown;
  constructor(value: unknown) {
    super();
    this.value = value;
  }
}

/** Dilempar ketika user menekan tombol Stop — menghentikan eksekusi di titik manapun. */
export class StopSignal extends Error {}
