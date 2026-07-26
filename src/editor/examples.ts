/** Satu contoh sketch siap pakai — file-nya ada di `public/examples/` dan diambil
 * lewat fetch saat dipilih (bukan di-bundle), supaya bundel JS tidak membengkak
 * oleh 26 sketch yang jarang dibuka bersamaan. */
export interface SketchExample {
  /** Nama file di public/examples/ */
  file: string;
  /** Judul yang tampil di daftar. */
  title: string;
  /** Penjelasan singkat buat siswa: apa yang dipelajari dari contoh ini. */
  description: string;
}

/** Daftar contoh yang tampil di dialog "Contoh". Urutannya sengaja dari paling dasar
 * ke paling kompleks (sesuai nomor file), jadi bisa dipakai sebagai urutan materi.
 *
 * Kalau menambah file baru di public/examples/, tambahkan juga entry di sini —
 * `examplesManifest.test.ts` akan gagal kalau daftar ini tidak lagi cocok dengan
 * isi foldernya, jadi ketimpangannya ketahuan lebih awal (bukan pas dibuka siswa). */
export const SKETCH_EXAMPLES: SketchExample[] = [
  { file: '01_blink_led.ino', title: '01 · Blink LED', description: 'Menyalakan dan mematikan LED — dasar digitalWrite dan delay.' },
  { file: '02_push_button.ino', title: '02 · Push Button', description: 'Membaca tombol dengan digitalRead dan INPUT_PULLUP.' },
  { file: '03_toggle_switch.ino', title: '03 · Saklar Toggle', description: 'Saklar on/off yang menahan posisinya.' },
  { file: '04_pir_motion.ino', title: '04 · Sensor Gerak PIR', description: 'Mendeteksi gerakan orang dengan sensor PIR.' },
  { file: '05_rgb_led.ino', title: '05 · LED RGB', description: 'Mencampur warna merah/hijau/biru dengan analogWrite (PWM).' },
  { file: '06_potentiometer.ino', title: '06 · Potensiometer', description: 'Membaca nilai analog 0–1023 dengan analogRead.' },
  { file: '07_ldr.ino', title: '07 · Sensor Cahaya (LDR)', description: 'Mengukur terang-gelap dan memicu aksi otomatis.' },
  { file: '08_dht_sensor.ino', title: '08 · Sensor Suhu DHT', description: 'Membaca suhu dan kelembapan lewat library DHT.' },
  { file: '09_ultrasonic.ino', title: '09 · Sensor Jarak Ultrasonik', description: 'Mengukur jarak dengan HC-SR04 (trigger & echo).' },
  { file: '10_servo.ino', title: '10 · Motor Servo', description: 'Menggerakkan servo ke sudut tertentu.' },
  { file: '11_buzzer.ino', title: '11 · Buzzer', description: 'Membunyikan nada dengan tone dan noTone.' },
  { file: '12_lcd_16x2.ino', title: '12 · LCD 16x2 (paralel)', description: 'Menampilkan teks di LCD lewat pin paralel.' },
  { file: '13_lcd_i2c.ino', title: '13 · LCD I2C', description: 'LCD yang sama tapi hemat pin, cukup 2 kabel (SDA/SCL).' },
  { file: '14_shift_register.ino', title: '14 · Shift Register 74HC595', description: 'Mengendalikan 8 output hanya dengan 3 pin.' },
  { file: '15_stepper.ino', title: '15 · Motor Stepper', description: 'Memutar motor stepper per langkah presisi.' },
  { file: '16_running_led_pins.ino', title: '16 · Running LED', description: 'Lampu berjalan memakai array pin dan perulangan.' },
  { file: '17_serial_monitor.ino', title: '17 · Serial Monitor', description: 'Mengirim data ke komputer dengan Serial.print.' },
  { file: '18_serial_plotter.ino', title: '18 · Serial Plotter', description: 'Menampilkan data sensor sebagai grafik.' },
  { file: '19_serial_input.ino', title: '19 · Input dari Serial', description: 'Mengendalikan Arduino dengan mengetik perintah.' },
  { file: '20_eeprom.ino', title: '20 · EEPROM', description: 'Menyimpan data agar tidak hilang saat listrik mati.' },
  { file: '21_interrupt.ino', title: '21 · Interrupt', description: 'Menanggapi kejadian seketika tanpa menunggu loop.' },
  { file: '22_struct_enum_define.ino', title: '22 · Struct, Enum & Define', description: 'Merapikan kode dengan tipe data buatan sendiri.' },
  { file: '23_array_2d.ino', title: '23 · Array 2 Dimensi', description: 'Menyimpan data berbentuk tabel/matriks.' },
  { file: '24_all_in_one.ino', title: '24 · Gabungan Semua', description: 'Proyek besar yang memakai banyak komponen sekaligus.' },
  { file: '25_relay.ino', title: '25 · Relay', description: 'Menyalakan perangkat listrik tegangan tinggi dengan aman.' },
  { file: '26_rfid.ino', title: '26 · RFID RC522', description: 'Membaca kartu RFID dan mencocokkan UID-nya.' },
];

/** Ambil isi file contoh dari public/examples/. BASE_URL dipakai supaya tetap benar
 * kalau app di-deploy di sub-path (mis. https://domain/simulator/). */
export async function fetchExampleSource(file: string): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}examples/${file}`);
  if (!response.ok) {
    throw new Error(`Gagal memuat contoh (HTTP ${response.status}).`);
  }
  return response.text();
}
