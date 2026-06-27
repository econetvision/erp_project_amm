import os

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8088").rstrip("/")
TRACKING_GATEWAY_KEY = os.getenv("TRACKING_GATEWAY_KEY", "")
LISTEN_HOST = os.getenv("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.getenv("LISTEN_PORT", "5023"))
IMEI_MAP_REFRESH_SECONDS = int(os.getenv("IMEI_MAP_REFRESH_SECONDS", "300"))
