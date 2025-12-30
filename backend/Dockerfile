# Base image with CUDA support for GPU inference
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    python3.10-venv \
    git \
    wget \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set python3 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.10 1 && \
    update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# Upgrade pip 
RUN pip install --upgrade pip setuptools wheel

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install huggingface_hub for downloading models and bitsandbytes for 8-bit quantization
RUN pip install --no-cache-dir huggingface_hub bitsandbytes

# Models should not be baked into the image. Mount a host `models` directory
# into the container at runtime (e.g. `-v /path/on/host/models:/app/models`).
# This keeps large weights outside the image and lets users manage/download
# weights on setup. The image still expects model code under `/app/models`.

# Declare the models mountpoint as a volume to remind users to mount it at runtime
VOLUME ["/app/models"]

# Copy application code
COPY serve.py ./
COPY deployments/ ./deployments/
COPY utils_pkg/ ./utils_pkg/

# Expose port for Ray Serve
EXPOSE 8000

# Set default paths for models (updated to use /app/models/)
ENV EARTHMIND_PATH=/app/models/EarthMind-4B
ENV REMOTESAM_PATH=/app/models/RemoteSAM/pretrained_weights/RemoteSAMv1.pth

# Add RemoteSAM to Python path (updated paths)
ENV PYTHONPATH="${PYTHONPATH}:/app/models/RemoteSAM:/app/models/RemoteSAM/tasks:/app/models/RemoteSAM/tasks/code"

# Default command to start Ray Serve
CMD ["python", "serve.py", "--earthmind_path", "/app/models/EarthMind-4B", "--remotesam_path", "/app/models/RemoteSAM/pretrained_weights/RemoteSAMv1.pth", "--host", "0.0.0.0", "--port", "8000"]
