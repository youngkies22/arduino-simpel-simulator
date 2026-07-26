import { describe, expect, it } from 'vitest';
import {
  ESP_CMD,
  ESP_FLASH_BLOCK_SIZE,
  bootloadEsp,
  buildCommandFrame,
  espDataChecksum,
  slipEncode,
  sync,
  type EspFlashSegment,
} from '../esptoolProtocol';
import { WebSerialStream } from '../webSerialStream';

function u32(data: Uint8Array, offset: number): number {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

// ---------- Unit murni: framing & checksum (tanpa stream/port sama sekali) ----------

describe('slipEncode', () => {
  it('membungkus payload dengan 0xC0 di awal & akhir', () => {
    const out = slipEncode(new Uint8Array([1, 2, 3]));
    expect(out[0]).toBe(0xc0);
    expect(out[out.length - 1]).toBe(0xc0);
  });

  it('meng-escape byte 0xC0 di dalam payload jadi 0xDB 0xDC', () => {
    const out = slipEncode(new Uint8Array([0xc0]));
    expect(Array.from(out)).toEqual([0xc0, 0xdb, 0xdc, 0xc0]);
  });

  it('meng-escape byte 0xDB di dalam payload jadi 0xDB 0xDD', () => {
    const out = slipEncode(new Uint8Array([0xdb]));
    expect(Array.from(out)).toEqual([0xc0, 0xdb, 0xdd, 0xc0]);
  });

  it('byte biasa (bukan 0xC0/0xDB) tidak di-escape', () => {
    const out = slipEncode(new Uint8Array([0x00, 0xff, 0x41]));
    expect(Array.from(out)).toEqual([0xc0, 0x00, 0xff, 0x41, 0xc0]);
  });
});

describe('espDataChecksum', () => {
  it('seed 0xEF di-XOR semua byte data', () => {
    expect(espDataChecksum(new Uint8Array([]))).toBe(0xef);
    expect(espDataChecksum(new Uint8Array([0xef]))).toBe(0x00);
    expect(espDataChecksum(new Uint8Array([0x01, 0x02]))).toBe(0xef ^ 0x01 ^ 0x02);
  });
});

describe('buildCommandFrame', () => {
  it('header 8-byte: direction=0x00, command, size LE, checksum LE, lalu data, lalu SLIP', () => {
    const frame = buildCommandFrame(ESP_CMD.SYNC, new Uint8Array([0xaa, 0xbb]), 0x1234);
    // Lepas bungkus SLIP (payload di sini sengaja tidak mengandung byte yang perlu di-escape).
    const inner = frame.slice(1, frame.length - 1);
    expect(Array.from(inner)).toEqual([
      0x00, // direction: request
      ESP_CMD.SYNC,
      0x02,
      0x00, // size = 2, LE
      0x34,
      0x12,
      0x00,
      0x00, // checksum 0x1234, LE
      0xaa,
      0xbb, // data
    ]);
  });
});

// ---------- End-to-end: lewat bootloader ROM ESP palsu (tanpa hardware sungguhan) ----------

/** Header respons ROM loader: direction=0x01, command, size=2 (LE), value=0, lalu [status, error]. */
function buildResponseFrame(command: number, status: number, errorCode = 0): Uint8Array {
  const payload = new Uint8Array(10);
  payload[0] = 0x01;
  payload[1] = command;
  payload[2] = 2;
  payload[8] = status;
  payload[9] = errorCode;
  return slipEncode(payload);
}

/**
 * Simulasi ROM bootloader ESP32/ESP8266 yang cukup lengkap buat mengetes seluruh alur
 * `bootloadEsp` (sync, SPI_ATTACH, FLASH_BEGIN/DATA/END per segmen, checksum per blok)
 * TANPA board fisik — memvalidasi esptoolProtocol.ts + WebSerialStream benar-benar
 * bicara SLIP yang sama.
 */
class FakeEspRomBootloader implements Partial<SerialPort> {
  readonly flash = new Uint8Array(0x20000).fill(0xff);
  readonly commandsSeen: number[] = [];
  private incoming: number[] = [];
  private deviceController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private begin: { offset: number; blockSize: number } | null = null;

  readable = new ReadableStream<Uint8Array>({
    start: (controller) => {
      this.deviceController = controller;
    },
  });

  writable = new WritableStream<Uint8Array>({
    write: (chunk) => {
      for (const byte of chunk) this.incoming.push(byte);
      this.processFrames();
    },
  });

  async open(): Promise<void> {}
  async close(): Promise<void> {}
  async setSignals(): Promise<void> {}
  getInfo(): SerialPortInfo {
    return {};
  }

  private respond(frame: Uint8Array): void {
    this.deviceController!.enqueue(frame);
  }

  private processFrames(): void {
    for (;;) {
      const start = this.incoming.indexOf(0xc0);
      if (start === -1) return;
      let end = -1;
      for (let i = start + 1; i < this.incoming.length; i++) {
        if (this.incoming[i] === 0xc0) {
          end = i;
          break;
        }
      }
      if (end === -1) return; // Frame belum lengkap, tunggu byte berikutnya.
      if (end === start + 1) {
        this.incoming.splice(0, 1); // 0xC0 dobel (bingkai kosong) — buang satu, cari lagi.
        continue;
      }
      const raw = this.incoming.splice(0, end + 1);
      const inner = raw.slice(1, raw.length - 1);
      this.handleFrame(new Uint8Array(this.unescape(inner)));
    }
  }

  private unescape(bytes: number[]): number[] {
    const out: number[] = [];
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0xdb) {
        i++;
        out.push(bytes[i] === 0xdc ? 0xc0 : bytes[i] === 0xdd ? 0xdb : bytes[i]);
      } else {
        out.push(bytes[i]);
      }
    }
    return out;
  }

  private handleFrame(frame: Uint8Array): void {
    const command = frame[1];
    const size = frame[2] | (frame[3] << 8);
    const checksum = u32(frame, 4);
    const data = frame.slice(8, 8 + size);
    this.commandsSeen.push(command);

    switch (command) {
      case ESP_CMD.SYNC:
        // ROM asli membalas beberapa frame sekaligus untuk satu SYNC — disimulasikan di sini
        // supaya jalur "menguras balasan susulan" di sync() benar-benar teruji.
        this.respond(buildResponseFrame(ESP_CMD.SYNC, 0));
        this.respond(buildResponseFrame(ESP_CMD.SYNC, 0));
        this.respond(buildResponseFrame(ESP_CMD.SYNC, 0));
        break;

      case ESP_CMD.SPI_ATTACH:
        this.respond(buildResponseFrame(ESP_CMD.SPI_ATTACH, 0));
        break;

      case ESP_CMD.FLASH_BEGIN: {
        const offset = u32(data, 12);
        const blockSize = u32(data, 8);
        this.begin = { offset, blockSize };
        this.respond(buildResponseFrame(ESP_CMD.FLASH_BEGIN, 0));
        break;
      }

      case ESP_CMD.FLASH_DATA: {
        const chunkLen = u32(data, 0);
        const seq = u32(data, 4);
        const chunk = data.slice(16, 16 + chunkLen);
        const expected = espDataChecksum(chunk);
        if (expected !== checksum || !this.begin) {
          this.respond(buildResponseFrame(ESP_CMD.FLASH_DATA, 1, 0xff));
          break;
        }
        this.flash.set(chunk, this.begin.offset + seq * this.begin.blockSize);
        this.respond(buildResponseFrame(ESP_CMD.FLASH_DATA, 0));
        break;
      }

      case ESP_CMD.FLASH_END:
        this.respond(buildResponseFrame(ESP_CMD.FLASH_END, 0));
        break;
    }
  }
}

function makeSegment(offset: number, length: number, fillStart: number): EspFlashSegment {
  return { offset, data: new Uint8Array(Array.from({ length }, (_, i) => (fillStart + i) & 0xff)) };
}

/** Bungkus device palsu jadi Stk500Stream (yang dibutuhkan bootloadEsp/sync), sama seperti
 * flashEsp.ts membungkus SerialPort sungguhan sebelum bicara protokol. */
function streamFor(device: Partial<SerialPort>): WebSerialStream {
  const stream = new WebSerialStream(device as unknown as SerialPort);
  stream.start();
  return stream;
}

describe('bootloadEsp (lewat ROM bootloader ESP32 palsu)', () => {
  it('menulis semua segmen (multi-blok, multi-segmen) ke offset yang benar', async () => {
    // Segmen A: 300 byte (< 1 blok 1KB). Segmen B: 2500 byte (butuh 3 blok, blok terakhir dipad).
    const segments = [makeSegment(0x1000, 300, 0), makeSegment(0x10000, 2500, 50)];
    const device = new FakeEspRomBootloader();

    const progressEvents: { segmentIndex: number; totalSegments: number; blockIndex: number; totalBlocks: number }[] = [];
    const logs: string[] = [];

    await bootloadEsp(streamFor(device), segments, {
      chip: 'esp32',
      timeoutMs: 2000,
      eraseTimeoutMs: 5000,
      onLog: (l) => logs.push(l),
      onProgress: (segmentIndex, totalSegments, blockIndex, totalBlocks) => progressEvents.push({ segmentIndex, totalSegments, blockIndex, totalBlocks }),
    });

    expect(Array.from(device.flash.slice(0x1000, 0x1000 + 300))).toEqual(Array.from(segments[0].data));
    expect(Array.from(device.flash.slice(0x10000, 0x10000 + 2500))).toEqual(Array.from(segments[1].data));

    // 1 blok (segmen A) + 3 blok (segmen B) = 4 event progress.
    expect(progressEvents.length).toBe(4);
    expect(progressEvents[progressEvents.length - 1]).toEqual({ segmentIndex: 1, totalSegments: 2, blockIndex: 3, totalBlocks: 3 });

    // esp32 wajib SPI_ATTACH sebelum flash; esp8266 tidak (lihat test terpisah di bawah).
    expect(device.commandsSeen).toContain(ESP_CMD.SPI_ATTACH);
    expect(logs.some((l) => l.includes('Flash selesai'))).toBe(true);
  });

  it('esp8266 TIDAK mengirim SPI_ATTACH (ROM chip itu tidak punya command ini)', async () => {
    const device = new FakeEspRomBootloader();
    await bootloadEsp(streamFor(device), [makeSegment(0x0, 100, 0)], { chip: 'esp8266', timeoutMs: 2000, eraseTimeoutMs: 5000 });
    expect(device.commandsSeen).not.toContain(ESP_CMD.SPI_ATTACH);
  });

  it('blok terakhir yang lebih pendek dari 1KB di-pad dengan 0xFF, bukan 0x00', async () => {
    const device = new FakeEspRomBootloader();
    const segment = makeSegment(0x0, 10, 1); // jauh lebih pendek dari ESP_FLASH_BLOCK_SIZE
    await bootloadEsp(streamFor(device), [segment], { chip: 'esp8266', timeoutMs: 2000, eraseTimeoutMs: 5000 });

    // Byte SETELAH data asli (di dalam blok yang sama) harus 0xFF (padding), bukan tersentuh 0x00.
    expect(device.flash[10]).toBe(0xff);
    expect(device.flash[ESP_FLASH_BLOCK_SIZE - 1]).toBe(0xff);
  });

  it('sync() gagal dengan pesan jelas kalau board tidak pernah membalas (mis. lupa tekan tombol BOOT)', async () => {
    const silentPort: Partial<SerialPort> = {
      readable: new ReadableStream<Uint8Array>({ start() {} }),
      writable: new WritableStream<Uint8Array>({ write() {} }),
      open: async () => {},
      close: async () => {},
      setSignals: async () => {},
      getInfo: () => ({}),
    };
    const stream = streamFor(silentPort);

    await expect(sync(stream, 200)).rejects.toThrow(/mode download/i);
  }, 10_000);
});
