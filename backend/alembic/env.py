"""Alembic environment configuration.

Reads DATABASE_URL from the environment (same variable the app uses)
and points Alembic at the project's SQLAlchemy metadata so autogenerate
can diff models against the live schema.
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# ---------------------------------------------------------------------------
# Make sure the backend package is importable (needed inside Docker too)
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import Base  # noqa: E402

# Import every model so Base.metadata is fully populated
import models.employee           # noqa: F401, E402
import models.user               # noqa: F401, E402
import models.attendance         # noqa: F401, E402
import models.payslip            # noqa: F401, E402
import models.holiday            # noqa: F401, E402
import models.vehicle            # noqa: F401, E402
import models.vehicle_assignment # noqa: F401, E402
import models.vehicle_location   # noqa: F401, E402
import models.job_routine        # noqa: F401, E402
import models.notification       # noqa: F401, E402
import models.salary_structure   # noqa: F401, E402
import models.advance            # noqa: F401, E402
import models.payroll_run        # noqa: F401, E402

# ---------------------------------------------------------------------------
# Alembic Config object
# ---------------------------------------------------------------------------
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url with the env-var the app already uses
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://erp_user:erp_pass@localhost:5432/erp_db",
)
config.set_main_option("sqlalchemy.url", DATABASE_URL)


# ---------------------------------------------------------------------------
# Offline / Online migration runners
# ---------------------------------------------------------------------------

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — emits SQL to stdout."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
