FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Build metadata injected at build time
ARG APP_VERSION=1.0.0
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV APP_VERSION=$APP_VERSION
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME

# Run as non-root user
RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8088
CMD ["sh", "-c", "python migrate.py upgrade && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8088} --workers 2"]
