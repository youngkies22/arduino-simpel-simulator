import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'vitest';
import { ArduinoInterpreter } from '../arduinoInterpreter';
import { TestHardware } from './testHardware';

const EXAMPLES_DIR = join(__dirname, '../../../public/examples');
const files: string[] = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.ino'));

describe('examples run smoke test (setup + awal loop, bukan cuma parse)', () => {
  it.each(files)('%s: run() sampai setup() + mulai loop() tanpa RuntimeError', async (file: string) => {
    const source = readFileSync(join(EXAMPLES_DIR, file), 'utf-8');
    const hw = new TestHardware();
    const interp = new ArduinoInterpreter(hw);

    const runPromise = interp.run(source);
    await new Promise((r) => setTimeout(r, 60));
    interp.stop();
    await runPromise; // Melempar jika ada RuntimeError/SyntaxError yang tak tertangani.
  }, 15000);
});
