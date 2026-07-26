// ============================================================
// 24_all_in_one.ino
// Uji gabungan: hampir semua modul aktif sekaligus.
// - LED (13) berkedip mengikuti tombol (2)
// - RGB LED (9,10,11) mengikuti potensiometer (A0)
// - Servo mengikuti LDR (A1)
// - Buzzer bunyi singkat tiap 2 detik
// - LCD menampilkan suhu DHT & jarak ultrasonic
// - Serial Monitor mencetak semua sensor
// ============================================================
#define PIN_LED 13
#define PIN_BUZZER 8
#define PIN_TRIG 6
#define PIN_ECHO 7

Servo myservo;
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
DHT dht(2, DHT11);

void setup(){
  Serial.begin(9600);
  pinMode(PIN_LED, OUTPUT);
  pinMode(2, INPUT);
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  myservo.attach(9);
  lcd.begin(16, 2);
  dht.begin();
}

void loop(){
  // Tombol -> LED
  int tombol = digitalRead(2);
  digitalWrite(PIN_LED, tombol);

  // Potensiometer -> RGB (merah & hijau)
  int pot = analogRead(A0);
  int pwm = map(pot, 0, 1023, 0, 255);
  analogWrite(9, pwm);
  analogWrite(10, 255 - pwm);

  // LDR -> Servo
  int ldr = analogRead(A1);
  int sudut = map(ldr, 0, 1023, 0, 180);
  myservo.write(sudut);

  // DHT -> LCD
  float suhu = dht.readTemperature();
  lcd.setCursor(0, 0);
  lcd.print("Suhu: ");
  lcd.print(suhu);

  // Ultrasonic -> LCD baris 2
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  long durasi = pulseIn(PIN_ECHO, HIGH);
  long jarak = durasi / 58;
  lcd.setCursor(0, 1);
  lcd.print("Jarak: ");
  lcd.print(jarak);
  lcd.print(" cm ");

  // Serial log lengkap
  Serial.print("Tombol=");
  Serial.print(tombol);
  Serial.print(" Pot=");
  Serial.print(pot);
  Serial.print(" LDR=");
  Serial.print(ldr);
  Serial.print(" Suhu=");
  Serial.print(suhu);
  Serial.print(" Jarak=");
  Serial.println(jarak);

  // Buzzer bunyi singkat tiap perulangan
  tone(PIN_BUZZER, 440, 100);

  delay(300);
}
