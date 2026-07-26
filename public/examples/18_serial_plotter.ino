// ============================================================
// 18_serial_plotter.ino
// Uji: Serial Plotter — grafik gelombang sinus realtime.
// Buka tab "Plotter" di panel Serial untuk melihat grafiknya.
// ============================================================
float sudut = 0;

void setup(){
  Serial.begin(9600);
}

void loop(){
  float nilai1 = sin(sudut) * 100;
  float nilai2 = cos(sudut) * 100;
  // Dua kolom dipisah koma -> tampil sebagai 2 seri grafik.
  Serial.print(nilai1);
  Serial.print(",");
  Serial.println(nilai2);
  sudut += 0.1;
  delay(50);
}
