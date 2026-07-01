"""Backfill employee_code for existing employees

Revision ID: 0021_backfill_employee_codes
Revises: 0020_add_employee_code
Create Date: 2026-07-01
"""
from alembic import op
from sqlalchemy import text
import random
import re

revision = "0021_backfill_employee_codes"
down_revision = "0020_add_employee_code"
branch_labels = None
depends_on = None


def _make_prefix(company_name: str | None) -> str:
    if not company_name:
        return "EMP"
    letters = re.sub(r"[^A-Za-z]", "", company_name).upper()
    return letters[:5] or "EMP"


def upgrade():
    # op.get_context().connection is the correct way to get the live
    # connection in modern Alembic; op.get_bind() is deprecated in 1.7+
    conn = op.get_context().connection

    employees = conn.execute(text(
        """
        SELECT u.id, c.name AS company_name
        FROM users u
        LEFT JOIN companies c ON c.id = u.company_id
        WHERE u.role IN ('worker', 'supervisor')
          AND (u.employee_code IS NULL OR u.employee_code = '')
        ORDER BY u.id
        """
    )).fetchall()

    used_codes: set[str] = set()

    for emp_id, company_name in employees:
        prefix = _make_prefix(company_name)
        code = None
        for _ in range(50):
            candidate = f"{prefix}-{random.randint(10000, 99999)}"
            if candidate not in used_codes:
                existing = conn.execute(
                    text("SELECT id FROM users WHERE employee_code = :code"),
                    {"code": candidate},
                ).fetchone()
                if not existing:
                    code = candidate
                    used_codes.add(code)
                    break
        if code:
            conn.execute(
                text("UPDATE users SET employee_code = :code WHERE id = :id"),
                {"code": code, "id": emp_id},
            )


def downgrade():
    op.execute(text(
        "UPDATE users SET employee_code = NULL WHERE role IN ('worker', 'supervisor')"
    ))
