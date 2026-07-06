import os

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8088").rstrip("/")
TRACKING_GATEWAY_KEY = os.getenv("TRACKING_GATEWAY_KEY", "")
LISTEN_HOST = os.getenv("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.getenv("LISTEN_PORT", "5023"))
IMEI_MAP_REFRESH_SECONDS = int(os.getenv("IMEI_MAP_REFRESH_SECONDS", "300"))

# ── Abuse / resource limits ──────────────────────────────────────────────────
# Max concurrent device connections the gateway will service at once.
MAX_CONNECTIONS = int(os.getenv("GATEWAY_MAX_CONNECTIONS", "2000"))
# Drop a socket that sends no data for this many seconds (slowloris / idle).
READ_TIMEOUT_SECONDS = int(os.getenv("GATEWAY_READ_TIMEOUT_SECONDS", "120"))
# Hard cap on the per-connection receive buffer; a device that never sends a
# valid frame start marker (0x78 0x78) can't grow memory without bound.
MAX_BUFFER_BYTES = int(os.getenv("GATEWAY_MAX_BUFFER_BYTES", "8192"))
# Require a device to log in (send an IMEI) within this window before we accept
# any location frame; also bounds pre-auth resource use.
LOGIN_TIMEOUT_SECONDS = int(os.getenv("GATEWAY_LOGIN_TIMEOUT_SECONDS", "30"))
