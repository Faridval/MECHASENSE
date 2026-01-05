#include <Wire.h>
#include <Adafruit_MLX90614.h>

Adafruit_MLX90614 mlx = Adafruit_MLX90614();

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);   // SDA, SCL ESP32

  if (!mlx.begin()) {
    Serial.println("❌ MLX90614 tidak terdeteksi!");
    while (1);
  }

  Serial.println("✅ MLX90614 siap");
}

void loop() {
  Serial.print("Ambient Temp: ");
  Serial.print(mlx.readAmbientTempC());
  Serial.println(" °C");

  Serial.print("Object Temp  : ");
  Serial.print(mlx.readObjectTempC());
  Serial.println(" °C");

  Serial.println("---------------------");
  delay(1000);
}