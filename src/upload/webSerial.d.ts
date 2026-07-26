/**
 * TypeScript belum menyertakan tipe Web Serial API di lib DOM bawaannya, jadi
 * dideklarasikan manual di sini — cuma permukaan yang benar-benar dipakai project ini
 * (requestPort, open/close, readable/writable, setSignals).
 */
export {};

declare global {
  interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
  }

  interface SerialOutputSignals {
    dataTerminalReady?: boolean;
    requestToSend?: boolean;
    break?: boolean;
  }

  interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
    bufferSize?: number;
    flowControl?: 'none' | 'hardware';
  }

  interface SerialPort extends EventTarget {
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    setSignals(signals: SerialOutputSignals): Promise<void>;
    getInfo(): SerialPortInfo;
  }

  interface Serial extends EventTarget {
    requestPort(options?: { filters?: SerialPortInfo[] }): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  }

  interface Navigator {
    serial?: Serial;
  }
}
