// ============================================================
// 07_ldr.ino
// Uji: LDR / Sensor Cahaya (A1).
// Geser slider cahaya -> di bawah ambang gelap, LED (13) menyala
// otomatis seperti lampu jalan.
// ============================================================
const int AMBANG_GELAP = 400;

void setup(){
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop(){
  int cahaya = analogRead(A1);
  Serial.println(cahaya);
  if (cahaya < AMBANG_GELAP) {
    digitalWrite(13, HIGH); // Gelap -> lampu nyala.
  } else {
    digitalWrite(13, LOW);  // Terang -> lampu mati.
  }
  delay(150);
}
