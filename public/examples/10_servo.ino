// ============================================================
// 10_servo.ino
// Uji: Servo motor.
// Lengan servo virtual harus berayun 0 -> 180 -> 0 derajat.
// ============================================================
Servo myservo;

void setup(){
  myservo.attach(9);
}

void loop(){
  for (int sudut = 0; sudut <= 180; sudut += 5) {
    myservo.write(sudut);
    delay(30);
  }
  for (int sudut = 180; sudut >= 0; sudut -= 5) {
    myservo.write(sudut);
    delay(30);
  }
}
