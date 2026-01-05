#include <OneWire.h>
#include <DallasTemperature.h>

#define ONE_WIRE_BUS 14   // D14 = GPIO14

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(9600);
  sensors.begin();
  Serial.println("DS18B20 Test - D14");
}

void loop() {
  sensors.requestTemperatures();
  float suhu = sensors.getTempCByIndex(0);

  if (suhu == DEVICE_DISCONNECTED_C) {
    Serial.println("❌ Sensor TIDAK TERBACA");
  } else {
    Serial.print("🌡 Suhu: ");
    Serial.print(suhu);
    Serial.println(" °C");
  }

  delay(1000);
}