"""GT06 binary protocol parser — login + GPS location frames, with ACK building.

GT06 (and its many clones — Concox, JIMI, Coban-family devices) is a de-facto
standard among budget GPS trackers. Frame shape:

    [start 2B: 78 78] [length 1B] [protocol 1B] [content N B] [serial 2B] [crc 2B] [stop 2B: 0D 0A]

`length` covers protocol + content + serial (not the crc or stop bits).

This was written against the commonly published GT06 spec (the same one most
open-source GT06 decoders, e.g. Traccar's, implement) without a real device or
protocol simulator to validate against — confirm against the actual procured
hardware before relying on this in production, and adjust decode_location's
flag bits if your device's firmware variant differs.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

START_BITS = b"\x78\x78"
STOP_BITS = b"\x0d\x0a"

PROTO_LOGIN = 0x01
PROTO_LOCATION = 0x12
PROTO_LOCATION_ALT = 0x22  # some firmware variants report GPS+LBS under 0x22
PROTO_HEARTBEAT = 0x13


@dataclass
class ParsedFrame:
    protocol: int
    content: bytes
    serial: bytes


def crc16_x25(data: bytes) -> int:
    """CRC-16/X-25 as used by the GT06 checksum field."""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 1:
                crc = (crc >> 1) ^ 0x8408
            else:
                crc >>= 1
    return (~crc) & 0xFFFF


def parse_frames(buffer: bytes) -> tuple[list[ParsedFrame], bytes]:
    """Extract zero or more complete frames from a growing TCP buffer.
    Returns (frames, remaining_unparsed_buffer).

    The `length` byte covers protocol + content + serial + crc (everything
    between itself and the stop bits) — confirmed by round-tripping build_ack's
    own output (the well-known login-ack example `78 78 05 01 00 01 D9 DC 0D 0A`
    has length=5 covering exactly protocol(1)+serial(2)+crc(2))."""
    frames: list[ParsedFrame] = []
    pos = 0
    while True:
        start = buffer.find(START_BITS, pos)
        if start == -1:
            return frames, buffer[pos:]
        if len(buffer) < start + 3:
            return frames, buffer[start:]  # need more bytes for the length field

        length = buffer[start + 2]
        crc_end = start + 3 + length        # end of protocol+content+serial+crc
        frame_end = crc_end + 2             # + stop bits
        if len(buffer) < frame_end:
            return frames, buffer[start:]   # incomplete frame, wait for more data

        body_with_crc = buffer[start + 3: crc_end]
        crc_bytes = body_with_crc[-2:]
        body = body_with_crc[:-2]           # protocol + content + serial
        stop = buffer[crc_end: frame_end]

        pos = frame_end
        if stop != STOP_BITS:
            continue  # malformed frame, skip past this start marker and resync

        expected_crc = crc16_x25(buffer[start + 2: crc_end - 2])
        actual_crc = int.from_bytes(crc_bytes, "big")
        if expected_crc != actual_crc:
            continue  # bad checksum, drop frame

        if len(body) < 3:
            continue  # too short to contain protocol + serial

        protocol = body[0]
        serial = body[-2:]
        content = body[1:-2]
        frames.append(ParsedFrame(protocol=protocol, content=content, serial=serial))


def build_ack(protocol: int, serial: bytes) -> bytes:
    """Standard GT06 ACK: echo protocol number + serial, length=5 (protocol+serial+crc)."""
    body = bytes([protocol]) + serial
    length = bytes([len(body) + 2])  # +2 for the crc that follows
    crc = crc16_x25(length + body)
    return START_BITS + length + body + crc.to_bytes(2, "big") + STOP_BITS


def decode_imei(content: bytes) -> Optional[str]:
    """Login packet content is an 8-byte BCD-encoded terminal ID; the IMEI is the
    last 15 digits of the 16 BCD digits (leading nibble is a variant/padding byte)."""
    if len(content) < 8:
        return None
    digits = "".join(f"{b:02x}" for b in content[:8])
    imei = digits.lstrip("0") or digits
    return imei[-15:] if len(imei) >= 15 else imei


def decode_location(content: bytes) -> Optional[dict]:
    """Decode a 0x12/0x22 GPS location packet's date/time, lat/lng, speed, course."""
    if len(content) < 16:
        return None

    yy, mm, dd, hh, mi, ss = content[0:6]
    try:
        timestamp = datetime(2000 + yy, mm, dd, hh, mi, ss, tzinfo=timezone.utc)
    except ValueError:
        timestamp = datetime.now(timezone.utc)

    # content[6] = satellite/GPS info nibble — not used here
    raw_lat = int.from_bytes(content[7:11], "big")
    raw_lng = int.from_bytes(content[11:15], "big")
    speed = content[15]

    latitude = raw_lat / 30000.0 / 60.0
    longitude = raw_lng / 30000.0 / 60.0

    course_status = int.from_bytes(content[16:18], "big") if len(content) >= 18 else 0
    if not (course_status & 0x0400):  # bit 10 = latitude N/S, 0 = south in this variant
        latitude = -latitude
    if not (course_status & 0x0800):  # bit 11 = longitude E/W, 0 = west
        longitude = -longitude

    return {
        "latitude": round(latitude, 6),
        "longitude": round(longitude, 6),
        "speed": float(speed),
        "recorded_at": timestamp.isoformat(),
    }
