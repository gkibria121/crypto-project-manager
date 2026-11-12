FROM python:3.12-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY apps/scraper/pyproject.toml apps/scraper/README.md ./
COPY apps/scraper/src ./src

RUN pip install --upgrade pip && pip install --no-cache-dir .

FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    PATH="/opt/venv/bin:$PATH" \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
    SCRAPER_PORT=8000

RUN groupadd --system --gid 1001 appgroup \
    && useradd --system --uid 1001 --gid appgroup appuser

COPY --from=builder /opt/venv /opt/venv

RUN apt-get update \
    && apt-get install -y --no-install-recommends libatomic1 \
    && mkdir -p /opt/pw-browsers \
    && playwright install chromium --with-deps \
    && chmod -R a+rx /opt/pw-browsers \
    && rm -rf /var/lib/apt/lists/*

COPY apps/scraper/src ./src

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"

CMD ["uvicorn", "scraper.main:app", "--host", "0.0.0.0", "--port", "8000"]
