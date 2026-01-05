#include <Wire.h>
#include <MPU6050.h>

MPU6050 mpu;

const int SAMPLE_COUNT = 500;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Wire.begin(21, 22);
  mpu.initialize();

  Serial.println("MPU6050 Vibration Monitoring Started");
  Serial.println("RMS,Peak,Mean,StdDev,Variance,CrestFactor,Status");
}

void loop() {
  float data[SAMPLE_COUNT];
  float sum = 0;
  float sumSq = 0;
  float peak = 0;

  // Sampling
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    int16_t axRaw, ayRaw, azRaw;
    mpu.getAcceleration(&axRaw, &ayRaw, &azRaw);

    float ax = axRaw / 16384.0;
    float ay = ayRaw / 16384.0;
    float az = azRaw / 16384.0;

    // Resultant acceleration (tanpa gravitasi)
    float resultant = sqrt(ax * ax + ay * ay + az * az) - 1.0;
    if (resultant < 0) resultant = -resultant;

    data[i] = resultant;
    sum += resultant;
    sumSq += resultant * resultant;

    if (resultant > peak) peak = resultant;

    delayMicroseconds(2000);
  }

  // Feature extraction
  float mean = sum / SAMPLE_COUNT;
  float rms = sqrt(sumSq / SAMPLE_COUNT);
  float variance = (sumSq / SAMPLE_COUNT) - (mean * mean);
  float stdDev = sqrt(variance);
  float crestFactor = peak / rms;

  // Status klasifikasi (motor 1 fasa)
  String status;
  if (rms < 0.05) {
    status = "NORMAL";
  } else if (rms < 0.15) {
    status = "WARNING";
  } else {
    status = "FAULT";
  }

  // Output format CSV (DATASET)
  Serial.print(rms, 5); Serial.print(",");
  Serial.print(peak, 5); Serial.print(",");
  Serial.print(mean, 5); Serial.print(",");
  Serial.print(stdDev, 5); Serial.print(",");
  Serial.print(variance, 5); Serial.print(",");
  Serial.print(crestFactor, 3); Serial.print(",");
  Serial.println(status);

  delay(2000);
}