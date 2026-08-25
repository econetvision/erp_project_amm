"""merge divergent heads (monthly_salary + ifsc_directory)

Two migration branches forked at 0026_tenant_scoping:
  - 0027_monthly_salary
  - 0027_provider_config_schemas -> 0028_ifsc_directory

0027_monthly_salary was authored on a branch cut before
0027_provider_config_schemas landed on master, so merging it left
`alembic upgrade head` with two heads — which aborts container startup in
entrypoint.sh before uvicorn ever runs.

This no-op merge rejoins them into a single head. Deployed databases sitting
at 0028_ifsc_directory pick up 0027_monthly_salary (the missing ancestor) and
then this merge on the next upgrade.

Revision ID: 0029_merge_heads
Revises: 0027_monthly_salary, 0028_ifsc_directory
Create Date: 2026-08-25
"""

# revision identifiers, used by Alembic.
revision = "0029_merge_heads"
down_revision = ("0027_monthly_salary", "0028_ifsc_directory")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
