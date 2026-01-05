#include <PZEM004Tv30.h>

#define RXD2 16
#define TXD2 17

HardwareSerial pzemSerial(2);
PZEM004Tv30 pzem(pzemSerial, RXD2, TXD2);

void setup() {
  Serial.begin(115200);

  pzemSerial.begin(9600, SERIAL_8N1, RXD2, TXD2);

  Serial.println("PZEM test mulai...");
}

void loop() {
  float voltage = pzem.voltage();
  float current = pzem.current();
  float power   = pzem.power();
  float energy  = pzem.energy();
  float freq    = pzem.frequency();
  float pf      = pzem.pf();

  if (isnan(voltage)) {
    Serial.println("❌ PZEM TIDAK TERBACA");
  } else {
    Serial.println("=== DATA PZEM ===");
    Serial.print("Tegangan : "); Serial.print(voltage); Serial.println(" V");
    Serial.print("Arus     : "); Serial.print(current); Serial.println(" A");
    Serial.print("Daya     : "); Serial.print(power);   Serial.println(" W");
    Serial.print("Energi   : "); Serial.print(energy);  Serial.println(" Wh");
    Serial.print("Frekuensi: "); Serial.print(freq);    Serial.println(" Hz");
    Serial.print("PF       : "); Serial.println(pf);
  }

  delay(2000);
}