// ============================================================
// 08_dht_sensor.ino
// Uji: Sensor DHT11/DHT22 (suhu & kelembapan).
// Geser slider suhu/kelembapan di panel -> nilai berubah di Serial.
// ============================================================
DHT dht(2, DHT11);

void setup(){
  Serial.begin(9600);
  dht.begin();
}

void loop(){
  float suhu = dht.readTemperature();
  float lembap = dht.readHumidity();
  Serial.print("Suhu: ");
  Serial.print(suhu);
  Serial.print(" C, Kelembapan: ");
  Serial.print(lembap);
  Serial.println(" %");
  delay(500);
}
