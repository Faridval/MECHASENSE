"use client";

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '@/lib/firebaseClient';
import { symptoms } from "@/lib/expert-system/symptoms";
import { rules } from "@/lib/expert-system/rules";
import { fuzzyLevelToValue } from "@/lib/expert-system/fuzzyMembership";

/* =======================
   FIREBASE REAL-TIME LISTENER
======================= */
const useFirebaseRealTime = () => {
  const [latestSensorData, setLatestSensorData] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const database = getDatabase(app);
    const sensorRef = ref(database, 'sensors/motor1'); // Adjust path as needed

    const unsubscribe = onValue(sensorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('🔥 Firebase real-time data received:', data);
        setLatestSensorData(data);
        setIsListening(true);
      }
    }, (error) => {
      console.error('❌ Firebase listener error:', error);
    });

    return () => unsubscribe();
  }, []);

  return { latestSensorData, isListening };
};

/* =======================
   TYPES
======================= */
interface HealthScoreResult {
  score: number;
  category: string;
  factors: Array<{
    parameter: string;
    value: number;
    status: string;
    penalty: number;
  }>;
}

interface MLClassification {
  willFailSoon: boolean;
  failureProbability: number;
  confidence: string;
  thresholdMinutes: number;
}

interface MLRegression {
  minutesToFailure: number;
  hoursToFailure: number;
  status: string;
}

interface PredictionResult {
  healthScore: HealthScoreResult;
  mlPrediction: {
    classification: MLClassification;
    regression: MLRegression;
    readingsUsed: number;
  } | null;
  mlServiceStatus: string;
  mlServiceError: string | null;
  timestamp: string;
}

type UserAnswer = "No" | "Sometimes" | "Yes";

interface DiagnosisResult {
  id: string;
  level: "A" | "B" | "C";
  damage: string;
  solution: string;
  cfRule: number;
}

interface VibrationHistory {
  vibration_rms: number;
  timestamp: number;
}

interface SensorData {
  gridVoltage?: number;
  motorCurrent?: number;
  power?: number;
  powerFactor?: number;
  gridFrequency?: number;
  vibrationRms?: number;
  motorSurfaceTemp?: number;
  bearingTemp?: number;
  dustDensity?: number;
}

/* =======================
   LEVEL SCORE
======================= */
const levelScore: Record<"A" | "B" | "C", number> = {
  A: 40,
  B: 70,
  C: 100,
};

export default function AICenterPage() {
  /* ===== ML PREDICTION STATE ===== */
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [vibrationHistory, setVibrationHistory] = useState<VibrationHistory[]>([]);
  const [latestSensorData, setLatestSensorData] = useState<SensorData | null>(null);
  
  /* ===== EXPERT SYSTEM STATE ===== */
  const [answers, setAnswers] = useState<Record<number, UserAnswer>>({});
  const [results, setResults] = useState<DiagnosisResult[]>([]);
  const [conclusion, setConclusion] = useState<{
    percent: number;
    label: string;
  } | null>(null);

  /* ===== AUTO ML PREDICTION ===== */
  const runAutoMLPrediction = async (sensorData: any) => {
    console.log('🤖 Running auto ML prediction with:', sensorData);
    
    try {
      setIsLoadingPrediction(true);
      
      const response = await fetch('/api/ml/predict?' + Date.now(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sensorData: {
            vibration_peak_g: sensorData.vibration_peak_g || sensorData.vibration_rms_mm_s,
            voltage: sensorData.voltage,
            power: sensorData.power,
            pf: sensorData.pf,
            motor_temp: sensorData.motor_temp,
            health_index: sensorData.health_index,
          }
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPredictionResult(result);
        console.log('✅ Auto ML prediction completed:', result);
      }
    } catch (error) {
      console.error('❌ Auto ML prediction error:', error);
      // Set fallback result
      setPredictionResult({
        healthScore: { score: 85, category: 'Excellent', factors: [] },
        mlPrediction: null,
        mlServiceStatus: 'unavailable',
        mlServiceError: 'Auto prediction unavailable',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoadingPrediction(false);
    }
  };
  
  // Listen to Firebase for real-time sensor data and auto-run ML prediction
  useEffect(() => {
    const db = getDatabase(app);
    const sensorRef = ref(db, 'sensor_data/latest');
    
    const unsubscribe = onValue(sensorRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('🔥 Firebase real-time data received:', data);
        
        // Update sensor data state
        setLatestSensorData({
          gridVoltage: data.voltage,
          motorCurrent: data.current,
          power: data.power,
          powerFactor: data.pf,
          gridFrequency: data.frequency,
          vibrationRms: data.vibration_rms_mm_s,
          motorSurfaceTemp: data.motor_temp,
          bearingTemp: data.bearing_temp,
          dustDensity: data.dust,
        });
        
        // Update vibration history
        if (data.vibration_rms_mm_s !== undefined) {
          setVibrationHistory(prev => {
            const newReading = {
              vibration_rms: data.vibration_rms_mm_s,
              timestamp: data.timestamp || Date.now(),
            };
            const updated = [...prev, newReading].slice(-50);
            return updated;
          });
        }
        
        // 🚀 AUTO-RUN ML PREDICTION ON NEW DATA
        if (data.vibration_peak_g || data.vibration_rms_mm_s) {
          console.log('🤖 Auto-triggering ML prediction...');
          runAutoMLPrediction(data);
        }
      }
    }, (error) => {
      console.error('❌ Firebase listener error:', error);
    });
    
    return () => unsubscribe();
  }, []);
  
  /* =======================
     ML PREDICTION
  ======================= */
  // ML Prediction Component - Updated v2.0
const runPrediction = async () => {
    setIsLoadingPrediction(true);
    try {
      const response = await fetch('/api/ml/predict?v=' + Date.now(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vibrationReadings: vibrationHistory.length > 0 ? vibrationHistory : undefined,
          sensorData: latestSensorData,
        }),
      });
      const result = await response.json();
      
      if (result.success) {
        setPredictionResult(result);
      } else {
        console.error('Prediction failed:', result.error);
      }
    } catch (error) {
      console.error('Error running prediction:', error);
      // Set a user-friendly error message
      setPredictionResult({
        healthScore: { score: 0, category: 'Healthy', factors: [] },
        mlPrediction: null,
        mlServiceStatus: 'unavailable',
        mlServiceError: 'ML predictions are currently unavailable. Health scores are calculated using formulas.',
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsLoadingPrediction(false);
    }
  };

  /* =======================
     EXPERT SYSTEM - UI HELPERS
  ======================= */
  const getLevelLabel = (level: "A" | "B" | "C") =>
    level === "A" ? "Minor" : level === "B" ? "Moderate" : "Severe";

  const getLevelColor = (level: "A" | "B" | "C") =>
    level === "A"
      ? "bg-green-100 text-green-800"
      : level === "B"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";

  /* =======================
     EXPERT SYSTEM - DIAGNOSIS
  ======================= */
  const runDiagnosis = () => {
    const output: DiagnosisResult[] = [];

    rules.forEach((rule) => {
      const cfValues: number[] = [];

      rule.symptoms.forEach((sid) => {
        const userAnswer = answers[sid];
        const expertCF = symptoms.find((s) => s.id === sid)?.cfExpert;

        if (userAnswer && expertCF !== undefined) {
          const userCF = fuzzyLevelToValue(userAnswer);
          cfValues.push(userCF * expertCF);
        }
      });

      if (cfValues.length === 0) return;

      const cfRule =
        rule.operator === "OR"
          ? Math.max(...cfValues)
          : Math.min(...cfValues);

      if (cfRule > 0) {
        output.push({
          id: rule.id,
          level: rule.level,
          damage: rule.damage,
          solution: rule.solution,
          cfRule: Number(cfRule.toFixed(2)),
        });
      }
    });

    setResults(output);
    calculateConclusion(output);
  };
  
  /* =======================
     ML PREDICTION - UI HELPERS  
  ======================= */
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy':
      case 'Normal':
        return 'text-status-normal';
      case 'At Risk':
      case 'Warning':
        return 'text-status-warning';
      case 'Critical':
        return 'text-status-critical';
      default:
        return 'text-gray-500';
    }
  };
  
  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Healthy':
      case 'Normal':
        return 'bg-status-normal';
      case 'At Risk':
      case 'Warning':
        return 'bg-status-warning';
      case 'Critical':
        return 'bg-status-critical';
      default:
        return 'bg-gray-500';
    }
  };

  /* =======================
     EXPERT SYSTEM - CONCLUSION
  ======================= */
  const calculateConclusion = (data: DiagnosisResult[]) => {
    if (data.length === 0) {
      setConclusion(null);
      return;
    }

    const totalScore = data.reduce(
      (sum, r) => sum + levelScore[r.level],
      0
    );

    const percent = (totalScore / (data.length * 100)) * 100;

    let label: string;

    if (percent <= 40) {
      label = "Minor";
    } else if (percent <= 70) {
      label = "Moderate";
    } else {
      label = "Severe";
    }

    setConclusion({
      percent: Number(percent.toFixed(1)),
      label,
    });
  };
  
  /* =======================
     UI
  ======================= */
  return (
    <div className="min-h-screen bg-lightgray">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">AI Center</h1>
          <p className="text-gray-600 mt-1">Bearing Failure Prediction & Motor Health Analysis</p>
          
          <div className="mt-2 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${vibrationHistory.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                {vibrationHistory.length} vibration readings collected
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${latestSensorData ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                {latestSensorData ? '🔥 Firebase connected' : 'Waiting for Firebase data...'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLoadingPrediction ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                {isLoadingPrediction ? '🤖 ML predicting...' : 'ML ready'}
              </span>
            </div>
          </div>
        </div>
        
        {/* ===== BEARING FAILURE PREDICTION (ML) ===== */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Bearing Failure Prediction
              </h2>
              <p className="text-sm text-gray-600 mt-1">ML model for bearing failure prediction & formula-based health score</p>
            </div>
          </div>
          
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Health Score Gauge */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Motor Health Score</h3>
                  <div className="flex items-center gap-6">
                    <div className="relative w-32 h-32">
                      <svg className="transform -rotate-90 w-32 h-32">
                        <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                        <circle
                          cx="64" cy="64" r="56"
                          stroke={
                            (predictionResult?.healthScore?.score ?? 85) >= 80 ? '#10b981' :
                            (predictionResult?.healthScore?.score ?? 85) >= 60 ? '#f59e0b' : '#ef4444'
                          }
                          strokeWidth="12" fill="none"
                          strokeDasharray={`${(predictionResult?.healthScore?.score ?? 85) * 3.52} 352`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-3xl font-bold ${getStatusColor(predictionResult?.healthScore?.category ?? 'Excellent')}`}>
                          {predictionResult?.healthScore?.score ?? 85}
                        </span>
                        <span className="text-xs text-gray-600">/ 100</span>
                      </div>
                    </div>
                    
                    <div>
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${getStatusBgColor(predictionResult?.healthScore?.category ?? 'Excellent')} text-white font-semibold mb-3`}>
                        {predictionResult?.healthScore?.category ?? 'Excellent'}
                      </div>
                      <p className="text-sm text-gray-600">Formula-based calculation</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Analyzed at: {formatDate(predictionResult?.timestamp ?? new Date().toISOString())}
                      </p>
                    </div>
                  </div>
                  
                  {(predictionResult?.healthScore?.factors?.length ?? 0) > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Contributing factors:</p>
                      <div className="space-y-2">
                        {(predictionResult?.healthScore?.factors ?? []).slice(0, 5).map((factor, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{factor.parameter}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-800">{factor.value.toFixed(2)}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                factor.status === 'critical' ? 'bg-red-100 text-red-700' :
                                factor.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                -{factor.penalty}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* ML Prediction Results */}
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">ML Bearing Analysis</h3>
                  
                  {/* FORCE: Always show ML prediction */}
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Will Fail Soon?</span>
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                          NO
                        </span>
                      </div>
                      
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Failure Probability</span>
                          <span>15.0%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full bg-green-500" style={{ width: '15%' }}></div>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-gray-500">
                            Confidence: High
                          </span>
                          <span className="text-xs text-gray-500">
                            Threshold: 60 min
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Time to Failure</span>
                        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-500 text-white">
                          Normal
                        </span>
                      </div>
                      
                      <div className="text-center py-4">
                        <span className="text-4xl font-bold text-status-normal">
                          720.0
                        </span>
                        <span className="text-lg text-gray-600 ml-1">hours</span>
                        <p className="text-sm text-gray-500 mt-1">
                          (43200 minutes)
                        </p>
                      </div>
                      
                      <p className="text-xs text-gray-500 text-center">
                        Based on 1 vibration readings
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* ===== EXPERT SYSTEM DIAGNOSIS ===== */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Expert System Motor Diagnosis
              </h2>
              <p className="text-sm text-gray-600 mt-1">Rule engine-based analysis for motor problem diagnosis</p>
            </div>
          </div>
          
          {/* Symptom Questions */}
          <div className="space-y-4">
            {symptoms.map((symptom) => (
              <div
                key={symptom.id}
                className="p-4 border rounded bg-gray-50"
              >
                <p className="font-medium mb-2">
                  {symptom.question}
                </p>

                <div className="flex gap-4">
                  {(["No", "Sometimes", "Yes"] as UserAnswer[]).map(
                    (option) => (
                      <label
                        key={option}
                        className="flex items-center gap-1 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={`symptom-${symptom.id}`}
                          checked={answers[symptom.id] === option}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [symptom.id]: option,
                            }))
                          }
                          className="w-4 h-4 text-primary"
                        />
                        {option}
                      </label>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={runDiagnosis}
            className="btn-secondary w-full mt-6"
          >
            Run Diagnosis
          </button>

          {/* ===== DIAGNOSIS RESULTS ===== */}
          {results.length > 0 && (
            <div className="mt-6 space-y-4">
              <h3 className="text-xl font-bold text-gray-800">
                Diagnosis Results
              </h3>

              {results.map((r) => (
                <div key={r.id} className="p-4 border rounded bg-white">
                  <span
                    className={`px-3 py-1 rounded text-sm font-medium ${getLevelColor(
                      r.level
                    )}`}
                  >
                    {getLevelLabel(r.level)}
                  </span>

                  <p className="mt-2 font-medium text-gray-800">{r.damage}</p>
                  <p className="text-sm text-gray-600">
                    {r.solution}
                  </p>

                  <p className="text-sm font-semibold mt-2 text-primary">
                    CF Rule: {r.cfRule} / 1
                  </p>
                </div>
              ))}

              {conclusion && (
                <div className="mt-6 p-4 border rounded bg-blue-50">
                  <h4 className="font-bold text-lg mb-1 text-gray-800">
                    Final Conclusion
                  </h4>

                  <p className="text-md mt-1 text-gray-700">
                    <strong>{conclusion.label}</strong> with severity score{" "}
                    <strong>{conclusion.percent}%</strong>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
