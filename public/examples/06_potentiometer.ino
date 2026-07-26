// ============================================================
// 06_potentiometer.ino
// Uji: Potensiometer (A0).
// Geser slider potensiometer -> nilai 0..1023 tampil di Serial
// dan kecerahan LED (pin 13) ikut berubah.
// ============================================================
void setup(){
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop(){
  int nilai = analogRead(A0);
  int pwm = map(nilai, 0, 1023, 0, 255);
  analogWrite(13, pwm);
  Serial.println(nilai);
  delay(100);
}
