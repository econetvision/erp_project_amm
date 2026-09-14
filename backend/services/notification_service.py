"""Create in-app notifications and fan them out to push devices."""
import logging
from typing import Iterable

from sqlalchemy.orm import Session

from models.notification import Notification
from services.push_service import send_push

logger = logging.getLogger("notifications")


def notify_users(
    db: Session,
    user_ids: Iterable[int],
    title: str,
    body: str,
    type_: str = "info",
    data: dict | None = None,
) -> list[int]:
    """Write one ``notifications`` row per user and push to their devices.

    Returns the list of user ids that were notified. Commits the session.
    """
    ids = sorted({int(u) for u in user_ids})
    if not ids:
        return []
    for uid in ids:
        db.add(Notification(user_id=uid, title=title, body=body, type=type_))
    db.commit()
    try:
        send_push(db, ids, title, body, data)
    except Exception as exc:  # push must never break the caller
        logger.error("Push fan-out failed: %s", exc, exc_info=True)
    return ids
