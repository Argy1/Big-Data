FROM python:3.13-slim

# libgl/libglib: OpenCV runtime; ffmpeg codecs come with opencv-python-headless wheels
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock .python-version ./
# torch/torchvision come from the cu128 index (pyproject [tool.uv.sources]) — required for RTX 50xx
# --no-cache: otherwise uv's download cache (~7,4 GB of wheels) is baked into the image next to the venv
RUN uv sync --frozen --no-dev --no-cache

COPY speed_layer ./speed_layer
COPY check_env.py ./
ENV PATH="/app/.venv/bin:$PATH" DATA_DIR=/data UPLOAD_DIR=/appdata/uploads YOLO_CONFIG_DIR=/tmp/ultralytics
CMD ["python", "-m", "speed_layer.main"]
