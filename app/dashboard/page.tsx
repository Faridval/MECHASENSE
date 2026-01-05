'use client';

import { MotorOverviewCard } from '@/components/MotorOverviewCard';
import { RealtimeStatusBar } from '@/components/RealtimeStatusBar';
import { useRealtimeSensorData } from '@/hooks/useRealtimeSensorData';
import dynamic from 'next/dynamic';
// import { Motor3DVisualization } from '@/components/Motor3DVisualization';
import { AlertList } from '@/components/AlertList';
import { DustPanel } from '@/components/DustPanel';
import { ElectricalPanel } from '@/components/ElectricalPanel';
import { SensorStatusCard } from '@/components/SensorStatusCard';
import { TemperaturePanel } from '@/components/TemperaturePanel';
import { VibrationPanel } from '@/components/VibrationPanel';
import { type ParameterType } from '@/lib/thresholds';

// Dynamic import untuk komponen 3D (hanya di client, no SSR)
const Motor3DModel = dynamic(
  () => import('@/components/Motor3DModel').then((mod) => ({ default: mod.Motor3DModel })),
  {
    ssr: false,
    loading: () => (
      <div className="card p-6">
        <div className="w-full h-[500px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading 3D Model...</p>
          </div>
        </div>
      </div>
    ),
  }
);

// TODO: In production, allow user to select motor
const DEFAULT_MOTOR_ID = 'motor_1';

/* =======================
   SIMPLE ALERTS (LOCAL)
   - alert muncul dari latestReading (tanpa run prediction)
======================= */

type AlertSeverity = 'low' | 'medium' | 'high';
type AlertStatus = 'OPEN' | 'CLOSED' | 'ACKNOWLEDGED';

type SimpleAlert = {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  timestamp: number;
  parameter: string;
  value: number;
};

type ThresholdPair = { warn: number; crit: number };

/**
 * Ubah angka threshold di sini sesuai kebutuhan kamu.
 * Satuan contoh:
 * - motorSurfaceTemp / bearingTemp: °C
 * - vibrationRms: mm/s
 * - dustDensity: ug/m3 (atau sesuai sensor kamu)
 */
const SIMPLE_THRESHOLDS: Record<string, ThresholdPair> = {
  motorSurfaceTemp: { warn: 37, crit: 44 },
  bearingTemp: { warn: 36, crit: 43 },
  vibrationRms: { warn: 4700, crit: 5000 },
  dustDensity: { warn: 800, crit: 900 },
};

const PARAM_LABEL: Record<string, string> = {
  motorSurfaceTemp: 'Suhu motor',
  bearingTemp: 'Suhu bearing',
  vibrationRms: 'Vibrasi RMS',
  dustDensity: 'Debu',
};

function parseReadingTimestamp(ts: unknown): number {
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string') {
    const t = new Date(ts).getTime();
    return Number.isFinite(t) ? t : Date.now();
  }
  return Date.now();
}

function buildSimpleAlerts(latestReading: any): SimpleAlert[] {
  const ts = parseReadingTimestamp(latestReading?.timestamp);
  const alerts: SimpleAlert[] = [];

  const pushIfBreached = (key: string) => {
    const value = latestReading?.[key];
    if (typeof value !== 'number' || Number.isNaN(value)) return;

    const th = SIMPLE_THRESHOLDS[key];
    if (!th) return;

    const label = PARAM_LABEL[key] ?? key;

    if (value >= th.crit) {
      alerts.push({
        id: `${key}-crit`,
        severity: 'high',
        status: 'OPEN',
        parameter: key,
        value,
        message: `${label} kritikal: ${value.toFixed(2)}`,
        timestamp: ts,
      });
      return;
    }

    if (value >= th.warn) {
      alerts.push({
        id: `${key}-warn`,
        severity: 'medium',
        status: 'OPEN',
        parameter: key,
        value,
        message: `${label} tinggi: ${value.toFixed(2)} (>= ${th.warn})`,
        timestamp: ts,
      });
    }
  };

  pushIfBreached('motorSurfaceTemp');
  pushIfBreached('bearingTemp');
  pushIfBreached('vibrationRms');
  pushIfBreached('dustDensity');

  return alerts;
}

export default function DashboardPage() {
  const { data, isLoading, error, isConnected } = useRealtimeSensorData(DEFAULT_MOTOR_ID);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sensor data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-2">Error loading data</p>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.latestReading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No sensor data available. Please ingest data first.</p>
        </div>
      </div>
    );
  }

  const { motor, latestReading, recentReadings, latestHealth } = data;

  // Extract history for sparklines (ambil dari recentReadings, urutkan berdasarkan timestamp)
  const getHistory = (param: keyof typeof latestReading) => {
    const sortedReadings = [...recentReadings].sort((a, b) => {
      const tsA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
      const tsB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
      return tsA - tsB; // Oldest to newest
    });
    return sortedReadings
      .map((r) => r[param] as number)
      .filter((v) => typeof v === 'number' && !isNaN(v));
  };

  // Determine motor status based on health score
  const getMotorStatus = (healthScore: number | undefined): 'Normal' | 'Perlu Inspeksi' | 'Kritikal' => {
    if (!healthScore) return 'Normal';
    if (healthScore >= 80) return 'Normal';
    if (healthScore >= 60) return 'Perlu Inspeksi';
    return 'Kritikal';
  };

  // ✅ Build alerts sederhana dari latestReading
  const simpleAlerts = buildSimpleAlerts(latestReading);

  return (
    <div className="min-h-screen">
      {/* Status Bar */}
      <RealtimeStatusBar
        lastUpdate={data?.latestReading?.timestamp ? data.latestReading.timestamp : null}
        isConnected={isConnected}
        motorName={data?.motor?.name ?? 'Unknown Motor'}
      />

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Motor Overview */}
        <div className="mb-6">
          <MotorOverviewCard
            motorName={data?.motor?.name ?? 'Unknown Motor'}
            healthScore={data?.latestReading?.healthIndex ?? data?.latestHealth?.healthScoreMl ?? 0}
            status={getMotorStatus(data?.latestReading?.healthIndex ?? data?.latestHealth?.healthScoreMl)}
            operatingHoursToday={data?.operatingHoursToday ?? 0} // Real-time dari Firebase
            dailyEnergy={data?.dailyEnergyKwh ?? 0} // Real-time dihitung dari V × I × PF
          />
        </div>

        {/* Motor 3D Model Visualization with Sensor Diagnostics */}
        <div className="mb-6">
          <Motor3DModel
            gridVoltage={data?.latestReading?.gridVoltage ?? 220}
            motorCurrent={data?.latestReading?.motorCurrent ?? 0}
            motorSurfaceTemp={data?.latestReading?.motorSurfaceTemp ?? 25}
            bearingTemp={data?.latestReading?.bearingTemp ?? 25}
            vibrationRms={data?.latestReading?.vibrationRms ?? 0}
            power={data?.latestReading?.power ?? 0}
            powerFactor={data?.latestReading?.powerFactor ?? 1}
            gridFrequency={data?.latestReading?.gridFrequency ?? 50}
            dustDensity={data?.latestReading?.dustDensity ?? 0}
            healthScore={data?.latestReading?.healthIndex ?? data?.latestHealth?.healthScoreMl ?? 100}
          />
        </div>

        {/* Sensor Status Cards */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Electrical Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SensorStatusCard
              parameter={'gridVoltage' as ParameterType}
              value={data?.latestReading?.gridVoltage ?? 0}
              history={getHistory('gridVoltage')}
            />

            <SensorStatusCard
              parameter={'motorCurrent' as ParameterType}
              value={data?.latestReading?.motorCurrent ?? 0}
              history={getHistory('motorCurrent')}
            />

            <SensorStatusCard
              parameter={'vibrationRms' as ParameterType}
              value={data?.latestReading?.vibrationRms ?? 0}
              history={getHistory('vibrationRms')}
            />

            <SensorStatusCard
              parameter={'motorSurfaceTemp' as ParameterType}
              value={data?.latestReading?.motorSurfaceTemp ?? 0}
              history={getHistory('motorSurfaceTemp')}
            />
          </div>

          {/* Additional Sensor Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {data?.latestReading?.powerFactor !== undefined && (
              <SensorStatusCard
                parameter={'powerFactor' as ParameterType}
                value={data.latestReading.powerFactor}
                history={getHistory('powerFactor')}
              />
            )}

            {data?.latestReading?.gridFrequency !== undefined && (
              <SensorStatusCard
                parameter={'gridFrequency' as ParameterType}
                value={data.latestReading.gridFrequency}
                history={getHistory('gridFrequency')}
              />
            )}

            {data?.latestReading?.bearingTemp !== undefined && (
              <SensorStatusCard
                parameter={'bearingTemp' as ParameterType}
                value={data.latestReading.bearingTemp}
                history={getHistory('bearingTemp')}
              />
            )}

            {data?.latestReading?.dustDensity !== undefined && (
              <SensorStatusCard
                parameter={'dustDensity' as ParameterType}
                value={data.latestReading.dustDensity}
                history={getHistory('dustDensity')}
              />
            )}
          </div>
        </div>

        {/* Power Analysis */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Power Analysis</h2>
          <ElectricalPanel
            power={data?.latestReading?.power ?? 0}
            apparentPower={data?.latestReading?.apparentPower ?? 0}
            loadIndex={data?.latestReading?.loadIndex ?? 0}
            currentFreqRatio={data?.latestReading?.currentFreqRatio ?? 0}
            energy={data?.latestReading?.dailyEnergyKwh ?? 0}
          />
        </div>

        {/* Temperature & Vibration & Dust */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Physical Sensors</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TemperaturePanel
              motorSurfaceTemp={data?.latestReading?.motorSurfaceTemp ?? 0}
              bearingTemp={data?.latestReading?.bearingTemp ?? 0}
              ambientTemp={data?.latestReading?.ambientTemp}
              deltaTemp={data?.latestReading?.deltaTemp}
              tempGradient={data?.latestReading?.tempGradient}
              bearingMotorTempDiff={data?.latestReading?.bearingMotorTempDiff}
              hotspot={data?.latestReading?.hotspot}
            />

            <VibrationPanel
              vibrationRms={data?.latestReading?.vibrationRms ?? 0}
              faultFrequency={data?.latestReading?.faultFrequency}
              rotorUnbalanceScore={data?.latestReading?.rotorUnbalanceScore ?? 0}
              bearingHealthScore={data?.latestReading?.bearingHealthScore ?? 0}
              vibrationPeakG={data?.latestReading?.vibrationPeakG}
              crestFactor={data?.latestReading?.crestFactor}
            />

            <DustPanel
              dustDensity={data?.latestReading?.dustDensity ?? 0}
              soilingLossPercent={data?.latestReading?.soilingLossPercent ?? 0}
            />
          </div>
        </div>

        {/* Alerts (SIMPLE) */}
        <div className="mb-6">
          <AlertList
            alerts={simpleAlerts.map((a) => ({
              id: a.id,
              severity: a.severity,
              message: a.message,
              status: a.status,
              timestamp: a.timestamp,
              parameter: a.parameter,
              value: a.value,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
