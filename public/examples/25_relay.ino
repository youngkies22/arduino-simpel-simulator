// ============================================================
// 25_relay.ino
// Uji: Modul Relay (pin 4).
// Relay ON/OFF tiap 2 detik -> lampu beban ikut nyala/mati.
// Bisa juga dikendalikan toggle switch (pin 3): aktifkan saklar
// untuk mode manual.
// ============================================================
#define PIN_RELAY 4
#define PIN_SAKLAR 3

void setup(){
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_SAKLAR, INPUT);
  Serial.begin(9600);
}

void loop(){
  if (digitalRead(PIN_SAKLAR) == HIGH) {
    // Mode manual: saklar aktif -> relay menyala terus.
    digitalWrite(PIN_RELAY, HIGH);
    Serial.println("Mode manual: relay ON");
    delay(500);
  } else {
    // Mode otomatis: relay berkedip tiap 2 detik.
    digitalWrite(PIN_RELAY, HIGH);
    Serial.println("Relay ON  (kontak tertutup)");
    delay(2000);
    digitalWrite(PIN_RELAY, LOW);
    Serial.println("Relay OFF (kontak terbuka)");
    delay(2000);
  }
}
