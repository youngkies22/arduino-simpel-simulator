// ============================================================
// 12_lcd_16x2.ino
// Uji: LCD 16x2 (LiquidCrystal).
// Layar harus menampilkan teks & angka yang berjalan (counter).
// ============================================================
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
int hitung = 0;

void setup(){
  lcd.begin(16, 2);
  lcd.print("Arduino Simulator");
}

void loop(){
  lcd.setCursor(0, 1);
  lcd.print("Counter: ");
  lcd.print(hitung);
  hitung++;
  delay(500);
  lcd.setCursor(9, 1);
  lcd.print("      "); // Bersihkan sisa angka lama.
}
