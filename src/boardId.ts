/**
 * Identitas board — dipakai lintas lapisan (canvas, HAL, interpreter, upload) yang
 * masing-masing SENGAJA tidak saling bergantung satu sama lain (lihat catatan desain
 * di arduinoInterpreter.ts & wiringAwareController.ts). Ditaruh di sini (bukan di
 * salah satu lapisan itu) supaya tidak ada satu pun yang harus mengimpor dari yang lain
 * cuma demi tipe 3-string ini.
 */
export type BoardId = 'uno' | 'esp32' | 'esp8266';
