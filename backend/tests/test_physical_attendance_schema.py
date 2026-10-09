import importlib
import pkgutil

import models
from sqlalchemy.orm import configure_mappers


def _import_all_models():
    for mod in pkgutil.iter_modules(models.__path__):
        importlib.import_module(f"models.{mod.name}")


def test_new_columns_exist():
    _import_all_models()
    from models.attendance import Attendance
    from models.user import User

    assert "physical_attendance_site_id" in User.__table__.c
    assert User.__table__.c.physical_attendance_site_id.nullable is True
    assert "site_location_id" in Attendance.__table__.c
    assert "marked_by" in Attendance.__table__.c


def test_mappers_still_configure():
    # attendance now has two foreign keys to users (employee_id, marked_by);
    # the employee relationship must name which one it uses.
    _import_all_models()
    configure_mappers()
