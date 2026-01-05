-- CreateTable
CREATE TABLE "Motor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "ratedPower" REAL NOT NULL,
    "ratedCurrent" REAL NOT NULL,
    "ratedVoltage" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "motorId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gridVoltage" REAL NOT NULL,
    "motorCurrent" REAL NOT NULL,
    "powerConsumption" REAL NOT NULL,
    "powerFactor" REAL NOT NULL,
    "dailyEnergyKwh" REAL NOT NULL,
    "gridFrequency" REAL NOT NULL,
    "vibrationRms" REAL NOT NULL,
    "faultFrequency" REAL,
    "rotorUnbalanceScore" REAL NOT NULL,
    "bearingHealthScore" REAL NOT NULL,
    "motorSurfaceTemp" REAL NOT NULL,
    "thermalAnomalyIndex" REAL,
    "panelTemp" REAL,
    "bearingTemp" REAL NOT NULL,
    "dustDensity" REAL NOT NULL,
    "soilingLossPercent" REAL NOT NULL,
    "rawPayload" TEXT,
    CONSTRAINT "SensorReading_motorId_fkey" FOREIGN KEY ("motorId") REFERENCES "Motor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "motorId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "healthScoreMl" REAL NOT NULL,
    "healthCategory" TEXT NOT NULL,
    "expertDiagnosis" TEXT,
    "expertRecommendation" TEXT,
    "rawRulesMatched" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HealthAnalysis_motorId_fkey" FOREIGN KEY ("motorId") REFERENCES "Motor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "motorId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" DATETIME,
    CONSTRAINT "Alert_motorId_fkey" FOREIGN KEY ("motorId") REFERENCES "Motor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SensorReading_motorId_timestamp_idx" ON "SensorReading"("motorId", "timestamp");

-- CreateIndex
CREATE INDEX "SensorReading_timestamp_idx" ON "SensorReading"("timestamp");

-- CreateIndex
CREATE INDEX "HealthAnalysis_motorId_timestamp_idx" ON "HealthAnalysis"("motorId", "timestamp");

-- CreateIndex
CREATE INDEX "Alert_motorId_status_timestamp_idx" ON "Alert"("motorId", "status", "timestamp");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");
