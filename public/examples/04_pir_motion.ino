// ============================================================
// 04_pir_motion.ino
// Uji: Sensor Gerak PIR (pin 7).
// Nyalakan switch PIR di panel -> Serial mencetak "Gerakan!".
// ============================================================
void setup(){
  pinMode(7, INPUT);
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop(){
  int gerak = digitalRead(7);
  digitalWrite(13, gerak);
  if (gerak == HIGH) {
    Serial.println("Gerakan terdeteksi!");
  } else {
    Serial.println("Aman, tidak ada gerakan.");
  }
  delay(300);
}
