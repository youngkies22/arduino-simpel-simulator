// ============================================================
// 09_ultrasonic.ino
// Uji: Sensor Jarak Ultrasonic HC-SR04.
// Geser slider jarak di panel -> nilai cm berubah di Serial.
// (Pola trig/echo standar Arduino tetap dipakai agar sketch
// sama persis dengan kode board asli.)
// ============================================================
const int TRIG_PIN = 6;
const int ECHO_PIN = 7;

void setup(){
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.begin(9600);
}

void loop(){
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long durasi = pulseIn(ECHO_PIN, HIGH);
  long jarak = durasi / 58; // konversi mikrodetik -> cm

  Serial.print("Jarak: ");
  Serial.print(jarak);
  Serial.println(" cm");
  delay(300);
}
