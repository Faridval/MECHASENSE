#!/usr/bin/env python3
"""
Script untuk menjalankan ML Service dengan model prediksi.pkl
"""

import os
import sys
import uvicorn
from pathlib import Path

# Tambahkan ml_service ke path
sys.path.append(str(Path(__file__).parent / "ml_service"))

if __name__ == "__main__":
    print("🚀 Starting ML Service with prediksi.pkl model...")
    print("📊 Model: bearing failure prediction")
    print("🔗 Endpoints:")
    print("   POST /predict/classification")
    print("   POST /predict/regression") 
    print("   POST /predict/both")
    print("🌐 Server akan jalan di http://localhost:8001")
    print("📱 Vercel bisa connect ke: ML_SERVICE_URL=http://localhost:8001")
    print()
    
    # Jalankan ML service
    os.system("cd ml_service && python app.py")
