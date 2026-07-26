/** `intel-hex` tidak punya tipe bawaan — deklarasi minimal untuk permukaan yang dipakai. */
declare module 'intel-hex' {
  export interface ParsedIntelHex {
    data: Uint8Array;
    startSegmentAddress: number | null;
    startLinearAddress: number | null;
  }

  export function parse(data: string, bufferSize?: number, addressOffset?: number): ParsedIntelHex;
}
