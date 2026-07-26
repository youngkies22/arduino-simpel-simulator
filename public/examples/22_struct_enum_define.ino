// ============================================================
// 22_struct_enum_define.ino
// Uji: #define, struct, enum, typedef.
// Tidak ada hardware — cek hasilnya di Serial Monitor.
// ============================================================
#define PIN_LED 13
#define VERSI "1.0"

typedef unsigned long ulong;

enum ModeLampu { MATI, NYALA, KEDIP };

struct Titik {
  int x;
  int y;
};

void setup(){
  Serial.begin(9600);

  Serial.print("Versi: ");
  Serial.println(VERSI);

  Serial.print("Pin LED dari #define: ");
  Serial.println(PIN_LED);

  ModeLampu mode = KEDIP;
  Serial.print("Mode (enum): ");
  Serial.println(mode); // KEDIP = 2

  Titik posisi = {10, 20};
  posisi.x = posisi.x + 5;
  Serial.print("Titik x=");
  Serial.print(posisi.x);
  Serial.print(" y=");
  Serial.println(posisi.y);

  ulong waktu = millis();
  Serial.print("Waktu (typedef ulong): ");
  Serial.println(waktu);
}

void loop(){
}
