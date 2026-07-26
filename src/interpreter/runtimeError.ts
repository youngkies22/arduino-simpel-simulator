/**
 * Error runtime dengan nomor baris sumber masalah. Port 1:1 dari `runtime_error.dart`.
 * Contoh pesan: "Line 5: Undefined variable 'x'".
 */
export class RuntimeError extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(`Line ${line}: ${message}`);
    this.name = 'RuntimeError';
    this.line = line;
  }
}
