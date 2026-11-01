# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    F1_CACHE_DIR=/data/fastf1-cache \
    F1_WAREHOUSE_DIR=/data/warehouse \
    F1_HISTORY_CACHE_DIR=/data/jolpica \
    PORT=8000

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app
COPY main.py .

# Non-root user; the cache lives on a mountable volume.
RUN useradd --create-home --uid 10001 pitwall \
    && mkdir -p /data/fastf1-cache /data/warehouse /data/jolpica \
    && chown -R pitwall:pitwall /data /app
USER pitwall
VOLUME ["/data/fastf1-cache", "/data/warehouse", "/data/jolpica"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/v1/health', timeout=4)"

# A single worker keeps one in-memory session cache; threads serve requests.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
