// ============================================================
// 13_lcd_i2c.ino
// Uji: LCD I2C (LiquidCrystal_I2C) — memakai LCD virtual yang
// sama dengan LiquidCrystal biasa, hanya API konstruktor beda.
// ============================================================
LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup(){
  lcd.init();
  lcd.backlight();
  lcd.print("LCD I2C OK!");
  lcd.setCursor(0, 1);
  lcd.print("Alamat: 0x27");
}

void loop(){
  // Statis saja untuk uji tampilan awal.
}
