// ============================================================
// 15_stepper.ino
// Uji: Motor Stepper.
// Piringan stepper virtual harus berputar searah lalu berbalik.
// ============================================================
const int LANGKAH_PER_PUTARAN = 200;
Stepper stepper(LANGKAH_PER_PUTARAN, 8, 9, 10, 11);

void setup(){
  stepper.setSpeed(60); // RPM
}

void loop(){
  stepper.step(LANGKAH_PER_PUTARAN);   // Satu putaran penuh maju.
  delay(500);
  stepper.step(-LANGKAH_PER_PUTARAN);  // Satu putaran penuh mundur.
  delay(500);
}
