// ============================================================
// 17_serial_monitor.ino
// Uji: Serial Monitor — print/println berbagai tipe data.
// Buka tab "Monitor" di panel Serial.
// ============================================================
int hitung = 0;

void setup(){
  Serial.begin(9600);
  Serial.println("=== Arduino Simulator ===");
}

void loop(){
  Serial.print("Hitung ke-");
  Serial.print(hitung);
  Serial.print(" | biner: ");
  Serial.print(hitung, BIN);
  Serial.print(" | hex: ");
  Serial.println(hitung, HEX);
  hitung++;
  delay(400);
}
