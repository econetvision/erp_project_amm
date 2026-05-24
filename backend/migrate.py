#!/usr/bin/env python3
"""
DB migration helper — thin wrapper around Alembic.

Usage (from backend/):
    python migrate.py upgrade          # apply all pending migrations
    python migrate.py downgrade -1     # revert last migration
    python migrate.py current          # show current revision
    python migrate.py history          # show migration history
    python migrate.py generate "add foo column"   # autogenerate a new migration
    python migrate.py stamp head       # mark DB as up-to-date without running SQL
"""

import sys
import os

# Ensure the backend directory is on the path
sys.path.insert(0, os.path.dirname(__file__))

from alembic.config import Config
from alembic import command


def get_alembic_config() -> Config:
    ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
    cfg = Config(ini_path)
    # Override DB URL from env (same var the app uses)
    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql://erp_user:erp_pass@localhost:5432/erp_db",
    )
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cfg = get_alembic_config()
    action = sys.argv[1]

    if action == "upgrade":
        revision = sys.argv[2] if len(sys.argv) > 2 else "head"
        print(f"[migrate] Upgrading to {revision} …")
        command.upgrade(cfg, revision)
        print("[migrate] Done.")

    elif action == "downgrade":
        revision = sys.argv[2] if len(sys.argv) > 2 else "-1"
        print(f"[migrate] Downgrading {revision} …")
        command.downgrade(cfg, revision)
        print("[migrate] Done.")

    elif action == "current":
        command.current(cfg, verbose=True)

    elif action == "history":
        command.history(cfg, indicate_current=True)

    elif action == "generate":
        if len(sys.argv) < 3:
            print("Usage: python migrate.py generate \"description\"")
            sys.exit(1)
        message = sys.argv[2]
        print(f"[migrate] Generating migration: {message}")
        command.revision(cfg, message=message, autogenerate=True)
        print("[migrate] Migration file created in alembic/versions/")

    elif action == "stamp":
        revision = sys.argv[2] if len(sys.argv) > 2 else "head"
        print(f"[migrate] Stamping DB at {revision} …")
        command.stamp(cfg, revision)
        print("[migrate] Done.")

    else:
        print(f"Unknown action: {action}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
