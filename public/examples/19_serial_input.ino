// ============================================================
// 19_serial_input.ino
// Uji: Input Serial — ketik angka di kolom input bawah panel
// Serial Monitor, tekan kirim, lalu lihat LED (13) menyala
// sesuai HIGH (1) / LOW (0) yang kamu kirim.
// ============================================================
void setup(){
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Ketik 1 untuk nyalakan LED, 0 untuk matikan.");
}

void loop(){
  if (Serial.available() > 0) {
    int nilai = Serial.parseInt();
    digitalWrite(13, nilai == 1 ? HIGH : LOW);
    Serial.print("Diterima: ");
    Serial.println(nilai);
  }
  delay(50);
}
