// ============================================================
// 23_array_2d.ino
// Uji: Array 1D, 2D, dan operator bit.
// Tidak ada hardware — cek hasilnya di Serial Monitor.
// ============================================================
void setup(){
  Serial.begin(9600);

  // Array 1D biasa.
  int nilai[5] = {10, 20, 30, 40, 50};
  int total = 0;
  for (int i = 0; i < 5; i++) {
    total += nilai[i];
  }
  Serial.print("Total array 1D: ");
  Serial.println(total);

  // Array 2D (matriks 2x3).
  int matriks[2][3] = {
    {1, 2, 3},
    {4, 5, 6}
  };
  int jumlah = 0;
  for (int baris = 0; baris < 2; baris++) {
    for (int kolom = 0; kolom < 3; kolom++) {
      jumlah += matriks[baris][kolom];
    }
  }
  Serial.print("Total array 2D: ");
  Serial.println(jumlah);

  // Operasi bit.
  int x = 0;
  bitSet(x, 0);
  bitSet(x, 2);
  Serial.print("x setelah bitSet(0) & bitSet(2): ");
  Serial.println(x); // 5 (0b101)
}

void loop(){
}
