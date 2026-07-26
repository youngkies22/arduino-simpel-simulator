/** Decode base64 (hasil dari compile-server) jadi bytes mentah. */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  // `new ArrayBuffer(...)` (bukan langsung `new Uint8Array(n)`) supaya tipenya pasti
  // `ArrayBuffer`, bukan `ArrayBufferLike` — beberapa Web API (mis. Blob) menolak
  // union-nya di TS strict mode (SharedArrayBuffer termasuk ArrayBufferLike tapi bukan
  // BlobPart yang valid).
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
