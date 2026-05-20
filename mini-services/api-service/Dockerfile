# =============================================================================
# Gidede — Backend Dockerfile (FastAPI + Uvicorn)
# Python 3.12 slim, deps from pyproject.toml, production uvicorn
# =============================================================================

# ===== Stage 1: Install Dependencies =====
FROM python:3.12-slim AS deps
WORKDIR /app

# Install system dependencies needed for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy project definition
COPY pyproject.toml ./

# Install project dependencies + runtime packages
# The pyproject.toml lists minimal deps; we install the full runtime set here
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.30.0" \
    "pydantic>=2.0.0" \
    "pydantic-settings>=2.0.0" \
    "sqlalchemy[asyncio]>=2.0.0" \
    "asyncpg>=0.30.0" \
    "aiosqlite>=0.20.0" \
    "redis>=5.0.0" \
    "bcrypt>=4.1.0" \
    "PyJWT>=2.8.0" \
    "httpx>=0.27.0" \
    "openai>=1.40.0" \
    "anthropic>=0.34.0" \
    "prometheus-client>=0.20.0" \
    "psutil>=5.9.0" \
    "starlette>=0.40.0" \
    "python-multipart>=0.0.9" \
    && pip install --no-cache-dir .

# ===== Stage 2: Production Image =====
FROM python:3.12-slim AS runner
WORKDIR /app

# Install runtime system dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r gidede && useradd -r -g gidede -d /app gidede

# Copy installed Python packages from deps stage
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin/uvicorn /usr/local/bin/uvicorn

# Copy application code
COPY --chown=gidede:gidede . .

# Python optimization for production
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

USER gidede

EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3030/api/v1/health')" || exit 1

# Run Alembic migrations on startup, then start uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 3030 --workers 4 --no-access-log"]
