"""Forwards parsed locations to the main backend's existing /api/tracking/push
endpoint, reusing all its persistence and WebSocket-broadcast logic rather than
duplicating it here."""
import logging
import httpx
import config

logger = logging.getLogger("gateway.forwarder")

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=10)
    return _client


async def push_location(vehicle_id: int, latitude: float, longitude: float, speed: float | None) -> None:
    url = f"{config.BACKEND_URL}/api/tracking/push"
    headers = {"X-Internal-Key": config.TRACKING_GATEWAY_KEY}
    payload = {"vehicle_id": vehicle_id, "latitude": latitude, "longitude": longitude, "speed": speed}
    try:
        resp = await get_client().post(url, json=payload, headers=headers)
        if resp.status_code >= 400:
            logger.warning("Push rejected for vehicle_id=%s: %s %s", vehicle_id, resp.status_code, resp.text)
    except Exception as e:
        logger.warning("Push failed for vehicle_id=%s: %s", vehicle_id, e)
