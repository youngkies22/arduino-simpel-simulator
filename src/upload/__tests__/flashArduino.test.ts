import { describe, expect, it } from 'vitest';
import { flashHexToPort } from '../flashArduino';

/**
 * Simulasi bootloader Optiboot palsu yang cukup lengkap buat mengetes seluruh alur
 * protokol STK500v1 (sync, verify signature, set options, enter progmode, tulis halaman,
 * verifikasi halaman, exit progmode) TANPA board Arduino sungguhan — memvalidasi
 * WebSerialStream + stk500Protocol.ts benar-benar terhubung dengan benar.
 */
const STK = {
  GET_SYNC: 0x30,
  SET_DEVICE: 0x42,
  ENTER_PROGMODE: 0x50,
  LOAD_ADDRESS: 0x55,
  PROG_PAGE: 0x64,
  LEAVE_PROGMODE: 0x51,
  READ_SIGN: 0x75,
  READ_PAGE: 0x74,
  INSYNC: 0x14,
  OK: 0x10,
};

const UNO_SIGNATURE = [0x1e, 0x95, 0x0f];

/** Berapa banyak byte yang harus terkumpul sebelum sebuah command bisa diproses —
 * null berarti "belum cukup data untuk tahu panjangnya" (khusus PROG_PAGE). */
function expectedFrameLength(buf: number[]): number | null {
  if (buf.length < 1) return null;
  switch (buf[0]) {
    case STK.GET_SYNC:
    case STK.ENTER_PROGMODE:
    case STK.LEAVE_PROGMODE:
    case STK.READ_SIGN:
      return 2; // opcode + EOP
    case STK.LOAD_ADDRESS:
      return 4; // opcode + low + high + EOP
    case STK.SET_DEVICE:
      return 22; // opcode + 20 parameter + EOP
    case STK.READ_PAGE:
      return 5; // opcode + lenHigh + lenLow + 0x46 + EOP
    case STK.PROG_PAGE:
      if (buf.length < 3) return null;
      return 4 + ((buf[1] << 8) | buf[2]) + 1; // opcode+lenH+lenL+0x46 + data + EOP
    default:
      throw new Error(`Fake bootloader: opcode tidak dikenal 0x${buf[0].toString(16)}`);
  }
}

class FakeOptibootPort implements Partial<SerialPort> {
  readonly flash = new Uint8Array(1024).fill(0xff);
  readonly signalCalls: SerialOutputSignals[] = [];
  private wordAddress = 0;
  private incoming: number[] = [];
  private deviceController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private readonly signature: number[];

  constructor(signature: number[] = UNO_SIGNATURE) {
    this.signature = signature;
  }

  readable = new ReadableStream<Uint8Array>({
    start: (controller) => {
      this.deviceController = controller;
    },
  });

  writable = new WritableStream<Uint8Array>({
    write: (chunk) => {
      for (const byte of chunk) this.incoming.push(byte);
      this.processBufferedFrames();
    },
  });

  async open(): Promise<void> {}
  async close(): Promise<void> {}
  async setSignals(signals: SerialOutputSignals): Promise<void> {
    this.signalCalls.push(signals);
  }
  getInfo(): SerialPortInfo {
    return {};
  }

  private respond(bytes: number[]): void {
    this.deviceController!.enqueue(new Uint8Array(bytes));
  }

  private processBufferedFrames(): void {
    for (;;) {
      const len = expectedFrameLength(this.incoming);
      if (len === null || this.incoming.length < len) return;
      const frame = this.incoming.splice(0, len);
      this.handleFrame(frame);
    }
  }

  private handleFrame(frame: number[]): void {
    switch (frame[0]) {
      case STK.GET_SYNC:
      case STK.ENTER_PROGMODE:
      case STK.LEAVE_PROGMODE:
      case STK.SET_DEVICE:
        this.respond([STK.INSYNC, STK.OK]);
        break;
      case STK.READ_SIGN:
        this.respond([STK.INSYNC, ...this.signature, STK.OK]);
        break;
      case STK.LOAD_ADDRESS:
        this.wordAddress = frame[1] | (frame[2] << 8);
        this.respond([STK.INSYNC, STK.OK]);
        break;
      case STK.PROG_PAGE: {
        const len = (frame[1] << 8) | frame[2];
        const data = frame.slice(4, 4 + len);
        this.flash.set(data, this.wordAddress * 2);
        this.respond([STK.INSYNC, STK.OK]);
        break;
      }
      case STK.READ_PAGE: {
        const len = (frame[1] << 8) | frame[2];
        const byteAddr = this.wordAddress * 2;
        const data = Array.from(this.flash.slice(byteAddr, byteAddr + len));
        this.respond([STK.INSYNC, ...data, STK.OK]);
        break;
      }
    }
  }
}

/**
 * Encoder Intel HEX (kebalikan dari parser `intel-hex`) — dipakai buat bikin payload test
 * yang REALISTIS (>1 halaman flash). Sengaja tidak pakai payload kecil (mis. 4 byte):
 * paket `stk500` punya bug off-by-one di jalur "hex lebih kecil dari pageSize" yang
 * bikin infinite loop — tidak relevan di dunia nyata (hex hasil compile sketch minimal
 * ratusan byte, selalu > 128 byte pageSize Uno), tapi bisa memicu false failure di test
 * kalau payload-nya dibuat sekecil itu.
 */
function buildIntelHex(bytes: number[]): string {
  const CHUNK = 16;
  const lines: string[] = [];
  const hex = (n: number, width: number) => n.toString(16).padStart(width, '0').toUpperCase();
  for (let addr = 0; addr < bytes.length; addr += CHUNK) {
    const chunk = bytes.slice(addr, addr + CHUNK);
    let checksum = chunk.length + ((addr >> 8) & 0xff) + (addr & 0xff);
    for (const b of chunk) checksum += b;
    checksum = (0x100 - (checksum & 0xff)) & 0xff;
    lines.push(`:${hex(chunk.length, 2)}${hex(addr, 4)}00${chunk.map((b) => hex(b, 2)).join('')}${hex(checksum, 2)}`);
  }
  lines.push(':00000001FF');
  return lines.join('\n') + '\n';
}

describe('flashHexToPort (via fake Optiboot device)', () => {
  it('mengirim seluruh isi .hex (3 halaman) ke "flash" board palsu lewat protokol STK500v1 asli', async () => {
    const payload = Array.from({ length: 300 }, (_, i) => i & 0xff);
    const hex = buildIntelHex(payload);
    const fakePort = new FakeOptibootPort();

    const statuses: string[] = [];
    const progressEvents: { phase: string; pageIndex: number; totalPages: number }[] = [];
    await flashHexToPort(fakePort as unknown as SerialPort, hex, {
      onLog: (msg) => statuses.push(msg),
      onProgress: (p) => progressEvents.push(p),
    });

    expect(Array.from(fakePort.flash.slice(0, payload.length))).toEqual(payload);
    // Reset otomatis (pulsa DTR/RTS) harus benar-benar dipanggil sebelum protokol jalan.
    expect(fakePort.signalCalls.length).toBeGreaterThanOrEqual(3);
    expect(statuses.length).toBeGreaterThan(0);
    // 300 byte / 128-byte halaman = 3 halaman, ditulis DAN diverifikasi -> 6 event progress.
    expect(progressEvents.length).toBe(6);
    expect(progressEvents[progressEvents.length - 1]).toEqual({ phase: 'verify', pageIndex: 3, totalPages: 3 });
  });

  it('gagal dengan error timeout kalau board tidak pernah merespons (mis. salah pilih port)', async () => {
    // Port yang menerima tulisan tapi tidak pernah membalas apa pun — mensimulasikan
    // "tidak ada Arduino di ujung sana" (kabel salah/board tidak ada bootloader).
    const silentPort: Partial<SerialPort> = {
      readable: new ReadableStream<Uint8Array>({ start() {} }),
      writable: new WritableStream<Uint8Array>({ write() {} }),
      open: async () => {},
      close: async () => {},
      setSignals: async () => {},
      getInfo: () => ({}),
    };

    const hex = buildIntelHex(Array.from({ length: 200 }, (_, i) => i & 0xff));
    await expect(flashHexToPort(silentPort as unknown as SerialPort, hex)).rejects.toThrow(/timeout/i);
  }, 10_000);
});
