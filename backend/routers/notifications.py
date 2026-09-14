from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models.user import User
from models.notification import Notification
from models.device_token import DeviceToken
from schemas.notification import NotificationResponse
from schemas.geofence import DeviceTokenRequest, DeviceTokenDeleteRequest
from auth.dependencies import get_current_user
from services.push_service import push_enabled

router = APIRouter()


# -- Push device tokens -------------------------------------------------------

@router.post("/device-token", status_code=201)
def register_device_token(
    payload: DeviceTokenRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """Register (or re-own) an FCM token for the current user's device.

    A token is unique per app install; if another user previously logged in
    on the same device the row is moved to the new user.
    """
    row = db.query(DeviceToken).filter(DeviceToken.token == payload.token).first()
    if row:
        row.user_id = current.id
        row.platform = payload.platform
    else:
        db.add(DeviceToken(user_id=current.id, token=payload.token, platform=payload.platform))
    db.commit()
    return {"detail": "registered", "push_enabled": push_enabled()}


@router.delete("/device-token")
def unregister_device_token(
    payload: DeviceTokenDeleteRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    db.query(DeviceToken).filter(
        DeviceToken.token == payload.token,
        DeviceToken.user_id == current.id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"detail": "unregistered"}


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
