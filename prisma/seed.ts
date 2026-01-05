/**
 * Prisma Seed Script
 * Populates database with dummy motor and sensor readings for testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('[SEED] Starting database seeding...');
  
  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.alert.deleteMany({});
  await prisma.healthAnalysis.deleteMany({});
  await prisma.sensorReading.deleteMany({});
  await prisma.motor.deleteMany({});
  
  // Create default motor
  console.log('Creating motor...');
  const motor = await prisma.motor.create({
    data: {
      id: 'default-motor-1',
      name: 'Motor Utama Lantai 2',
      location: 'Workshop Area A',
      ratedPower: 7.5, // kW
      ratedCurrent: 15.0, // A
      ratedVoltage: 380.0, // V
    },
  });
  
  console.log(`[SUCCESS] Created motor: ${motor.name} (${motor.id})`);
  
  // Generate sensor readings (last 24 hours, every 5 minutes = 288 readings)
  console.log('Generating sensor readings...');
  const now = new Date();
  const readings = [];
  const readingsCount = 100; // Generate 100 readings for demo
  
  for (let i = readingsCount - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000); // 5 minutes apart
    
    // Simulate realistic sensor values with some variation
    // Add some anomalies for testing alert system
    const isAnomaly = Math.random() < 0.05; // 5% chance of anomaly
    
    const baseVoltage = 220;
    const baseCurrent = 3.5;
    const baseTemp = 65;
    const baseVibration = 2.0;
    
    const reading = await prisma.sensorReading.create({
      data: {
        motorId: motor.id,
        timestamp,
        
        // PZEM-004T Wattmeter data
        gridVoltage: isAnomaly ? randomBetween(210, 235) : randomBetween(baseVoltage - 5, baseVoltage + 5),
        motorCurrent: isAnomaly ? randomBetween(4.5, 6) : randomBetween(baseCurrent - 0.5, baseCurrent + 0.5),
        powerConsumption: randomBetween(700, 900),
        powerFactor: isAnomaly ? randomBetween(0.65, 0.75) : randomBetween(0.85, 0.95),
        dailyEnergyKwh: randomBetween(15, 25) + (readingsCount - i) * 0.05,
        gridFrequency: randomBetween(49.8, 50.2),
        
        // MPU6050 Vibration data
        vibrationRms: isAnomaly ? randomBetween(3.5, 5) : randomBetween(baseVibration - 0.5, baseVibration + 0.5),
        faultFrequency: randomBetween(45, 55),
        rotorUnbalanceScore: randomBetween(85, 98),
        bearingHealthScore: randomBetween(80, 95),
        
        // MLX90614 IR Temperature
        motorSurfaceTemp: isAnomaly ? randomBetween(75, 90) : randomBetween(baseTemp - 5, baseTemp + 5),
        thermalAnomalyIndex: randomBetween(0, 20),
        panelTemp: null,
        
        // DS18B20 Bearing Temperature
        bearingTemp: isAnomaly ? randomBetween(70, 88) : randomBetween(baseTemp - 3, baseTemp + 3),
        
        // GP2Y1010 Dust Sensor
        dustDensity: isAnomaly ? randomBetween(80, 120) : randomBetween(20, 60),
        soilingLossPercent: randomBetween(1, 8),
        
        rawPayload: JSON.stringify({
          source: 'seed-script',
          version: '1.0',
          anomaly: isAnomaly,
        }),
      },
    });
    
    readings.push(reading);
    
    // Create alerts for anomalies
    if (isAnomaly) {
      if (reading.gridVoltage > 230) {
        await prisma.alert.create({
          data: {
            motorId: motor.id,
            timestamp,
            severity: 'CRITICAL',
            parameter: 'gridVoltage',
            value: reading.gridVoltage,
            message: `Grid Voltage melampaui batas aman: ${reading.gridVoltage.toFixed(1)} V`,
            status: 'OPEN',
          },
        });
      }
      
      if (reading.motorCurrent > 5.5) {
        await prisma.alert.create({
          data: {
            motorId: motor.id,
            timestamp,
            severity: 'CRITICAL',
            parameter: 'motorCurrent',
            value: reading.motorCurrent,
            message: `Motor Current melampaui batas aman: ${reading.motorCurrent.toFixed(2)} A`,
            status: 'OPEN',
          },
        });
      }
      
      if (reading.motorSurfaceTemp > 85) {
        await prisma.alert.create({
          data: {
            motorId: motor.id,
            timestamp,
            severity: 'CRITICAL',
            parameter: 'motorSurfaceTemp',
            value: reading.motorSurfaceTemp,
            message: `Motor Temperature melampaui batas aman: ${reading.motorSurfaceTemp.toFixed(1)} °C`,
            status: 'OPEN',
          },
        });
      }
      
      if (reading.vibrationRms > 4.5) {
        await prisma.alert.create({
          data: {
            motorId: motor.id,
            timestamp,
            severity: 'CRITICAL',
            parameter: 'vibrationRms',
            value: reading.vibrationRms,
            message: `Vibration RMS melampaui batas aman: ${reading.vibrationRms.toFixed(2)} mm/s`,
            status: 'OPEN',
          },
        });
      }
    }
    
    // Progress indicator
    if ((readingsCount - i) % 20 === 0) {
      console.log(`  Generated ${readingsCount - i}/${readingsCount} readings...`);
    }
  }
  
  console.log(`[SUCCESS] Created ${readings.length} sensor readings`);
  
  // Create some health analyses
  console.log('Creating health analyses...');
  const healthAnalysis = await prisma.healthAnalysis.create({
    data: {
      motorId: motor.id,
      healthScoreMl: 82,
      healthCategory: 'Healthy',
      expertDiagnosis: 'Motor dalam kondisi normal dengan performa optimal',
      expertRecommendation: 'Lanjutkan monitoring berkala. Lakukan maintenance preventif sesuai jadwal.',
      rawRulesMatched: JSON.stringify([]),
    },
  });
  
  console.log(`[SUCCESS] Created health analysis: Score ${healthAnalysis.healthScoreMl}`);
  
  // Get alert count
  const alertCount = await prisma.alert.count({
    where: { motorId: motor.id, status: 'OPEN' },
  });
  
  console.log(`[SUCCESS] Created ${alertCount} alerts`);
  
  console.log('\n[COMPLETE] Database seeding completed successfully!');
  console.log('\nSummary:');
  console.log(`  - Motors: 1`);
  console.log(`  - Sensor Readings: ${readings.length}`);
  console.log(`  - Health Analyses: 1`);
  console.log(`  - Active Alerts: ${alertCount}`);
  console.log('\nYou can now run: npm run dev');
}

main()
  .catch((e) => {
    console.error('[ERROR] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

