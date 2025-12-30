#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# download_weights.sh — Download model weights for EarthMind and RemoteSAM
# -----------------------------------------------------------------------------

# Configurable paths (override with environment variables if needed)
MODELS_DIR="${MODELS_DIR:-$(pwd)/models}"
EARTHMIND_DIR="${MODELS_DIR}/EarthMind-4B"
REMOTESAM_WEIGHTS_DIR="${MODELS_DIR}/RemoteSAM/pretrained_weights"

echo "=============================================="
echo "  Model Weights Download"
echo "=============================================="
echo ""
echo "Models directory : ${MODELS_DIR}"
echo ""

# -----------------------------------------------------------------------------
# Download model weights (if not already present)
# -----------------------------------------------------------------------------
echo "Downloading model weights (this may take a while)..."

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

echo ""
echo "[1/2] Downloading EarthMind-4B weights..."
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
echo ""
echo "[2/2] Downloading RemoteSAM weights..."
REMOTESAM_FILE="${REMOTESAM_WEIGHTS_DIR}/RemoteSAMv1.pth"
if [[ -f "${REMOTESAM_FILE}" ]]; then
  echo "      ✓ RemoteSAMv1.pth already exists, skipping."
else
  echo "      ↓ Downloading RemoteSAMv1.pth..."
  curl -L --progress-bar -o "${REMOTESAM_FILE}" \
    "https://huggingface.co/1e12Leon/RemoteSAM/resolve/main/RemoteSAMv1.pth"
fi

echo ""
echo "=============================================="
echo "  ✓ All weights downloaded successfully!"
echo "=============================================="
echo ""
echo "Weights locations:"
echo "  EarthMind-4B : ${EARTHMIND_DIR}"
echo "  RemoteSAM    : ${REMOTESAM_FILE}"
echo ""
