import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from models.vehicle_location import VehicleLocation
from config.settings import settings

logger = logging.getLogger("tracking_retention")

LOCATION_RETENTION_DAYS = settings.location_retention_days


def purge_old_vehicle_locations(db: Session) -> int:
    """Delete vehicle_locations rows older than LOCATION_RETENTION_DAYS. Returns rows deleted."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOCATION_RETENTION_DAYS)
    deleted = db.query(VehicleLocation).filter(VehicleLocation.recorded_at < cutoff).delete(synchronize_session=False)
    db.commit()
    if deleted:
        logger.info("Purged %d vehicle_locations row(s) older than %d days", deleted, LOCATION_RETENTION_DAYS)
    return deleted
