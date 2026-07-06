"""Standalone TCP gateway for hardware GPS trackers (GT06 protocol).

Not a FastAPI app — hardware trackers dial out to a fixed IP:port and speak a
binary TCP protocol, not HTTP, so this runs as its own long-lived asyncio
server, deployed separately from the main backend (see DEPLOYMENT.md).
"""
import asyncio
import logging

import config
import imei_lookup
import forwarder
from protocol_gt06 import (
    parse_frames, build_ack, decode_imei, decode_location,
    PROTO_LOGIN, PROTO_LOCATION, PROTO_LOCATION_ALT, PROTO_HEARTBEAT,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("gateway.server")

# Bounds concurrent connections; acquired per-connection, released on close.
_conn_semaphore = asyncio.Semaphore(config.MAX_CONNECTIONS)


async def handle_connection(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    peer = writer.get_extra_info("peername")
    buffer = b""
    imei: str | None = None
    # A device must log in within this deadline before location frames are honoured.
    login_deadline = asyncio.get_event_loop().time() + config.LOGIN_TIMEOUT_SECONDS
    logger.info("Device connected: %s", peer)

    try:
        while True:
            try:
                data = await asyncio.wait_for(reader.read(1024), timeout=config.READ_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                logger.info("Idle timeout for %s (imei=%s), closing", peer, imei)
                break
            if not data:
                break
            buffer += data

            # Reject a client that floods bytes without ever forming a valid frame.
            if len(buffer) > config.MAX_BUFFER_BYTES:
                logger.warning("Buffer overflow from %s (%d bytes, imei=%s), closing", peer, len(buffer), imei)
                break

            if imei is None and asyncio.get_event_loop().time() > login_deadline:
                logger.warning("Login timeout for %s, closing", peer)
                break

            frames, buffer = parse_frames(buffer)
            for frame in frames:
                if frame.protocol == PROTO_LOGIN:
                    imei = decode_imei(frame.content)
                    logger.info("Login from %s: imei=%s", peer, imei)
                    writer.write(build_ack(frame.protocol, frame.serial))
                    await writer.drain()

                elif frame.protocol in (PROTO_LOCATION, PROTO_LOCATION_ALT):
                    writer.write(build_ack(frame.protocol, frame.serial))
                    await writer.drain()
                    if imei is None:
                        logger.warning("Location frame from %s before login, dropping", peer)
                        continue
                    loc = decode_location(frame.content)
                    if loc is None:
                        continue
                    vehicle_id = imei_lookup.get_vehicle_id(imei)
                    if vehicle_id is None:
                        logger.warning("Unknown IMEI %s (no vehicle registered), dropping location", imei)
                        continue
                    await forwarder.push_location(vehicle_id, loc["latitude"], loc["longitude"], loc["speed"])

                elif frame.protocol == PROTO_HEARTBEAT:
                    writer.write(build_ack(frame.protocol, frame.serial))
                    await writer.drain()

                else:
                    logger.debug("Unhandled protocol 0x%02x from %s (imei=%s)", frame.protocol, peer, imei)

    except (ConnectionResetError, asyncio.IncompleteReadError) as e:
        logger.info("Connection lost for %s (imei=%s): %s", peer, imei, e)
    finally:
        writer.close()
        logger.info("Device disconnected: %s (imei=%s)", peer, imei)


async def _guarded_connection(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    """Enforce the global connection cap around each device session."""
    if _conn_semaphore.locked():
        logger.warning("Connection cap (%d) reached, refusing %s",
                       config.MAX_CONNECTIONS, writer.get_extra_info("peername"))
        writer.close()
        return
    async with _conn_semaphore:
        await handle_connection(reader, writer)


async def main() -> None:
    if not config.TRACKING_GATEWAY_KEY:
        # Without the shared key the backend rejects every push (401); warn loudly
        # rather than silently forwarding nothing.
        logger.critical(
            "TRACKING_GATEWAY_KEY is not set — the backend will reject all forwarded "
            "positions. Set it to the same value configured on the backend."
        )
    asyncio.create_task(imei_lookup.refresh_loop())
    server = await asyncio.start_server(_guarded_connection, config.LISTEN_HOST, config.LISTEN_PORT)
    logger.info("GT06 gateway listening on %s:%s", config.LISTEN_HOST, config.LISTEN_PORT)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
