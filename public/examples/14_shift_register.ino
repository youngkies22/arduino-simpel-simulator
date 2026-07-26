// ============================================================
// 14_shift_register.ino
// Uji: LED Array 8-bit via shiftOut() (74HC595).
// LED harus "berjalan" dari kanan ke kiri (running LED).
// ============================================================
const int DATA_PIN = 11;
const int CLOCK_PIN = 13;

void setup(){
}

void loop(){
  for (int i = 0; i < 8; i++) {
    int pola = 1 << i; // Satu bit menyala, bergeser tiap iterasi.
    shiftOut(DATA_PIN, CLOCK_PIN, MSBFIRST, pola);
    delay(150);
  }
}
