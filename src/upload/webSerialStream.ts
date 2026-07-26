/**
 * Adaptor Web Serial API -> interface minimal yang dibutuhkan stk500Protocol.ts:
 * write(data) dan readExact(length, timeout). Semua byte masuk selalu ditampung di
 * `buffer` terlebih dulu (bukan cuma di-emit kalau ada consumer aktif) — readExact()
 * mengecek buffer itu langsung di awal ATAU menunggu lewat `waiting`, jadi tidak ada
 * celah balasan board "hilang" gara-gara belum ada yang menunggu saat data tiba.
 */
export interface Stk500Stream {
  write(data: Uint8Array): Promise<void>;
  readExact(length: number, timeoutMs: number): Promise<Uint8Array>;
}

interface PendingRead {
  length: number;
  resolve: (data: Uint8Array) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class WebSerialStream implements Stk500Stream {
  private readonly port: SerialPort;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readonly buffer: number[] = [];
  private waiting: PendingRead | null = null;
  private readLoop: Promise<void> | null = null;
  private stopping = false;

  constructor(port: SerialPort) {
    this.port = port;
  }

  /** Mulai loop baca di background — panggil sekali sebelum stream ini dipakai. */
  start(): void {
    if (!this.port.readable) throw new Error('Port serial tidak readable.');
    this.reader = this.port.readable.getReader();
    this.readLoop = this.runReadLoop();
  }

  private async runReadLoop(): Promise<void> {
    const reader = this.reader;
    if (!reader) return;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value && value.length > 0) {
          for (const byte of value) this.buffer.push(byte);
          this.resolveWaitingIfReady();
        }
      }
    } catch (err) {
      if (!this.stopping) throw err;
    }
  }

  private resolveWaitingIfReady(): void {
    if (!this.waiting || this.buffer.length < this.waiting.length) return;
    const { length, resolve, timeoutId } = this.waiting;
    clearTimeout(timeoutId);
    this.waiting = null;
    resolve(new Uint8Array(this.buffer.splice(0, length)));
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port.writable) throw new Error('Port serial tidak writable.');
    this.writer ??= this.port.writable.getWriter();
    await this.writer.write(data);
  }

  readExact(length: number, timeoutMs: number): Promise<Uint8Array> {
    if (this.buffer.length >= length) {
      return Promise.resolve(new Uint8Array(this.buffer.splice(0, length)));
    }
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waiting = null;
        reject(new Error(`Timeout menunggu balasan board (butuh ${length} byte, baru dapat ${this.buffer.length}).`));
      }, timeoutMs);
      this.waiting = { length, resolve, reject, timeoutId };
    });
  }

  /** Hentikan loop baca & lepas semua lock — WAJIB dipanggil sebelum `port.close()`. */
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.waiting) {
      clearTimeout(this.waiting.timeoutId);
      this.waiting.reject(new Error('Stream dihentikan.'));
      this.waiting = null;
    }
    try {
      await this.reader?.cancel();
    } catch {
      // Port mungkin sudah putus — abaikan.
    }
    try {
      this.reader?.releaseLock();
    } catch {
      // no-op
    }
    try {
      this.writer?.releaseLock();
    } catch {
      // no-op
    }
    if (this.readLoop) {
      await this.readLoop.catch(() => {});
    }
  }
}
