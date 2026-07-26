import { compileServerUrl } from './compileServerSetting';

/** Satu segmen biner ESP32/ESP8266: alamat flash + isinya (base64, apa adanya dari server). */
export interface CompiledSegment {
  offset: number;
  dataBase64: string;
}

export interface CompileResult {
  ok: boolean;
  /** 'hex' (teks Intel HEX, AVR) atau 'esp-bin' (segmen biner ESP32/ESP8266). Tidak ada
   * kalau compile gagal (`ok: false`) — makanya opsional, bukan union diskriminasi ketat. */
  format?: 'hex' | 'esp-bin';
  hex?: string;
  segments?: CompiledSegment[];
  error?: string;
  log?: string;
}

/** Kirim kode sketch ke compile-server (arduino-cli), balikin hasil compile.
 * @param fqbn FQBN board tujuan (mis. "esp32:esp32:esp32"). Kosongkan untuk pakai
 * default server (`arduino:avr:uno`). */
export async function compileSketch(source: string, fqbn?: string): Promise<CompileResult> {
  let response: Response;
  try {
    response = await fetch(`${compileServerUrl()}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fqbn ? { source, fqbn } : { source }),
    });
  } catch {
    return { ok: false, error: 'Tidak bisa menghubungi compile server. Cek koneksi internet.' };
  }

  const data = (await response.json().catch(() => null)) as CompileResult | null;
  if (!data) {
    return { ok: false, error: `Respons compile server tidak valid (HTTP ${response.status}).` };
  }
  return data;
}
