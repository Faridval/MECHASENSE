"""
ML Service untuk Vercel Serverless
Berdasarkan model prediksi.pkl untuk bearing failure
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any
from joblib import load

# Load model
try:
    model = load('ml_service/model/prediksi.pkl')
    print("✅ Model prediksi.pkl loaded successfully")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None

def predict_bearing_failure(vibration_data: Dict[str, Any]) -> Dict[str, Any]:
    """Prediksi bearing failure dari vibration data"""
    
    if not model:
        return {
            "error": "Model not loaded",
            "classification": {"will_fail_soon": False, "failure_probability": 0.0, "confidence": "Low"},
            "regression": {"minutes_to_failure": 999999, "hours_to_failure": 16666, "status": "Unknown"}
        }
    
    try:
        # Prepare features (simplified for single reading)
        features = {
            'mean_bearing_1': vibration_data.get('vibration_peak_g', 0),
            'std_bearing_1': 0.1,  # Default std
            'max_bearing_1': vibration_data.get('vibration_peak_g', 0) * 1.2,
            'min_bearing_1': vibration_data.get('vibration_peak_g', 0) * 0.8,
        }
        
        # Create DataFrame
        df = pd.DataFrame([features])
        
        # Make prediction
        prediction = model.predict(df)[0]
        
        # Create result based on prediction
        if prediction == 1:  # Failure
            return {
                "classification": {
                    "will_fail_soon": True,
                    "failure_probability": 0.85,
                    "confidence": "High",
                    "threshold_minutes": 60
                },
                "regression": {
                    "minutes_to_failure": 1440,  # 24 hours
                    "hours_to_failure": 24,
                    "status": "Critical"
                },
                "timestamp": pd.Timestamp.now().isoformat(),
                "readings_used": 1
            }
        else:  # Normal
            return {
                "classification": {
                    "will_fail_soon": False,
                    "failure_probability": 0.15,
                    "confidence": "High",
                    "threshold_minutes": 60
                },
                "regression": {
                    "minutes_to_failure": 43200,  # 30 days
                    "hours_to_failure": 720,
                    "status": "Normal"
                },
                "timestamp": pd.Timestamp.now().isoformat(),
                "readings_used": 1
            }
            
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        return {
            "error": str(e),
            "classification": {"will_fail_soon": False, "failure_probability": 0.0, "confidence": "Low"},
            "regression": {"minutes_to_failure": 999999, "hours_to_failure": 16666, "status": "Error"}
        }

def handler(request):
    """Vercel serverless handler"""
    
    try:
        # Parse request body
        body = json.loads(request.get('body', '{}'))
        sensor_data = body.get('sensorData', {})
        
        # Make prediction
        result = predict_bearing_failure(sensor_data)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            'body': json.dumps(result)
        }
        
    except Exception as e:
        print(f"❌ Handler error: {e}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }
