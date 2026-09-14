"""Firebase Cloud Messaging delivery.

Push is optional. When neither FIREBASE_CREDENTIALS_JSON nor
FIREBASE_CREDENTIALS_FILE is configured (or firebase-admin is not installed)
every call is a silent no-op so in-app notifications keep working.
"""
import json
import logging
import threading
from typing import Iterable

from sqlalchemy.orm import Session

from config.settings import settings
from models.device_token import DeviceToken

logger = logging.getLogger("push")

_init_lock = threading.Lock()
_initialised = False
_available = False

# FCM multicast accepts at most 500 tokens per call.
_MULTICAST_BATCH = 500


def _init() -> bool:
    """Initialise firebase_admin once. Returns True when push can be sent."""
    global _initialised, _available
    if _initialised:
        return _available
    with _init_lock:
        if _initialised:
            return _available
        _initialised = True
        if not (settings.firebase_credentials_json or settings.firebase_credentials_file):
            logger.info("Push disabled: no Firebase credentials configured")
            return False
        try:
            import firebase_admin
            from firebase_admin import credentials
        except ImportError:
            logger.warning("Push disabled: firebase-admin is not installed")
            return False
        try:
            if settings.firebase_credentials_json:
                cred = credentials.Certificate(json.loads(settings.firebase_credentials_json))
            else:
                cred = credentials.Certificate(settings.firebase_credentials_file)
            firebase_admin.initialize_app(cred)
            _available = True
            logger.info("Firebase push initialised")
        except Exception as exc:  # bad JSON, unreadable file, etc.
            logger.error("Push disabled: Firebase init failed: %s", exc)
            _available = False
        return _available


def push_enabled() -> bool:
    return _init()


def _is_dead_token_error(exc: Exception) -> bool:
    name = type(exc).__name__
    if name in ("UnregisteredError", "SenderIdMismatchError"):
        return True
    code = str(getattr(exc, "code", "") or "").upper()
    return "UNREGISTERED" in code or "NOT_FOUND" in code


def send_push(
    db: Session,
    user_ids: Iterable[int],
    title: str,
    body: str,
    data: dict | None = None,
) -> int:
    """Send a notification to every registered device of ``user_ids``.

    Returns the number of devices FCM accepted. Tokens FCM reports as
    unregistered are deleted so they stop being retried.
    """
    ids = [int(u) for u in set(user_ids)]
    if not ids or not _init():
        return 0

    tokens = db.query(DeviceToken).filter(DeviceToken.user_id.in_(ids)).all()
    if not tokens:
        return 0

    from firebase_admin import messaging

    # FCM data values must be strings.
    str_data = {str(k): str(v) for k, v in (data or {}).items()}
    sent = 0
    dead: list[str] = []
    token_strings = [t.token for t in tokens]
    for i in range(0, len(token_strings), _MULTICAST_BATCH):
        batch = token_strings[i:i + _MULTICAST_BATCH]
        message = messaging.MulticastMessage(
            tokens=batch,
            notification=messaging.Notification(title=title, body=body),
            data=str_data,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(channel_id="alerts", sound="default"),
            ),
        )
        try:
            resp = messaging.send_each_for_multicast(message)
        except Exception as exc:
            logger.error("FCM send failed: %s", exc)
            continue
        sent += resp.success_count
        for tok, r in zip(batch, resp.responses):
            if r.success:
                continue
            if r.exception is not None and _is_dead_token_error(r.exception):
                dead.append(tok)
            else:
                logger.warning("FCM delivery error for one device: %s", r.exception)

    if dead:
        db.query(DeviceToken).filter(DeviceToken.token.in_(dead)).delete(synchronize_session=False)
        db.commit()
        logger.info("Removed %d unregistered device token(s)", len(dead))
    return sent
