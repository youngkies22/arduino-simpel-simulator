// ============================================================
// 20_eeprom.ino
// Uji: EEPROM virtual (read/write/put/get).
// Nilai EEPROM bertahan walau kamu tekan Stop lalu Run lagi
// (hanya hilang jika benar-benar Reset).
// ============================================================
void setup(){
  Serial.begin(9600);

  int lama = EEPROM.read(0);
  Serial.print("Nilai lama di alamat 0: ");
  Serial.println(lama);

  int baru = lama + 1;
  EEPROM.write(0, baru);
  Serial.print("Nilai baru ditulis: ");
  Serial.println(baru);

  float suhu = 36.5;
  EEPROM.put(10, suhu);
  float bacaSuhu = 0;
  EEPROM.get(10, bacaSuhu);
  Serial.print("Suhu tersimpan: ");
  Serial.println(bacaSuhu);
}

void loop(){
}
