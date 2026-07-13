"""Local IFSC directory tables for the Razorpay IFSC dataset
(https://github.com/razorpay/ifsc/releases).

Revision ID: 0028_ifsc_directory
Revises: 0027_provider_config_schemas
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect

revision = "0028_ifsc_directory"
down_revision = "0027_provider_config_schemas"
branch_labels = None
depends_on = None


def _table_exists(name):
    return sa_inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _table_exists("ifsc_codes"):
        op.create_table(
            "ifsc_codes",
            sa.Column("ifsc", sa.String(11), primary_key=True),
            sa.Column("bank", sa.String(200), nullable=False),
            sa.Column("branch", sa.Text),
            sa.Column("centre", sa.String(200)),
            sa.Column("district", sa.String(200)),
            sa.Column("state", sa.String(200)),
            sa.Column("address", sa.Text),
            sa.Column("city", sa.String(200)),
            sa.Column("contact", sa.String(100)),
            sa.Column("micr", sa.String(20)),
            sa.Column("swift", sa.String(20)),
            sa.Column("iso3166", sa.String(10)),
            sa.Column("imps", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("rtgs", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("neft", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("upi", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    if not _table_exists("ifsc_dataset_meta"):
        op.create_table(
            "ifsc_dataset_meta",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("version", sa.String(40), nullable=False),
            sa.Column("row_count", sa.Integer, nullable=False, server_default="0"),
            sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("ifsc_dataset_meta")
    op.drop_table("ifsc_codes")
