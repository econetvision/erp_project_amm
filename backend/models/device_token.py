from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base


class DeviceToken(Base):
    """A push-notification registration token for one installed app instance.

    A user may have several (one per device). Tokens FCM reports as
    unregistered are deleted by the push service.
    """
    __tablename__ = "device_tokens"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token        = Column(String(512), nullable=False, unique=True)
    platform     = Column(String(20), nullable=False, default="android")
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
