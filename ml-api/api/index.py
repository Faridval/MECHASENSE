import sys
import os
from pathlib import Path

# Add ml_service to path
sys.path.append(str(Path(__file__).parent.parent.parent / "ml_service"))

from app import handler

# Export for Vercel
app = handler
