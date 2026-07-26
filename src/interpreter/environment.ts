/**
 * Lingkungan (scope) penyimpanan variabel untuk interpreter.
 * Mendukung scope bersarang (global -> fungsi -> blok). Port 1:1 dari `environment.dart`.
 */
import { RuntimeError } from './runtimeError';

export class Environment {
  readonly parent?: Environment;
  private readonly values = new Map<string, unknown>();

  constructor(parent?: Environment) {
    this.parent = parent;
  }

  /** Mendefinisikan variabel baru di scope ini. Redeklarasi di scope yang sama akan menimpa. */
  define(name: string, value: unknown): void {
    this.values.set(name, value);
  }

  /** Apakah nama terdefinisi di scope ini atau leluhurnya? */
  isDefined(name: string): boolean {
    if (this.values.has(name)) return true;
    return this.parent?.isDefined(name) ?? false;
  }

  /** Mengambil nilai variabel; error jika belum dideklarasikan. */
  get(name: string, line: number): unknown {
    if (this.values.has(name)) return this.values.get(name);
    if (this.parent) return this.parent.get(name, line);
    throw new RuntimeError(line, `Undefined variable '${name}'`);
  }

  /** Mengubah nilai variabel yang sudah ada; error jika belum ada. */
  assign(name: string, value: unknown, line: number): void {
    if (this.values.has(name)) {
      this.values.set(name, value);
      return;
    }
    if (this.parent) {
      this.parent.assign(name, value, line);
      return;
    }
    throw new RuntimeError(line, `Undefined variable '${name}'`);
  }
}
