import { type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';

/**
 * Daftar saran autocomplete. SENGAJA hanya berisi hal yang benar-benar didukung
 * interpreter di `arduinoInterpreter.ts` — menyarankan fungsi yang tidak ada justru
 * menyesatkan siswa (kodenya "terlihat benar" lalu gagal saat dijalankan).
 *
 * Kalau menambah built-in baru di interpreter, tambahkan juga di sini —
 * `arduinoCompletions.test.ts` menjaga daftar ini tetap sinkron.
 */

interface Entry {
  label: string;
  /** Potongan kode yang disisipkan; `#{}` menandai posisi kursor setelah disisipkan. */
  insert?: string;
  detail: string;
  info: string;
}

/** Fungsi global — nama harus cocok dengan `case '...'` di callBuiltin() interpreter. */
export const BUILTIN_FUNCTIONS: Entry[] = [
  { label: 'pinMode', insert: 'pinMode(#{}, OUTPUT)', detail: 'pin, mode', info: 'Menentukan pin sebagai INPUT, OUTPUT, atau INPUT_PULLUP.' },
  { label: 'digitalWrite', insert: 'digitalWrite(#{}, HIGH)', detail: 'pin, nilai', info: 'Memberi tegangan HIGH (5V) atau LOW (0V) ke pin digital.' },
  { label: 'digitalRead', insert: 'digitalRead(#{})', detail: 'pin', info: 'Membaca kondisi pin digital: HIGH atau LOW.' },
  { label: 'analogRead', insert: 'analogRead(#{})', detail: 'pin', info: 'Membaca pin analog (A0-A5), hasilnya 0-1023.' },
  { label: 'analogWrite', insert: 'analogWrite(#{}, 128)', detail: 'pin, 0-255', info: 'Mengeluarkan sinyal PWM 0-255. Hanya di pin bertanda ~ (3, 5, 6, 9, 10, 11).' },
  { label: 'delay', insert: 'delay(#{})', detail: 'milidetik', info: 'Menjeda program selama sekian milidetik (1000 = 1 detik).' },
  { label: 'delayMicroseconds', insert: 'delayMicroseconds(#{})', detail: 'mikrodetik', info: 'Jeda sangat singkat, dalam mikrodetik.' },
  { label: 'millis', insert: 'millis()', detail: '-> unsigned long', info: 'Lama program berjalan dalam milidetik sejak board menyala.' },
  { label: 'micros', insert: 'micros()', detail: '-> unsigned long', info: 'Seperti millis(), tapi dalam mikrodetik.' },
  { label: 'tone', insert: 'tone(#{}, 440)', detail: 'pin, frekuensi', info: 'Membunyikan nada di buzzer pada frekuensi tertentu (Hz).' },
  { label: 'noTone', insert: 'noTone(#{})', detail: 'pin', info: 'Menghentikan nada yang sedang dibunyikan tone().' },
  { label: 'map', insert: 'map(#{}, 0, 1023, 0, 255)', detail: 'nilai, dariLo, dariHi, keLo, keHi', info: 'Mengubah rentang sebuah nilai, mis. 0-1023 jadi 0-255.' },
  { label: 'constrain', insert: 'constrain(#{}, 0, 255)', detail: 'nilai, min, maks', info: 'Menjaga nilai agar tidak keluar dari batas min-maks.' },
  { label: 'min', insert: 'min(#{}, 0)', detail: 'a, b', info: 'Mengambil nilai terkecil dari dua angka.' },
  { label: 'max', insert: 'max(#{}, 0)', detail: 'a, b', info: 'Mengambil nilai terbesar dari dua angka.' },
  { label: 'abs', insert: 'abs(#{})', detail: 'nilai', info: 'Nilai mutlak (selalu positif).' },
  { label: 'pow', insert: 'pow(#{}, 2)', detail: 'basis, pangkat', info: 'Perpangkatan.' },
  { label: 'sqrt', insert: 'sqrt(#{})', detail: 'nilai', info: 'Akar kuadrat.' },
  { label: 'sq', insert: 'sq(#{})', detail: 'nilai', info: 'Kuadrat (nilai dikali dirinya sendiri).' },
  { label: 'random', insert: 'random(#{})', detail: '[min,] maks', info: 'Angka acak. random(10) -> 0..9; random(1, 7) -> 1..6.' },
  { label: 'randomSeed', insert: 'randomSeed(#{})', detail: 'benih', info: 'Mengacak awal deret random(), biasanya randomSeed(analogRead(A0)).' },
  { label: 'sin', insert: 'sin(#{})', detail: 'radian', info: 'Sinus (sudut dalam radian).' },
  { label: 'cos', insert: 'cos(#{})', detail: 'radian', info: 'Kosinus (sudut dalam radian).' },
  { label: 'tan', insert: 'tan(#{})', detail: 'radian', info: 'Tangen (sudut dalam radian).' },
  { label: 'radians', insert: 'radians(#{})', detail: 'derajat', info: 'Mengubah derajat jadi radian.' },
  { label: 'degrees', insert: 'degrees(#{})', detail: 'radian', info: 'Mengubah radian jadi derajat.' },
  { label: 'bitRead', insert: 'bitRead(#{}, 0)', detail: 'nilai, posisi', info: 'Membaca satu bit dari sebuah angka.' },
  { label: 'bitWrite', insert: 'bitWrite(#{}, 0, 1)', detail: 'nilai, posisi, bit', info: 'Menulis satu bit ke posisi tertentu.' },
  { label: 'bitSet', insert: 'bitSet(#{}, 0)', detail: 'nilai, posisi', info: 'Menjadikan satu bit bernilai 1.' },
  { label: 'bitClear', insert: 'bitClear(#{}, 0)', detail: 'nilai, posisi', info: 'Menjadikan satu bit bernilai 0.' },
  { label: 'bitToggle', insert: 'bitToggle(#{}, 0)', detail: 'nilai, posisi', info: 'Membalik satu bit (0 jadi 1, 1 jadi 0).' },
  { label: 'bit', insert: 'bit(#{})', detail: 'posisi', info: 'Nilai bit pada posisi tertentu (bit(3) = 8).' },
  { label: 'lowByte', insert: 'lowByte(#{})', detail: 'nilai', info: 'Byte terendah dari sebuah angka.' },
  { label: 'highByte', insert: 'highByte(#{})', detail: 'nilai', info: 'Byte tertinggi dari sebuah angka.' },
  { label: 'shiftOut', insert: 'shiftOut(#{}, clockPin, MSBFIRST, nilai)', detail: 'dataPin, clockPin, urutan, nilai', info: 'Mengirim data bit demi bit, dipakai shift register 74HC595.' },
  { label: 'shiftIn', insert: 'shiftIn(#{}, clockPin, MSBFIRST)', detail: 'dataPin, clockPin, urutan', info: 'Membaca data bit demi bit dari perangkat luar.' },
  { label: 'pulseIn', insert: 'pulseIn(#{}, HIGH)', detail: 'pin, nilai', info: 'Mengukur lama pulsa dalam mikrodetik — dipakai sensor ultrasonik.' },
  { label: 'attachInterrupt', insert: 'attachInterrupt(digitalPinToInterrupt(#{}), fungsi, RISING)', detail: 'interrupt, fungsi, mode', info: 'Menjalankan fungsi seketika saat pin berubah, tanpa menunggu loop().' },
  { label: 'detachInterrupt', insert: 'detachInterrupt(digitalPinToInterrupt(#{}))', detail: 'interrupt', info: 'Mematikan interrupt yang sudah dipasang.' },
  { label: 'digitalPinToInterrupt', insert: 'digitalPinToInterrupt(#{})', detail: 'pin', info: 'Mengubah nomor pin jadi nomor interrupt (di Uno: pin 2 dan 3).' },
  { label: 'interrupts', insert: 'interrupts()', detail: '', info: 'Mengaktifkan kembali interrupt.' },
  { label: 'noInterrupts', insert: 'noInterrupts()', detail: '', info: 'Mematikan interrupt sementara.' },
];

/** Konstanta global — harus cocok dengan installGlobalConstants() di interpreter. */
export const BUILTIN_CONSTANTS: Entry[] = [
  { label: 'HIGH', detail: '= 1', info: 'Tegangan penuh (5V).' },
  { label: 'LOW', detail: '= 0', info: 'Tanpa tegangan (0V).' },
  { label: 'INPUT', detail: '= 0', info: 'Pin dipakai membaca (mode masukan).' },
  { label: 'OUTPUT', detail: '= 1', info: 'Pin dipakai mengeluarkan tegangan.' },
  { label: 'INPUT_PULLUP', detail: '= 2', info: 'Masukan dengan resistor pull-up internal — tombol jadi LOW saat ditekan.' },
  { label: 'LED_BUILTIN', detail: '= 13', info: 'LED bawaan di papan Arduino (pin 13).' },
  { label: 'A0', detail: '= 14', info: 'Pin analog 0.' },
  { label: 'A1', detail: '= 15', info: 'Pin analog 1.' },
  { label: 'A2', detail: '= 16', info: 'Pin analog 2.' },
  { label: 'A3', detail: '= 17', info: 'Pin analog 3.' },
  { label: 'A4', detail: '= 18', info: 'Pin analog 4 (juga SDA untuk I2C).' },
  { label: 'A5', detail: '= 19', info: 'Pin analog 5 (juga SCL untuk I2C).' },
  { label: 'PI', detail: '= 3.14159', info: 'Konstanta pi.' },
  { label: 'DEC', detail: '= 10', info: 'Format desimal untuk Serial.print.' },
  { label: 'HEX', detail: '= 16', info: 'Format heksadesimal untuk Serial.print.' },
  { label: 'OCT', detail: '= 8', info: 'Format oktal untuk Serial.print.' },
  { label: 'BIN', detail: '= 2', info: 'Format biner untuk Serial.print.' },
  { label: 'CHANGE', detail: '= 1', info: 'Mode interrupt: saat pin berubah (naik atau turun).' },
  { label: 'FALLING', detail: '= 2', info: 'Mode interrupt: saat pin turun HIGH -> LOW.' },
  { label: 'RISING', detail: '= 3', info: 'Mode interrupt: saat pin naik LOW -> HIGH.' },
  { label: 'LSBFIRST', detail: '= 0', info: 'Kirim bit paling kecil dulu (shiftOut/shiftIn).' },
  { label: 'MSBFIRST', detail: '= 1', info: 'Kirim bit paling besar dulu (shiftOut/shiftIn).' },
  { label: 'DHT11', detail: '= 11', info: 'Tipe sensor DHT11.' },
  { label: 'DHT21', detail: '= 21', info: 'Tipe sensor DHT21.' },
  { label: 'DHT22', detail: '= 22', info: 'Tipe sensor DHT22.' },
];

/** Objek global bawaan beserta method-nya (dipakai setelah user mengetik "Serial."). */
export const BUILTIN_OBJECTS: Record<string, Entry[]> = {
  Serial: [
    { label: 'begin', insert: 'begin(9600)', detail: 'baud', info: 'Mengaktifkan komunikasi serial. Umumnya Serial.begin(9600).' },
    { label: 'print', insert: 'print(#{})', detail: 'nilai', info: 'Mengirim teks/angka ke Serial Monitor tanpa pindah baris.' },
    { label: 'println', insert: 'println(#{})', detail: 'nilai', info: 'Seperti print(), tapi pindah baris. Baris berisi angka saja akan tampil di Plotter.' },
    { label: 'available', insert: 'available()', detail: '-> int', info: 'Berapa byte data yang sudah masuk dan siap dibaca.' },
    { label: 'read', insert: 'read()', detail: '-> int', info: 'Membaca satu byte dari Serial (-1 kalau kosong).' },
    { label: 'peek', insert: 'peek()', detail: '-> int', info: 'Mengintip byte berikutnya tanpa mengambilnya.' },
    { label: 'parseInt', insert: 'parseInt()', detail: '-> long', info: 'Membaca angka bulat dari input serial.' },
    { label: 'parseFloat', insert: 'parseFloat()', detail: '-> float', info: 'Membaca angka desimal dari input serial.' },
    { label: 'readString', insert: 'readString()', detail: '-> String', info: 'Membaca seluruh input yang masuk sebagai teks.' },
    { label: 'readStringUntil', insert: "readStringUntil('\\n')", detail: 'pembatas', info: 'Membaca teks sampai ketemu karakter pembatas.' },
    { label: 'flush', insert: 'flush()', detail: '', info: 'Menunggu semua data terkirim.' },
    { label: 'end', insert: 'end()', detail: '', info: 'Mematikan komunikasi serial.' },
    { label: 'setTimeout', insert: 'setTimeout(1000)', detail: 'milidetik', info: 'Batas waktu tunggu pembacaan serial.' },
  ],
  EEPROM: [
    { label: 'read', insert: 'read(#{})', detail: 'alamat', info: 'Membaca satu byte dari EEPROM (data bertahan walau listrik mati).' },
    { label: 'write', insert: 'write(#{}, 0)', detail: 'alamat, nilai', info: 'Menulis satu byte ke EEPROM.' },
    { label: 'update', insert: 'update(#{}, 0)', detail: 'alamat, nilai', info: 'Seperti write(), tapi hanya menulis kalau nilainya berbeda (lebih awet).' },
    { label: 'get', insert: 'get(#{}, variabel)', detail: 'alamat, variabel', info: 'Membaca data bertipe apa pun dari EEPROM.' },
    { label: 'put', insert: 'put(#{}, variabel)', detail: 'alamat, variabel', info: 'Menyimpan data bertipe apa pun ke EEPROM.' },
    { label: 'length', insert: 'length()', detail: '-> int', info: 'Ukuran EEPROM dalam byte.' },
  ],
};

/** Tipe data & kata kunci yang dipahami parser. */
export const KEYWORDS = [
  'void', 'int', 'long', 'short', 'byte', 'char', 'word', 'float', 'double', 'bool', 'boolean', 'String',
  'unsigned', 'const', 'static', 'true', 'false',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return',
  'struct', 'enum', 'typedef', 'sizeof',
];

/** Kerangka yang sering dipakai — mempercepat siswa menulis pola dasar. */
const SNIPPETS: Entry[] = [
  { label: 'setup', insert: 'void setup() {\n  #{}\n}', detail: 'kerangka', info: 'Fungsi yang jalan sekali saat board menyala.' },
  { label: 'loop', insert: 'void loop() {\n  #{}\n}', detail: 'kerangka', info: 'Fungsi yang diulang terus-menerus.' },
  { label: 'for', insert: 'for (int i = 0; i < #{}; i++) {\n  \n}', detail: 'perulangan', info: 'Perulangan sebanyak jumlah tertentu.' },
  { label: 'if', insert: 'if (#{}) {\n  \n}', detail: 'percabangan', info: 'Menjalankan kode hanya kalau syarat terpenuhi.' },
];

function toCompletion(entry: Entry, type: string): Completion {
  return {
    label: entry.label,
    type,
    detail: entry.detail || undefined,
    info: entry.info,
    apply: entry.insert ? applySnippet(entry.insert) : undefined,
  };
}

/** Menyisipkan teks dan menaruh kursor di posisi `#{}` (kalau ada). */
function applySnippet(template: string) {
  return (view: EditorView, _completion: Completion, from: number, to: number) => {
    const cursorAt = template.indexOf('#{}');
    const text = template.replace('#{}', '');
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + (cursorAt === -1 ? text.length : cursorAt) },
    });
  };
}

const FUNCTION_COMPLETIONS = BUILTIN_FUNCTIONS.map((e) => toCompletion(e, 'function'));
const CONSTANT_COMPLETIONS = BUILTIN_CONSTANTS.map((e) => toCompletion(e, 'constant'));
const OBJECT_COMPLETIONS: Completion[] = Object.keys(BUILTIN_OBJECTS).map((name) => ({
  label: name,
  type: 'class',
  info: `Objek bawaan ${name}. Ketik "${name}." untuk melihat perintahnya.`,
}));
const KEYWORD_COMPLETIONS: Completion[] = KEYWORDS.map((label) => ({ label, type: 'keyword' }));
const SNIPPET_COMPLETIONS = SNIPPETS.map((e) => toCompletion(e, 'text'));

const MEMBER_COMPLETIONS: Record<string, Completion[]> = Object.fromEntries(
  Object.entries(BUILTIN_OBJECTS).map(([name, entries]) => [name, entries.map((e) => toCompletion(e, 'method'))]),
);

const TOP_LEVEL_COMPLETIONS = [
  ...FUNCTION_COMPLETIONS,
  ...OBJECT_COMPLETIONS,
  ...CONSTANT_COMPLETIONS,
  ...SNIPPET_COMPLETIONS,
  ...KEYWORD_COMPLETIONS,
];

/** Sumber saran untuk CodeMirror. */
export function arduinoCompletionSource(context: CompletionContext): CompletionResult | null {
  // "Serial." / "EEPROM." -> tampilkan method objek itu saja.
  const member = context.matchBefore(/(\w+)\.(\w*)$/);
  if (member) {
    const [, objectName] = /(\w+)\./.exec(member.text) ?? [];
    const options = MEMBER_COMPLETIONS[objectName];
    if (options) {
      return { from: member.from + objectName.length + 1, options, validFor: /^\w*$/ };
    }
    // Objek tak dikenal (mis. variabel buatan siswa) — jangan sarankan apa pun,
    // daripada menyodorkan daftar global yang pasti salah setelah titik.
    return null;
  }

  const word = context.matchBefore(/\w+/);
  if (!word && !context.explicit) return null;
  if (word && word.from === word.to && !context.explicit) return null;

  return { from: word ? word.from : context.pos, options: TOP_LEVEL_COMPLETIONS, validFor: /^\w*$/ };
}
