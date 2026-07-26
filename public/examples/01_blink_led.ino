// ============================================================
// 01_blink_led.ino
// Uji: LED (pin 13) — LED harus berkedip nyala/mati tiap 500ms.
// ============================================================
void setup(){
  pinMode(13, OUTPUT);
}

void loop(){
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
