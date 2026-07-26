# 🔧 Arduino Simulator (Web)

Simulator Arduino di browser — tulis kode `.ino`, rangkai komponen di kanvas
drag-and-drop, jalankan simulasi secara instan, lalu (opsional) upload hasil compile
asli ke board fisik lewat kabel USB. Tidak perlu instal Arduino IDE untuk mulai belajar.

Cocok untuk siswa yang baru belajar pemrograman Arduino maupun guru yang butuh alat
peraga cepat tanpa harus membawa banyak komponen fisik ke kelas.

## Daftar Isi

- [✨ Fitur](#-fitur)
- [🚀 Memulai](#-memulai)
- [📖 Panduan Cepat: LED Berkedip](#-panduan-cepat-led-berkedip)
- [🧩 Panduan Fitur](#-panduan-fitur)
  - [Editor Kode & Bantuan Menulis](#editor-kode--bantuan-menulis)
  - [Kanvas & Wiring](#kanvas--wiring)
  - [Contoh Sketch Siap Pakai](#contoh-sketch-siap-pakai)
  - [Serial Monitor & Plotter](#serial-monitor--plotter)
  - [Pilihan Board: Uno / ESP32 / ESP8266](#pilihan-board-uno--esp32--esp8266)
  - [Upload ke Board Fisik](#upload-ke-board-fisik)
  - [Projek Saya (Simpan & Buka Banyak Sketch)](#projek-saya-simpan--buka-banyak-sketch)
  - [Reset Komponen](#reset-komponen)
  - [Tema Gelap / Terang](#tema-gelap--terang)
  - [Yang Tersimpan Otomatis](#yang-tersimpan-otomatis)
- [🛠️ Untuk Kontributor](#️-untuk-kontributor)

## ✨ Fitur

| | |
| --- | --- |
| ✏️ **Editor kode** | Syntax highlight C/C++, autocomplete fungsi Arduino, baris error otomatis tersorot |
| 🧱 **Kanvas drag-and-drop** | Rangkai LED, sensor, motor, dll — sambungkan ke pin lewat dropdown, bukan menarik kabel manual |
| ▶️ **Simulasi instan** | Jalankan kode langsung di browser, tanpa install apa pun |
| 📊 **Serial Monitor & Plotter** | Lihat output teks maupun grafik data sensor real-time |
| 💾 **Projek Saya** | Simpan sampai 20 sketch dengan nama masing-masing, unduh/impor `.ino` |
| 🔌 **3 pilihan board** | Arduino Uno, ESP32, ESP8266 — kanvas & pin ikut menyesuaikan otomatis |
| 📲 **Upload ke board asli** | Compile sungguhan + flash lewat USB langsung dari browser (Web Serial) |
| 🌗 **Tema gelap/terang** | Pilihan tampilan sesuai selera, tersimpan otomatis |
| 📖 **26 contoh sketch** | Dari blink LED sampai RFID, siap dibuka sekali klik |
| 🧹 **Reset Komponen** | Bersihkan kanvas sekali klik tanpa menghapus part satu-satu |

## 🚀 Memulai

Butuh [Node.js](https://nodejs.org) versi 18 ke atas.

```bash
npm install
npm run dev
```

Buka alamat yang muncul di terminal (biasanya `http://localhost:5173`). Selesai — tidak
ada instalasi Arduino IDE, driver board, atau konfigurasi tambahan untuk mulai mencoba.

Perintah lain yang tersedia:

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Jalankan mode pengembangan (hot reload) |
| `npm run build` | Type-check (`tsc -b`) lalu build produksi ke folder `dist/` |
| `npm run preview` | Jalankan hasil build produksi secara lokal |
| `npm test` | Jalankan seluruh test sekali jalan (Vitest) |
| `npm run test:watch` | Jalankan test dalam mode watch |
| `npm run lint` | Cek gaya kode dengan Oxlint |

## 📖 Panduan Cepat: LED Berkedip

1. Klik **Tambah part** di panel kanan, pilih **LED**.
2. Klik badge ⚙ di kartu LED, atur pin **Anoda** ke `D13` (atau pin lain), tutup dialog.
3. Di editor kode (kiri), ganti isi jadi:

   ```cpp
   void setup() {
     pinMode(13, OUTPUT);
   }

   void loop() {
     digitalWrite(13, HIGH);
     delay(500);
     digitalWrite(13, LOW);
     delay(500);
   }
   ```

4. Klik **▶ Mulai** di toolbar atas. LED di kanvas akan berkedip tiap setengah detik.
5. Klik **Stop** untuk menghentikan simulasi kapan saja.

Itu saja — tidak perlu compiler, board fisik, atau instalasi tambahan untuk mencoba ide
pertamamu.

## 🧩 Panduan Fitur

### Editor Kode & Bantuan Menulis

Editor di sisi kiri (CodeMirror) mendukung sintaks C/C++ Arduino lengkap dengan:

- **Autocomplete** — mulai ketik nama fungsi (`digitalWr...`) dan editor menyarankan
  fungsi/konstanta Arduino yang cocok, lengkap dengan penjelasan singkat bahasa
  Indonesia. Daftar sarannya **sengaja hanya berisi yang benar-benar didukung
  simulator** — supaya tidak ada saran yang tampak benar tapi ternyata gagal dijalankan.
- **Baris error tersorot otomatis** — begitu simulasi gagal, baris penyebabnya diberi
  latar merah dan editor otomatis scroll ke sana. Tidak perlu mencari sendiri baris mana
  yang dimaksud di pesan error.
- **Kode panjang tetap nyaman dibaca** di layar sempit (HP) — baris otomatis dibungkus,
  bukan digulir horizontal.
- **Impor `.ino`** — buka file kode dari komputer lewat dialog Projek Saya (lihat di
  bawah), berguna untuk membuka tugas yang dikumpulkan siswa.

### Kanvas & Wiring

Board dan part (LED, sensor, dll) ditaruh bebas di kanvas — bisa digeser, di-zoom, dan
di-pan seperti kanvas gambar biasa. Klik **Tambah part** untuk memilih komponen baru;
part akan muncul di area kanvas yang sedang kamu lihat (bukan selalu di titik yang sama),
jadi tidak akan "hilang" walau kamu sudah menggeser pandangan jauh dari board.

Menyambungkan part ke board **tidak perlu menarik kabel** — klik badge ⚙ di kartu part,
pilih pin dari dropdown (dikelompokkan Digital/Analog/Power/Ground, pin yang sudah
terpakai part lain otomatis ditandai). Kabel di kanvas cuma gambaran visual dari pilihan
itu.

### Contoh Sketch Siap Pakai

Tombol 📖 di toolbar editor membuka daftar **26 contoh sketch**, urut dari paling dasar
ke paling kompleks — cocok dipakai sebagai urutan materi ajar:

blink LED, push button, saklar toggle, sensor gerak PIR, LED RGB, potensiometer, LDR,
sensor suhu DHT, sensor jarak ultrasonik, motor servo, buzzer, LCD 16×2 (paralel & I2C),
shift register, motor stepper, lampu berjalan, Serial Monitor/Plotter/input, EEPROM,
interrupt, struct/enum, array 2D, proyek gabungan, relay, dan RFID.

### Serial Monitor & Plotter

Panel di bawah kanvas punya dua tab:

- **Monitor** — log teks dari `Serial.print()`/`Serial.println()` di sketch, plus kotak
  untuk mengirim data balik ke board (dibaca lewat `Serial.read()`).
- **Plotter** — menggambar grafik garis dari baris Serial yang isinya **angka saja**.
  Satu baris boleh berisi beberapa nilai (dipisah spasi/koma) untuk menampilkan beberapa
  garis sekaligus:

  ```cpp
  Serial.print(nilai1);
  Serial.print(",");
  Serial.println(nilai2);   // -> tampil sebagai 2 garis di Plotter
  ```

  Cocok untuk memantau pembacaan sensor (LDR, potensiometer, DHT) secara visual.

### Pilihan Board: Uno / ESP32 / ESP8266

Dropdown di toolbar memilih board target. Ini bukan sekadar pengaturan compile —
**kanvas ikut berubah total**: gambar board, jumlah pin, label pin (GPIO ESP32 vs D0–D13
Uno vs D0–D8 NodeMCU), dan bahkan warna board (hijau/biru/ungu) menyesuaikan board yang
dipilih.

> ⚠️ Ganti board akan **melepas semua sambungan pin** part yang sudah ada di kanvas
> (part-nya sendiri tetap ada). Ini disengaja: pin dengan id yang sama (mis. `"D2"`) bisa
> berarti pin fisik yang benar-benar berbeda di board lain, jadi sambungan lama harus
> dipasang ulang secara sadar, bukan diam-diam salah tersambung.

### Upload ke Board Fisik

Tombol **Upload ke Board** meng-compile kode sungguhan (bukan simulasi) lalu menulisnya
ke board asli lewat kabel USB, langsung dari browser — **hanya di Chrome/Edge versi
desktop** (Web Serial API belum tersedia di browser HP mana pun).

- **Arduino Uno** — proses otomatis penuh, board reset sendiri ke mode flash.
- **ESP32 / ESP8266** — perlu menekan tombol **BOOT/FLASH** di board secara manual saat
  diminta (instruksinya tampil di layar); ini keterbatasan hardware ESP, bukan bug.
- Kalau upload lewat USB gagal (mis. driver bermasalah), ada tombol cadangan **Compile &
  Unduh .bin** khusus board ESP — hasil compile diunduh sebagai file, lalu tinggal
  di-flash pakai tool seperti `esptool.py`.

### Projek Saya (Simpan & Buka Banyak Sketch)

Tombol 📂 di toolbar editor membuka manajer projek — beda dari auto-save biasa (yang cuma
menyimpan satu draf terakhir), di sini kamu bisa punya **sampai 20 sketch tersimpan
sekaligus**, masing-masing dengan nama sendiri.

- **Simpan** — kode DAN rangkaian kanvas tersimpan sebagai satu kesatuan; dibuka lagi
  nanti akan persis seperti saat ditinggalkan. Nama yang sama akan menimpa (bukan bikin
  salinan baru).
- **Buka** kembali projek tersimpan kapan saja.
- **Unduh `.ino`** — file kode asli yang bisa dibuka di Arduino IDE, praktis untuk
  mengumpulkan tugas.
- **Impor `.ino`** — muat file dari komputer, misalnya untuk membuka tugas siswa.

### Reset Komponen

Tombol **Reset Komponen** di toolbar membersihkan seluruh part dari kanvas sekaligus —
tidak perlu menghapus satu per satu. **Board tidak ikut terhapus**, cuma komponen yang
sudah dirangkai. Tombol ini otomatis nonaktif kalau kanvas memang sudah kosong, dan akan
meminta konfirmasi dulu sebelum benar-benar menghapus (aksi ini tidak bisa dibatalkan).

### Tema Gelap / Terang

Tombol ☀️/🌙 di toolbar mengganti tampilan seluruh aplikasi. Pilihan tersimpan otomatis di
browser. Warna "fisik" komponen (papan board, layar LCD hijau, LED merah, dst) **sengaja
tidak ikut berubah** di kedua tema — itu warna hardware asli yang disimulasikan, bukan
bagian dari tampilan aplikasi.

### Yang Tersimpan Otomatis

Semuanya di browser (localStorage) — **tidak perlu akun, tidak perlu internet setelah
halaman termuat**:

- Draf kode & rangkaian kanvas yang sedang dikerjakan (auto-save, bukan perlu ditekan
  simpan)
- Daftar projek yang disimpan lewat "Projek Saya"
- Lebar panel editor, pilihan board, pilihan tema, alamat compile-server kustom (kalau
  diisi)

## 🛠️ Untuk Kontributor

Bagian ini untuk yang mau membaca/mengubah kodenya, bukan sekadar memakai aplikasinya.

### Struktur `src/`

| Folder | Isi |
| --- | --- |
| `editor/` | Editor kode (CodeMirror), autocomplete, kerangka sketch default, daftar contoh |
| `interpreter/` | Lexer, parser, AST, dan interpreter JS buat menjalankan kode `.ino` di kanvas (bukan compiler AVR sungguhan) |
| `canvas/` | Kanvas drag-and-drop (React Flow) — parts panel, node board & modul, tabel pin per board |
| `modules/` | Komponen visual tiap part (LED, button, buzzer, servo, DHT, LCD, RFID, dll) — satu folder per part |
| `hal/` | Hardware Abstraction Layer — jembatan antara interpreter dan objek modul di kanvas |
| `serial/` | Panel Serial: tab Monitor (log teks) dan Plotter (grafik dari baris angka) |
| `simulation/` | Store (zustand) status simulasi (running/stopped/error) |
| `upload/` | Alur upload ke board fisik: compile lewat compile-server (`compileClient.ts`), lalu flash via Web Serial (`flashArduino.ts` untuk AVR, `flashEsp.ts` untuk ESP) |
| `projects/` | Manajer "Projek Saya" (simpan/buka/unduh/impor) |
| `theme/` | Store tema gelap/terang |
| `components/` | Toolbar atas, status pill, dialog profil pengembang |

### Autocomplete tetap sinkron dengan interpreter

Daftar saran di [`arduinoCompletions.ts`](src/editor/arduinoCompletions.ts) **sengaja
hanya berisi yang benar-benar didukung interpreter** — menyarankan fungsi yang tidak ada
justru menyesatkan siswa. `arduinoCompletions.test.ts` mengecek tiap saran memang ada di
`arduinoInterpreter.ts`, jadi daftarnya tidak bisa diam-diam melenceng.

### Contoh sketch tetap sinkron dengan folder

Judul & deskripsi bahasa Indonesia untuk 26 contoh didaftarkan manual di
[`src/editor/examples.ts`](src/editor/examples.ts) — kalau menambah file `.ino` baru ke
`public/examples/`, tambahkan juga entry di sana; `examplesManifest.test.ts` akan gagal
kalau daftarnya tidak lagi cocok dengan isi folder.

### Warna Serial Plotter tervalidasi, bukan dipilih sembarangan

Warna seri di [`plotPalette.ts`](src/serial/plotPalette.ts) divalidasi terhadap surface
gelap kanvas (band lightness OKLCH, chroma, keterbacaan bagi buta warna, dan kontras).
Urutannya tetap dan tidak boleh di-cycle.

### Tema gelap/terang

Diterapkan lewat `<html data-theme="...">` ([`themeStore.ts`](src/theme/themeStore.ts)).
Token warna didefinisikan sekali di [`index.css`](src/index.css) (`:root` untuk gelap,
`:root[data-theme="light"]` untuk terang) — komponen lain otomatis ikut berubah karena
semuanya memakai `var(--...)`. Editor kode (CodeMirror) ikut berganti tema lewat prop
`theme="dark"`/`"light"` di [`CodeEditor.tsx`](src/editor/CodeEditor.tsx).

### Kunci localStorage

| Data | Kunci |
| --- | --- |
| Kode sketch — draf yang sedang dikerjakan (debounce 0,5 detik) | `arduino-wokwi-clone-source` |
| Rangkaian kanvas (`persist` zustand) | `arduino-wokwi-clone-wiring` |
| Projek tersimpan (maks. 20) | `arduino-wokwi-clone-projects` |
| Lebar panel editor | `arduino-wokwi-clone-editor-width` |
| Pilihan board aktif | `arduino-wokwi-clone-board` |
| Tema gelap/terang | `arduino-wokwi-clone-theme` |
| Alamat compile server (opsional) | `arduino-wokwi-clone-compile-server-url` |

Kunci `-source` dan `-wiring` adalah *draf otomatis* (selalu ketimpa), sedangkan
`-projects` adalah *simpanan eksplisit* yang hanya berubah kalau user menekan
Simpan/Hapus di dialog Projek Saya.

### Dua jalur "menjalankan kode" yang berbeda

- **Simulasi di kanvas** (tombol *Mulai*) — dijalankan sepenuhnya di browser oleh
  interpreter JS sendiri (`src/interpreter/`). Cepat, tidak butuh server, tapi bukan
  compiler AVR asli.
- **Upload ke board fisik** (tombol *Upload ke Board*) — kode dikirim ke `compile-server`
  (lihat [`compile-server/README.md`](compile-server/README.md)) yang meng-compile pakai
  `arduino-cli` sungguhan, lalu hasilnya diflash ke board asli lewat Web Serial API.

### Protokol upload per board

| | Arduino Uno | ESP32 / ESP8266 |
| --- | --- | --- |
| Protokol | STK500v1 / Optiboot ([`stk500Protocol.ts`](src/upload/stk500Protocol.ts)) | ROM bootloader / SLIP, mode `--no-stub` ala `esptool.py` ([`esptoolProtocol.ts`](src/upload/esptoolProtocol.ts)) |
| Masuk mode flash | Otomatis (pulsa DTR/RTS) | Manual — tekan & tahan BOOT/FLASH, tekan-lepas RST/EN, baru lepas BOOT/FLASH |
| Kecepatan | 115200 baud | 115200 baud, blok 1KB (tanpa stub loader — lebih sederhana untuk diimplementasikan ulang tanpa menyertakan biner stub per-chip) |

**Catatan jujur:** implementasi protokol ESP ditulis mengikuti dokumentasi resmi
Espressif dan diuji lewat bootloader ROM PALSU
([`esptoolProtocol.test.ts`](src/upload/__tests__/esptoolProtocol.test.ts)) yang
memvalidasi framing SLIP, checksum per blok, dan penulisan ke offset yang benar — **bukan
diuji ke board fisik sungguhan**. Uji dulu dengan board fisik sebelum dipakai siswa secara
luas; kalau gagal, tombol cadangan "Compile & Unduh .bin" tetap berfungsi independen dari
protokol Web Serial ini.

### Alamat compile-server

Dipilih dengan urutan prioritas berikut (lihat
[`compileServerSetting.ts`](src/upload/compileServerSetting.ts)):

1. **Setelan di browser** — dialog ⚙ Pengaturan di toolbar. Dipakai supaya ganti
   domain/VPS tidak perlu build & deploy ulang.
2. **`VITE_COMPILE_SERVER_URL`** saat build (mis. lewat `.env.local`).
3. Bawaan: `https://compile.codeteam.id`.

### Terkait

[`compile-server/`](compile-server/) — service Node.js + `arduino-cli` terpisah (Docker)
yang dipakai bersama oleh app ini dan app Flutter lain untuk compile jadi `.hex`/`.bin`
asli.
