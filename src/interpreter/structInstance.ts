/**
 * Nilai runtime untuk struct buatan user. Field disimpan sebagai peta nama -> nilai.
 * Port 1:1 dari `struct_instance.dart`.
 */

/** Definisi satu field struct yang sudah "dimasak" (ukuran array sudah dievaluasi menjadi number). */
export class RuntimeStructField {
  readonly type: string;
  readonly name: string;
  /** Ukuran array (undefined = skalar). */
  readonly arraySize?: number;

  constructor(type: string, name: string, arraySize?: number) {
    this.type = type;
    this.name = name;
    this.arraySize = arraySize;
  }
}

/** Instance struct saat runtime, misal hasil `Point p;`. */
export class StructInstance {
  /** Nama tipe struct-nya (untuk pesan error & coercion). */
  readonly typeName: string;
  readonly fields: Map<string, unknown>;

  constructor(typeName: string, fields: Map<string, unknown>) {
    this.typeName = typeName;
    this.fields = fields;
  }

  toString(): string {
    const entries = Array.from(this.fields.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return `${this.typeName}{${entries}}`;
  }
}
