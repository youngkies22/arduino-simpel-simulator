import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ArduinoParser } from '../arduinoParser';
import { Lexer } from '../lexer';
import { collectDefines, expandMacros } from '../preprocessor';

const EXAMPLES_DIR = join(__dirname, '../../../public/examples');

const files: string[] = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.ino'));

describe('examples smoke test', () => {
  it('menemukan 26 file contoh .ino', () => {
    expect(files.length).toBe(26);
  });

  it.each(files)('lex + preprocess + parse %s tanpa exception', (file: string) => {
    const source = readFileSync(join(EXAMPLES_DIR, file), 'utf-8');
    const defines = collectDefines(source);
    const tokens = expandMacros(new Lexer(source).tokenize(), defines);
    const program = new ArduinoParser(tokens).parseProgram();
    expect(program.declarations.length).toBeGreaterThan(0);
  });
});
