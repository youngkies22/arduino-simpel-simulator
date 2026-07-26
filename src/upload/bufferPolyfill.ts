import { Buffer } from 'buffer';

/**
 * Paket `stk500` (dan `intel-hex`) ditulis untuk Node — keduanya memakai `Buffer` global
 * yang tidak ada di browser. WAJIB diimpor SEBELUM `stk500`/`intel-hex` di file manapun,
 * karena `stk500/lib/statics.js` membuat `Buffer.from(...)` saat modul itu di-load
 * (bukan lazy), jadi polyfill ini harus sudah terpasang duluan.
 */
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
