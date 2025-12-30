# Models directory (mount at runtime)

This directory is expected to contain model code and the large model weight files. Do NOT bake weights into the Docker image — download them during setup on the host and mount the host directory into the container.

Required paths (examples):

- `/path/to/models/EarthMind-4B/` — must contain the safetensors files, e.g.:
  - `model-00001-of-00004.safetensors`
  - `model-00002-of-00004.safetensors`
  - `model-00003-of-00004.safetensors`
  - `model-00004-of-00004.safetensors`

- `/path/to/models/RemoteSAM/pretrained_weights/RemoteSAMv1.pth`

How to download weights on the host (examples):

1) EarthMind-4B (use `huggingface_hub` on the host):

```bash
python - <<'PY'
from huggingface_hub import hf_hub_download
import os
model_dir = '/path/to/models/EarthMind-4B'
os.makedirs(model_dir, exist_ok=True)
files = [
    'model-00001-of-00004.safetensors',
    'model-00002-of-00004.safetensors',
    'model-00003-of-00004.safetensors',
    'model-00004-of-00004.safetensors',
]
for f in files:
    hf_hub_download(repo_id='sy1998/EarthMind-4B', filename=f, local_dir=model_dir, local_dir_use_symlinks=False)
print('Downloaded EarthMind-4B safetensors to', model_dir)
PY
```

2) RemoteSAM weights (download with `wget` or `curl`):

```bash
mkdir -p /path/to/models/RemoteSAM/pretrained_weights
wget -O /path/to/models/RemoteSAM/pretrained_weights/RemoteSAMv1.pth \
  https://huggingface.co/1e12Leon/RemoteSAM/resolve/main/RemoteSAMv1.pth
```

Running the container with a mounted models volume (example):

```bash
docker build -t earthmind-server:latest .

docker run --gpus all -p 8000:8000 \
  -v /path/to/models:/app/models \
  --rm earthmind-server:latest \
  python serve.py --earthmind_path /app/models/EarthMind-4B \
    --remotesam_path /app/models/RemoteSAM/pretrained_weights/RemoteSAMv1.pth \
    --host 0.0.0.0 --port 8000
```

Notes:

- Replace `/path/to/models` with where you downloaded the model files on your host.
- You can keep the model code (non-weight files) in the repository but avoid copying weight files into the image.
- If you want to keep model code in the image and only mount weights, mount the host weights directory into the specific subfolder instead, e.g. `-v /host/models/EarthMind-4B:/app/models/EarthMind-4B`.
