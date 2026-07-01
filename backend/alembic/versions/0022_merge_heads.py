"""merge divergent heads (company_licenses + backfill_employee_codes)

Two migration branches forked at 0018_reset_admin_password:
  - 0019_company_licenses
  - 0019_cleanup_null_name_role -> 0020_add_employee_code -> 0021_backfill_employee_codes

This no-op merge rejoins them into a single head so `alembic upgrade head`
is unambiguous.

Revision ID: 0022_merge_heads
Revises: 0021_backfill_employee_codes, 0019_company_licenses
Create Date: 2026-07-01
"""

# revision identifiers, used by Alembic.
revision = "0022_merge_heads"
down_revision = ("0021_backfill_employee_codes", "0019_company_licenses")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
