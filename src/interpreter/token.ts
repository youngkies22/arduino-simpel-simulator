/**
 * Definisi jenis token dan kelas Token hasil proses lexer.
 * Port 1:1 dari `token.dart`.
 */

export type TokenType =
  // ----- Literal -----
  | 'intLiteral'
  | 'floatLiteral'
  | 'stringLiteral'
  | 'charLiteral'
  // ----- Identifier & keyword -----
  | 'identifier'
  | 'keyword'
  | 'type'
  // ----- Operator aritmatika -----
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'percent'
  | 'plusPlus'
  | 'minusMinus'
  // ----- Operator penugasan -----
  | 'assign'
  | 'plusAssign'
  | 'minusAssign'
  | 'starAssign'
  | 'slashAssign'
  | 'percentAssign'
  // ----- Operator perbandingan -----
  | 'equal'
  | 'notEqual'
  | 'greater'
  | 'less'
  | 'greaterEqual'
  | 'lessEqual'
  // ----- Operator logika -----
  | 'and'
  | 'or'
  | 'not'
  // ----- Operator bitwise -----
  | 'bitAnd'
  | 'bitOr'
  | 'bitXor'
  | 'bitNot'
  | 'shiftLeft'
  | 'shiftRight'
  // ----- Tanda baca -----
  | 'leftParen'
  | 'rightParen'
  | 'leftBrace'
  | 'rightBrace'
  | 'leftBracket'
  | 'rightBracket'
  | 'semicolon'
  | 'comma'
  | 'dot'
  | 'colon'
  | 'question'
  // ----- Penanda akhir input -----
  | 'eof';

import type { ArduinoFloat } from './arduinoFloat';

/**
 * Nilai literal yang sudah dikonversi. Literal float memakai ArduinoFloat
 * (bukan number polos) sejak dari lexer — satu-satunya cara mempertahankan
 * beda int/float ala Dart untuk `5` vs `5.0`, karena JS number tidak bisa
 * membedakan keduanya begitu nilai dibuat (lihat arduinoFloat.ts).
 */
export type TokenLiteral = number | string | ArduinoFloat | undefined;

/** Satu token hasil pemindaian source code. */
export class Token {
  readonly type: TokenType;
  /** Teks asli token pada source code (lexeme). */
  readonly lexeme: string;
  /** Nilai literal yang sudah dikonversi (int/double/String), jika ada. */
  readonly literal: TokenLiteral;
  /** Nomor baris tempat token berada (mulai dari 1). */
  readonly line: number;

  constructor(opts: { type: TokenType; lexeme: string; line: number; literal?: TokenLiteral }) {
    this.type = opts.type;
    this.lexeme = opts.lexeme;
    this.line = opts.line;
    this.literal = opts.literal;
  }

  toString(): string {
    return `Token(${this.type}, "${this.lexeme}", line ${this.line})`;
  }
}
