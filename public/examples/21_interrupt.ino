// ============================================================
// 21_interrupt.ino
// Uji: Interrupt virtual (attachInterrupt).
// Tekan Push Button (pin 2) -> penghitung bertambah otomatis
// walau loop() sedang delay(), karena ISR terpicu oleh interrupt.
// ============================================================
volatile int penghitung = 0;

void tombolDitekan() {
  penghitung++;
}

void setup(){
  Serial.begin(9600);
  pinMode(2, INPUT);
  attachInterrupt(digitalPinToInterrupt(2), tombolDitekan, RISING);
}

void loop(){
  Serial.print("Jumlah tekan: ");
  Serial.println(penghitung);
  delay(300);
}
