#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# setup.sh — Build the Docker image, download model weights, and run the server
# -----------------------------------------------------------------------------

# Configurable paths (override with environment variables if needed)
MODELS_DIR="${MODELS_DIR:-$(pwd)/models}"
EARTHMIND_DIR="${MODELS_DIR}/EarthMind-4B"
REMOTESAM_WEIGHTS_DIR="${MODELS_DIR}/RemoteSAM/pretrained_weights"
IMAGE_NAME="${IMAGE_NAME:-earthmind-server:latest}"
CONTAINER_PORT="${CONTAINER_PORT:-8000}"
HOST_PORT="${HOST_PORT:-8000}"

echo "=============================================="
echo "  EarthMind Backend Setup"
echo "=============================================="
echo ""
echo "Models directory : ${MODELS_DIR}"
echo "Docker image     : ${IMAGE_NAME}"
echo "Port             : ${HOST_PORT} -> ${CONTAINER_PORT}"
echo ""

# -----------------------------------------------------------------------------
# Step 1: Build the Docker image
# -----------------------------------------------------------------------------
echo "[1/3] Building Docker image..."
docker build -t "${IMAGE_NAME}" .
echo "      ✓ Image built: ${IMAGE_NAME}"
echo ""

# -----------------------------------------------------------------------------
# Step 2: Download model weights (if not already present)
# -----------------------------------------------------------------------------
echo "[2/3] Downloading model weights (this may take a while)..."

# Ensure directories exist
mkdir -p "${EARTHMIND_DIR}"
mkdir -p "${REMOTESAM_WEIGHTS_DIR}"

# EarthMind-4B safetensors
EARTHMIND_FILES=(
  "model-00001-of-00004.safetensors"
  "model-00002-of-00004.safetensors"
  "model-00003-of-00004.safetensors"
  "model-00004-of-00004.safetensors"
)

for f in "${EARTHMIND_FILES[@]}"; do
  target="${EARTHMIND_DIR}/${f}"
  if [[ -f "${target}" ]]; then
    echo "      ✓ ${f} already exists, skipping."
  else
    echo "      ↓ Downloading ${f}..."
    curl -L --progress-bar -o "${target}" \
      "https://huggingface.co/sy1998/EarthMind-4B/resolve/main/${f}"
  fi
done

# RemoteSAM weights
REMOTESAM_FILE="${REMOTESAM_WEIGHTS_DIR}/RemoteSAMv1.pth"
if [[ -f "${REMOTESAM_FILE}" ]]; then
  echo "      ✓ RemoteSAMv1.pth already exists, skipping."
else
  echo "      ↓ Downloading RemoteSAMv1.pth..."
  curl -L --progress-bar -o "${REMOTESAM_FILE}" \
    "https://huggingface.co/1e12Leon/RemoteSAM/resolve/main/RemoteSAMv1.pth"
fi

echo "      ✓ All weights downloaded."
echo ""

# -----------------------------------------------------------------------------
# Step 3: Run the container
# -----------------------------------------------------------------------------
echo "[3/3] Starting the server container..."
echo "      Mounting ${MODELS_DIR} -> /app/models"
echo ""

docker run --gpus all \
  -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -v "${MODELS_DIR}:/app/models" \
  --rm \
  "${IMAGE_NAME}" \
  python serve.py \
    --earthmind_path /app/models/EarthMind-4B \
    --remotesam_path /app/models/RemoteSAM/pretrained_weights/RemoteSAMv1.pth \
    --host 0.0.0.0 \
    --port "${CONTAINER_PORT}"
