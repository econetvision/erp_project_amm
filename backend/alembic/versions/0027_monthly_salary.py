"""add monthly_salary to users and payslips

Pay is now driven by a monthly salary rather than a derived daily rate.
`users.monthly_salary` is the admin-entered figure; `hourly_rate` is retained
alongside it (overtime is still priced per hour). Payslips snapshot both the
monthly salary and the working-days divisor they were calculated from so an
old payslip stays reproducible after a company changes its payroll config.

Existing rows are back-filled from the previous daily formula
(hourly_rate * effective_hours * 26) so no employee is left on zero pay:
  SHIFT_A -> 7.17 effective hours, SHIFT_B -> 7.67.

Revision ID: 0027_monthly_salary
Revises: 0026_tenant_scoping
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0027_monthly_salary"
down_revision = "0026_tenant_scoping"
branch_labels = None
depends_on = None

WORKING_DAYS = 26


def _columns(table: str) -> set:
    bind = op.get_bind()
    inspector = sa_inspect(bind)
    if table not in inspector.get_table_names():
        return set()
    return {c["name"] for c in inspector.get_columns(table)}


def upgrade():
    user_cols = _columns("users")
    if user_cols and "monthly_salary" not in user_cols:
        op.add_column(
            "users",
            sa.Column("monthly_salary", sa.Numeric(12, 2), nullable=True, server_default="0.00"),
        )
        # Back-fill from the old daily formula so existing employees keep their pay.
        op.execute(
            f"""
            UPDATE users
               SET monthly_salary = ROUND(
                     COALESCE(hourly_rate, 0)
                     * CASE WHEN shift = 'SHIFT_B' THEN 7.67 ELSE 7.17 END
                     * {WORKING_DAYS}, 2)
             WHERE COALESCE(monthly_salary, 0) = 0
            """
        )

    payslip_cols = _columns("payslips")
    if payslip_cols and "monthly_salary" not in payslip_cols:
        op.add_column(
            "payslips",
            sa.Column("monthly_salary", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        )
        # Historic payslips: reconstruct the monthly figure from the stored daily rate.
        op.execute(
            f"UPDATE payslips SET monthly_salary = ROUND(COALESCE(daily_rate, 0) * {WORKING_DAYS}, 2) "
            f"WHERE COALESCE(monthly_salary, 0) = 0"
        )

    if payslip_cols and "working_days" not in payslip_cols:
        op.add_column(
            "payslips",
            sa.Column("working_days", sa.SmallInteger(), nullable=False, server_default=str(WORKING_DAYS)),
        )


def downgrade():
    payslip_cols = _columns("payslips")
    if "working_days" in payslip_cols:
        op.drop_column("payslips", "working_days")
    if "monthly_salary" in payslip_cols:
        op.drop_column("payslips", "monthly_salary")

    if "monthly_salary" in _columns("users"):
        op.drop_column("users", "monthly_salary")
