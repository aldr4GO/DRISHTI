#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# setup.sh — Drishti Full Stack Deployment Script
# =============================================================================
# This script handles:
#   1. Downloading model weights for EarthMind and RemoteSAM
#   2. Building Docker images for backend and frontend
#   3. Starting all services via Docker Compose
# =============================================================================

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Configuration (override with environment variables if needed)
# -----------------------------------------------------------------------------
MODELS_DIR="${MODELS_DIR:-$(pwd)/backend/models}"
EARTHMIND_DIR="${MODELS_DIR}/EarthMind-4B"
REMOTESAM_WEIGHTS_DIR="${MODELS_DIR}/RemoteSAM/pretrained_weights"

# Docker Compose settings
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
CUDA_VISIBLE_DEVICES="${CUDA_VISIBLE_DEVICES:-0}"

# Export for docker-compose
export MODELS_DIR BACKEND_PORT FRONTEND_PORT CUDA_VISIBLE_DEVICES

# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------
print_header() {
    echo ""
    echo -e "${BLUE}==============================================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}==============================================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "    $1"
}

check_requirements() {
    local missing=0
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        missing=1
    fi
    
    if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        missing=1
    fi
    
    if ! command -v curl &> /dev/null; then
        print_error "curl is not installed. Please install curl first."
        missing=1
    fi
    
    # Check for NVIDIA Docker support (optional but recommended)
    # Check multiple methods: nvidia-container-toolkit binary, CDI devices, or nvidia runtime
    if ! command -v nvidia-container-toolkit &> /dev/null && \
       ! docker info 2>/dev/null | grep -qi "nvidia" && \
       ! sudo docker info 2>/dev/null | grep -qi "nvidia.com/gpu"; then
        print_warning "NVIDIA Docker runtime not detected. GPU support may not work."
        print_info "Install nvidia-container-toolkit for GPU support."
    else
        print_step "NVIDIA container support detected."
    fi
    
    if [[ $missing -eq 1 ]]; then
        exit 1
    fi
}

download_file() {
    local url="$1"
    local target="$2"
    local filename=$(basename "$target")
    
    if [[ -f "${target}" ]]; then
        # Get the expected file size from the remote server
        local remote_size
        remote_size=$(curl -sI -L "${url}" | grep -i "content-length" | tail -1 | awk '{print $2}' | tr -d '\r')
        
        if [[ -n "${remote_size}" ]]; then
            local local_size
            local_size=$(stat -c%s "${target}" 2>/dev/null || stat -f%z "${target}" 2>/dev/null)
            
            if [[ "${local_size}" -eq "${remote_size}" ]]; then
                print_step "${filename} already exists and size matches (${local_size} bytes), skipping."
                return 0
            else
                print_warning "${filename} exists but size mismatch (local: ${local_size}, remote: ${remote_size}). Re-downloading..."
                rm -f "${target}"
            fi
        else
            print_warning "Could not determine remote file size for ${filename}. Re-downloading to be safe..."
            rm -f "${target}"
        fi
    fi
    
    echo -e "    ${YELLOW}↓${NC} Downloading ${filename}..."
    if curl -L --progress-bar -o "${target}" "${url}"; then
        print_step "${filename} downloaded successfully."
    else
        print_error "Failed to download ${filename}"
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Parse command line arguments
# -----------------------------------------------------------------------------
SKIP_WEIGHTS=false
SKIP_BUILD=false
DETACH=false
DOWN=false
LOGS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-weights)
            SKIP_WEIGHTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -d|--detach)
            DETACH=true
            shift
            ;;
        --down)
            DOWN=true
            shift
            ;;
        --logs)
            LOGS=true
            shift
            ;;
        -h|--help)
            echo "Drishti Setup Script"
            echo ""
            echo "Usage: ./setup.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-weights    Skip downloading model weights"
            echo "  --skip-build      Skip building Docker images"
            echo "  -d, --detach      Run containers in detached mode"
            echo "  --down            Stop and remove all containers"
            echo "  --logs            Show logs from running containers"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  MODELS_DIR              Path to models directory (default: ./backend/models)"
            echo "  BACKEND_PORT            Backend port (default: 8000)"
            echo "  FRONTEND_PORT           Frontend port (default: 3000)"
            echo "  CUDA_VISIBLE_DEVICES    GPU device(s) to use (default: 0)"
            echo "  NEXT_PUBLIC_API_URL     Backend API URL for frontend (default: http://localhost:8000)"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information."
            exit 1
            ;;
    esac
done

# -----------------------------------------------------------------------------
# Handle special commands
# -----------------------------------------------------------------------------
if [[ "$DOWN" == true ]]; then
    print_header "Stopping Drishti Services"
    docker compose down
    print_step "All services stopped."
    exit 0
fi

if [[ "$LOGS" == true ]]; then
    docker compose logs -f
    exit 0
fi

# -----------------------------------------------------------------------------
# Main setup process
# -----------------------------------------------------------------------------
print_header "Drishti Full Stack Deployment"

echo "Configuration:"
print_info "Models directory    : ${MODELS_DIR}"
print_info "Backend port        : ${BACKEND_PORT}"
print_info "Frontend port       : ${FRONTEND_PORT}"
print_info "CUDA devices        : ${CUDA_VISIBLE_DEVICES}"
echo ""

# Check requirements
print_header "Checking Requirements"
check_requirements
print_step "All requirements satisfied."

# -----------------------------------------------------------------------------
# Step 1: Download model weights
# -----------------------------------------------------------------------------
if [[ "$SKIP_WEIGHTS" == false ]]; then
    print_header "Step 1/3: Downloading Model Weights"
    
    # Create directories
    mkdir -p "${EARTHMIND_DIR}"
    mkdir -p "${REMOTESAM_WEIGHTS_DIR}"
    
    print_info "This may take a while depending on your internet connection..."
    echo ""
    
    # EarthMind-4B safetensors
    echo "Downloading EarthMind-4B model files..."
    EARTHMIND_FILES=(
        "model-00001-of-00004.safetensors"
        "model-00002-of-00004.safetensors"
        "model-00003-of-00004.safetensors"
        "model-00004-of-00004.safetensors"
    )
    
    for f in "${EARTHMIND_FILES[@]}"; do
        download_file \
            "https://huggingface.co/sy1998/EarthMind-4B/resolve/main/${f}" \
            "${EARTHMIND_DIR}/${f}"
    done
    
    echo ""
    echo "Downloading RemoteSAM weights..."
    download_file \
        "https://huggingface.co/1e12Leon/RemoteSAM/resolve/main/RemoteSAMv1.pth" \
        "${REMOTESAM_WEIGHTS_DIR}/RemoteSAMv1.pth"
    
    echo ""
    print_step "All model weights downloaded."
else
    print_header "Step 1/3: Skipping Model Weights Download"
    print_warning "Assuming weights are already present in ${MODELS_DIR}"
fi

# -----------------------------------------------------------------------------
# Step 2: Build Docker images
# -----------------------------------------------------------------------------
if [[ "$SKIP_BUILD" == false ]]; then
    print_header "Step 2/3: Building Docker Images"
    
    echo "Building backend image..."
    docker compose build backend
    print_step "Backend image built."
    
    echo ""
    echo "Building frontend image..."
    docker compose build frontend
    print_step "Frontend image built."
else
    print_header "Step 2/3: Skipping Docker Build"
    print_warning "Using existing Docker images."
fi

# -----------------------------------------------------------------------------
# Step 3: Start services
# -----------------------------------------------------------------------------
print_header "Step 3/3: Starting Services"

if [[ "$DETACH" == true ]]; then
    docker compose up -d
    print_step "Services started in detached mode."
    echo ""
    echo "To view logs, run:"
    print_info "./setup.sh --logs"
    echo ""
    echo "To stop services, run:"
    print_info "./setup.sh --down"
else
    echo "Starting services (press Ctrl+C to stop)..."
    echo ""
    docker compose up
fi

# -----------------------------------------------------------------------------
# Success message (only shown in detached mode)
# -----------------------------------------------------------------------------
if [[ "$DETACH" == true ]]; then
    print_header "Drishti is Running!"
    
    echo "Services:"
    print_info "Frontend : http://localhost:${FRONTEND_PORT}"
    print_info "Backend  : http://localhost:${BACKEND_PORT}"
    print_info "API Docs : http://localhost:${BACKEND_PORT}/docs"
    echo ""
    
    echo "Useful commands:"
    print_info "View logs     : ./setup.sh --logs"
    print_info "Stop services : ./setup.sh --down"
    print_info "Restart       : docker compose restart"
    echo ""
    
    print_warning "Note: Backend may take a few minutes to load ML models."
    print_info "Check health: curl http://localhost:${BACKEND_PORT}/health"
fi
