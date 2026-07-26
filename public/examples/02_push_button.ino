// ============================================================
// 02_push_button.ino
// Uji: Push Button (pin 2) -> LED (pin 13).
// Tekan dan tahan tombol virtual -> LED menyala.
// ============================================================
void setup(){
  pinMode(13, OUTPUT);
  pinMode(2, INPUT);
  Serial.begin(9600);
}

void loop(){
  int tombol = digitalRead(2);
  digitalWrite(13, tombol);
  Serial.println(tombol == HIGH ? "Ditekan" : "Dilepas");
  delay(150);
}
