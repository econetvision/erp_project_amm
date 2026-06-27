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


async def handle_connection(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    peer = writer.get_extra_info("peername")
    buffer = b""
    imei: str | None = None
    logger.info("Device connected: %s", peer)

    try:
        while True:
            data = await reader.read(1024)
            if not data:
                break
            buffer += data

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


async def main() -> None:
    asyncio.create_task(imei_lookup.refresh_loop())
    server = await asyncio.start_server(handle_connection, config.LISTEN_HOST, config.LISTEN_PORT)
    logger.info("GT06 gateway listening on %s:%s", config.LISTEN_HOST, config.LISTEN_PORT)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
