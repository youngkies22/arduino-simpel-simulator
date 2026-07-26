// ============================================================
// 05_rgb_led.ino
// Uji: RGB LED (pin 9=Merah, 10=Hijau, 11=Biru).
// LED akan berganti warna: merah -> hijau -> biru -> putih -> mati.
// ============================================================
void setup(){
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(11, OUTPUT);
}

void warna(int r, int g, int b) {
  analogWrite(9, r);
  analogWrite(10, g);
  analogWrite(11, b);
}

void loop(){
  warna(255, 0, 0);   // Merah
  delay(700);
  warna(0, 255, 0);   // Hijau
  delay(700);
  warna(0, 0, 255);   // Biru
  delay(700);
  warna(255, 255, 255); // Putih (campuran)
  delay(700);
  warna(0, 0, 0);     // Mati
  delay(700);
}
