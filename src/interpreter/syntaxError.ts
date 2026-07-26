/**
 * Error sintaks dengan informasi nomor baris. Port 1:1 dari `syntax_error.dart`.
 * Dinamai `ArduinoSyntaxError` (bukan `SyntaxError`) agar tidak menabrak/shadow
 * kelas bawaan JavaScript `SyntaxError` dan membingungkan saat instanceof-check.
 *
 * Contoh pesan: "Line 10: Missing ','"
 */
export class ArduinoSyntaxError extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(`Line ${line}: ${message}`);
    this.name = 'ArduinoSyntaxError';
    this.line = line;
  }
}
