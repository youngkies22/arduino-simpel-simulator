// ============================================================
// 26_rfid.ino
// Uji: RFID RC522 (MFRC522) — kontrol akses sederhana.
// 1. Tekan tombol "Tempel" di widget RFID -> UID terbaca.
// 2. Jika UID cocok dengan kartu master (A3 5F 01 9C default),
//    akses DITERIMA: relay (pin 4) terbuka + LED hijau.
// 3. Tekan tombol acak (ganti kartu) lalu tempel lagi ->
//    akses DITOLAK + buzzer bunyi.
// ============================================================
#define PIN_RELAY 4
#define PIN_BUZZER 8

MFRC522 rfid(10, 9); // SS=10, RST=9 (diabaikan simulator)

String kartuMaster = "A3 5F 01 9C";

void setup(){
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  pinMode(PIN_RELAY, OUTPUT);
  Serial.println("Tempelkan kartu RFID...");
}

void loop(){
  // Tunggu kartu ditempelkan.
  if (!rfid.PICC_IsNewCardPresent()) {
    delay(50);
    return;
  }
  if (!rfid.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  // Baca UID sebagai teks (bantuan simulator),
  // dan juga per-byte seperti library MFRC522 asli.
  String uid = rfid.getUidString();
  Serial.print("Kartu terdeteksi, UID: ");
  Serial.println(uid);

  Serial.print("Byte pertama UID: ");
  Serial.println(rfid.uid.uidByte[0], HEX);

  if (uid.equals(kartuMaster)) {
    Serial.println(">> AKSES DITERIMA - pintu terbuka");
    digitalWrite(PIN_RELAY, HIGH); // Buka kunci pintu.
    delay(2000);
    digitalWrite(PIN_RELAY, LOW);  // Kunci lagi.
  } else {
    Serial.println(">> AKSES DITOLAK - kartu tidak dikenal!");
    tone(PIN_BUZZER, 880, 400);    // Alarm singkat.
    delay(500);
  }

  rfid.PICC_HaltA();
}
