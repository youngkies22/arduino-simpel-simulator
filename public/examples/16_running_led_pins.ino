// ============================================================
// 16_running_led_pins.ino
// Uji: Panel "PIN DIGITAL (OUTPUT)" — LED berjalan di 6 pin bebas.
// Semua pin yang di-pinMode(OUTPUT) otomatis muncul di panel ini.
// ============================================================
int pin[] = {3, 4, 5, 6, 7, 8};
const int JUMLAH_PIN = 6;

void setup(){
  for (int i = 0; i < JUMLAH_PIN; i++) {
    pinMode(pin[i], OUTPUT);
  }
}

void loop(){
  for (int i = 0; i < JUMLAH_PIN; i++) {
    digitalWrite(pin[i], HIGH);
    delay(120);
    digitalWrite(pin[i], LOW);
  }
}
