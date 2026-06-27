# Tracking Gateway

Standalone TCP service that translates the GT06 hardware GPS tracker protocol
into calls against the main backend's existing `POST /api/tracking/push`
endpoint. Deployed separately from `backend/` and `frontend/` — see the
"Fleet Tracking Gateway" section in [DEPLOYMENT.md](../DEPLOYMENT.md).

## Why a separate service

GT06-family trackers (Concox/JIMI/Coban — the cheapest, most common budget
hardware) dial out to a fixed `IP:port` and speak a binary TCP protocol, not
HTTP. A long-lived raw TCP socket server doesn't fit the main backend's
multi-process ASGI deployment, so this runs as its own process with its own
public port (via Railway's TCP Proxy, since most PaaS HTTP ingress doesn't
expose arbitrary TCP ports for hardware to connect to).

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8088` | Main backend base URL |
| `TRACKING_GATEWAY_KEY` | _(empty)_ | Shared secret — must match the backend's `TRACKING_GATEWAY_KEY` env var |
| `LISTEN_HOST` | `0.0.0.0` | TCP bind address |
| `LISTEN_PORT` | `5023` | TCP bind port — configure this (or the Railway TCP Proxy's public host:port) into each tracker device |
| `IMEI_MAP_REFRESH_SECONDS` | `300` | How often to refresh the IMEI→vehicle_id cache from the backend |

## Local dev

```bash
cd gateway
pip install -r requirements.txt
BACKEND_URL=http://localhost:8088 TRACKING_GATEWAY_KEY=dev-key python server.py
```

Test with a GT06 protocol simulator/emulated TCP client before any physical
hardware is available — `protocol_gt06.py` was written against the commonly
published GT06 spec but has not been validated against a real device. Confirm
byte-level decoding (especially `decode_location`'s N/S/E/W flag bits) against
your actual procured tracker model before relying on this in production.

## Adding support for a different protocol

Only `protocol_gt06.py` is protocol-specific. `imei_lookup.py`, `forwarder.py`,
and `server.py`'s connection loop are written generically enough that a
different tracker protocol (e.g. Teltonika Codec8) would mean swapping the
parser, not rewriting the gateway.
