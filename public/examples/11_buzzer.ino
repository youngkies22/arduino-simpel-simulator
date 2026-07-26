// ============================================================
// 11_buzzer.ino
// Uji: Buzzer (tone/noTone).
// Ikon speaker harus berdenyut & frekuensi berganti tiap nada.
// ============================================================
const int BUZZER_PIN = 8;

int nada[] = {262, 294, 330, 349, 392, 440, 494, 523}; // C D E F G A B C

void setup(){
}

void loop(){
  for (int i = 0; i < 8; i++) {
    tone(BUZZER_PIN, nada[i]);
    delay(300);
    noTone(BUZZER_PIN);
    delay(100);
  }
  delay(1000);
}
