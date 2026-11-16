FROM python:3.13-slim

# libgomp1: OpenMP runtime required by lightgbm
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1 UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock .python-version ./
# --no-cache: keep uv's download cache out of the image
RUN uv sync --frozen --no-dev --no-cache

COPY app ./app
ENV PATH="/app/.venv/bin:$PATH" DATA_DIR=/data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
