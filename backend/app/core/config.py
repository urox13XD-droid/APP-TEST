"""Application configuration.

All values are overridable via environment variables so the same image
can be deployed in Docker/K8s without code changes.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = Path(os.getenv("ONELINE_DATA_DIR", BASE_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
SESSION_DIR = DATA_DIR / "sessions"
EXPORT_DIR = DATA_DIR / "exports"

for d in (UPLOAD_DIR, SESSION_DIR, EXPORT_DIR):
    d.mkdir(parents=True, exist_ok=True)

# Segmentation backend: "opencv" (default, always available, but only
# reacts to local contrast -- weak on busy photos/illustrations),
# "rembg" (recommended for photos/character art: subject-aware, CPU-only,
# requires `pip install rembg onnxruntime`), or "sam2" (best quality,
# requires the optional `sam2` package + downloaded checkpoint + ideally a
# GPU).
SEGMENTER_BACKEND = os.getenv("ONELINE_SEGMENTER", "opencv")
SAM2_CHECKPOINT = os.getenv("ONELINE_SAM2_CHECKPOINT", "")
SAM2_MODEL_CFG = os.getenv("ONELINE_SAM2_MODEL_CFG", "")

# Maximum working resolution (longest edge, px). Larger images are
# downscaled before processing for speed and to give the simplification
# step a saner vertex budget.
MAX_WORKING_DIM = int(os.getenv("ONELINE_MAX_DIM", "1400"))

# px -> mm conversion used when no explicit scale is supplied by the client.
# The final artwork is normalised so its longest edge equals TARGET_SIZE_MM.
DEFAULT_TARGET_SIZE_MM = float(os.getenv("ONELINE_TARGET_SIZE_MM", "150"))

CORS_ORIGINS = os.getenv("ONELINE_CORS_ORIGINS", "http://localhost:3000").split(",")

ALLOWED_EXTRUDE_DEPTH_MM = float(os.getenv("ONELINE_EXTRUDE_DEPTH_MM", "3.0"))
