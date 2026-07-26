/**
 * Preprocessor sederhana untuk #define (macro tanpa parameter).
 * Port 1:1 dari `preprocessor.dart`.
 *
 * Cara kerja:
 *   1. collectDefines memindai source dan mengumpulkan pasangan NAMA -> isi
 *      macro. Baris #define (dan #include) tetap dibiarkan — lexer memang
 *      melewati semua baris '#', jadi nomor baris tidak bergeser.
 *   2. expandMacros mengganti token identifier yang namanya sama dengan
 *      macro menjadi token hasil lexing isi macro. Ekspansi bersarang
 *      didukung dengan batas kedalaman agar macro melingkar tidak membuat
 *      loop tak berujung.
 */
import { Lexer } from './lexer';
import { ArduinoSyntaxError } from './syntaxError';
import { Token } from './token';

const DEFINE_PATTERN = /^\s*#\s*define\s+([A-Za-z_]\w*)\s+(.+?)\s*$/;
const FUNC_MACRO_PATTERN = /^\s*#\s*define\s+[A-Za-z_]\w*\s*\(/;

export function collectDefines(source: string): Map<string, string> {
  const defines = new Map<string, string>();
  const lines = source.split('\n');
  for (const line of lines) {
    if (FUNC_MACRO_PATTERN.test(line)) continue;
    const m = DEFINE_PATTERN.exec(line);
    if (m) {
      let body = m[2];
      const commentIndex = body.indexOf('//');
      if (commentIndex >= 0) body = body.substring(0, commentIndex).trim();
      if (body.length > 0) defines.set(m[1], body);
    }
  }
  return defines;
}

export function expandMacros(tokens: Token[], defines: Map<string, string>): Token[] {
  if (defines.size === 0) return tokens;

  let current = tokens;
  for (let depth = 0; depth < 8; depth++) {
    let changed = false;
    const result: Token[] = [];
    for (const t of current) {
      const macroBody = t.type === 'identifier' ? defines.get(t.lexeme) : undefined;
      if (macroBody !== undefined) {
        changed = true;
        let body: Token[];
        try {
          body = new Lexer(macroBody).tokenize();
        } catch {
          throw new ArduinoSyntaxError(t.line, `Invalid #define body for '${t.lexeme}'`);
        }
        for (const bt of body) {
          if (bt.type === 'eof') continue;
          result.push(new Token({ type: bt.type, lexeme: bt.lexeme, literal: bt.literal, line: t.line }));
        }
      } else {
        result.push(t);
      }
    }
    current = result;
    if (!changed) break;
  }
  return current;
}
