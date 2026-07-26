// ============================================================
// 03_toggle_switch.ino
// Uji: Toggle Switch (pin 3) -> LED (pin 13).
// Aktifkan saklar -> LED menyala tetap (tidak perlu ditahan).
// ============================================================
void setup(){
  pinMode(13, OUTPUT);
  pinMode(3, INPUT);
  Serial.begin(9600);
}

void loop(){
  int saklar = digitalRead(3);
  digitalWrite(13, saklar);
  Serial.println(saklar);
  delay(150);
}
