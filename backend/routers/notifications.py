from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.notification import Notification
from schemas.notification import NotificationResponse
from auth.dependencies import get_current_user

router = APIRouter()


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == current.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current.id, Notification.is_read == False)
        .count()
    )
    return {"count": count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(notification_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current.id,
    ).first()
    if n:
        n.is_read = True
        db.commit()
        db.refresh(n)
    return n


@router.patch("/read-all")
def mark_all_read(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.user_id == current.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"detail": "All notifications marked as read"}
