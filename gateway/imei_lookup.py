"""IMEI -> vehicle_id lookup, cached in memory and refreshed from the main backend
(GET /api/vehicles/imei-map) rather than hitting the database directly — keeps
this gateway decoupled from the backend's schema and DB credentials."""
import asyncio
import logging
import httpx
import config

logger = logging.getLogger("gateway.imei_lookup")

_cache: dict[str, int] = {}
_lock = asyncio.Lock()


def get_vehicle_id(imei: str) -> int | None:
    return _cache.get(imei)


async def refresh_once() -> None:
    url = f"{config.BACKEND_URL}/api/vehicles/imei-map"
    headers = {"X-Internal-Key": config.TRACKING_GATEWAY_KEY}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            mapping = resp.json()
    except Exception as e:
        logger.warning("Failed to refresh IMEI map: %s", e)
        return

    async with _lock:
        _cache.clear()
        _cache.update(mapping)
    logger.info("IMEI map refreshed: %d vehicle(s) registered", len(mapping))


async def refresh_loop() -> None:
    while True:
        await refresh_once()
        await asyncio.sleep(config.IMEI_MAP_REFRESH_SECONDS)
