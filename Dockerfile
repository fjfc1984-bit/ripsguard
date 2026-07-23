# ─────────────────────────────────────────────
# RIPS Guard — FastAPI Backend
# Build: docker build -t ripsguard-api .
# Run:   docker run -p 8000:8000 --env-file .env ripsguard-api
# ─────────────────────────────────────────────

FROM python:3.11-slim AS base

# Evitar archivos .pyc y buffering
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# ── Dependencias del sistema ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Dependencias Python ──
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Código fuente ──
COPY rips_parser.py       .
COPY validation_engine.py .
COPY ai_corrector.py      .
COPY worker.py            .
COPY stripe_integration.py .

# ── Usuario no-root (seguridad) ──
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

# ── Health check ──
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Gunicorn en producción, uvicorn en desarrollo
CMD ["uvicorn", "worker:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
