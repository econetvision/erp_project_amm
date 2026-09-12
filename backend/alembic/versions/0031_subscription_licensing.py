"""Subscriptions, site licences and invoices (replaces company_licenses).

Revision ID: 0031_subscriptions_licenses_invoices
Revises: 0030_geofence_exit_alerts
Create Date: 2026-09-12
"""
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.dialects.postgresql import JSONB

revision = "0031_subscriptions_licenses_invoices"
down_revision = "0030_geofence_exit_alerts"
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    return sa_inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if not _table_exists("subscriptions"):
        op.create_table(
            "subscriptions",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("plan", sa.String(20), nullable=False, server_default="basic"),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("billing_cycle", sa.String(10), nullable=False, server_default="yearly"),
            sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("unit_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
            sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="18"),
            sa.Column("features", JSONB, nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_subscriptions_company_id", "subscriptions", ["company_id"])
        op.execute(
            "CREATE UNIQUE INDEX ux_subscriptions_one_active_per_company "
            "ON subscriptions (company_id) WHERE status <> 'cancelled'"
        )

    if not _table_exists("licenses"):
        op.create_table(
            "licenses",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("subscription_id", sa.Integer, sa.ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("site_id", sa.Integer, sa.ForeignKey("work_locations.id", ondelete="SET NULL"), nullable=True),
            sa.Column("license_key", sa.String(64), nullable=False, unique=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("max_users", sa.Integer, nullable=True, server_default="26"),
            sa.Column("max_admins", sa.Integer, nullable=False, server_default="1"),
            sa.Column("granted_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("revoked_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("revoke_reason", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_licenses_company_status", "licenses", ["company_id", "status"])

    if not _table_exists("invoices"):
        op.create_table(
            "invoices",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("invoice_number", sa.String(30), nullable=False, unique=True),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("subscription_id", sa.Integer, sa.ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True),
            sa.Column("period_start", sa.Date, nullable=False),
            sa.Column("period_end", sa.Date, nullable=False),
            sa.Column("issue_date", sa.Date, nullable=False),
            sa.Column("due_date", sa.Date, nullable=False),
            sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
            sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("tax_rate", sa.Numeric(5, 2), nullable=False, server_default="18"),
            sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("total", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
            sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("payment_ref", sa.String(100), nullable=True),
            sa.Column("billing_snapshot", JSONB, nullable=True),
            sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_invoices_company_id", "invoices", ["company_id"])

    if not _table_exists("invoice_lines"):
        op.create_table(
            "invoice_lines",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("invoice_id", sa.Integer, sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
            sa.Column("license_id", sa.Integer, sa.ForeignKey("licenses.id", ondelete="SET NULL"), nullable=True),
            sa.Column("description", sa.String(255), nullable=False),
            sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
            sa.Column("unit_price", sa.Numeric(12, 2), nullable=False, server_default="0"),
            sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        )
        op.create_index("ix_invoice_lines_invoice_id", "invoice_lines", ["invoice_id"])

    # ── Data migration: one subscription + one company-wide licence per legacy row ──
    if _table_exists("company_licenses"):
        conn = op.get_bind()
        rows = conn.execute(sa.text(
            "SELECT cl.id, cl.company_id, cl.license_key, cl.tier, cl.status, cl.max_seats, "
            "cl.valid_from, cl.valid_until, cl.features, cl.notes, COALESCE(c.currency, 'INR') AS currency "
            "FROM company_licenses cl JOIN companies c ON c.id = cl.company_id"
        )).mappings().all()
        for r in rows:
            sub_status = "active" if r["status"] == "active" else "suspended"
            sub_id = conn.execute(sa.text(
                "INSERT INTO subscriptions (company_id, plan, status, billing_cycle, starts_at, ends_at, "
                "unit_price, currency, tax_rate, features, notes) "
                "VALUES (:company_id, :plan, :status, 'yearly', COALESCE(:starts_at, now()), :ends_at, "
                "0, :currency, 18, CAST(:features AS jsonb), :notes) RETURNING id"
            ), {
                "company_id": r["company_id"], "plan": r["tier"] or "basic", "status": sub_status,
                "starts_at": r["valid_from"], "ends_at": r["valid_until"],
                "currency": (r["currency"] or "INR")[:3],
                "features": None if r["features"] is None else json.dumps(r["features"]),
                "notes": r["notes"],
            }).scalar_one()
            conn.execute(sa.text(
                "INSERT INTO licenses (subscription_id, company_id, site_id, license_key, status, max_users, max_admins, granted_at) "
                "VALUES (:sub_id, :company_id, NULL, :key, :status, :max_users, 1, COALESCE(:granted_at, now()))"
            ), {
                "sub_id": sub_id, "company_id": r["company_id"], "key": r["license_key"],
                "status": "active" if r["status"] == "active" else "revoked",
                "max_users": r["max_seats"],           # NULL stays NULL = unlimited
                "granted_at": r["valid_from"],
            })
        op.drop_table("company_licenses")


def downgrade() -> None:
    if not _table_exists("company_licenses"):
        op.create_table(
            "company_licenses",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("license_key", sa.String(64), nullable=False, unique=True),
            sa.Column("tier", sa.String(20), nullable=False, server_default="basic"),
            sa.Column("status", sa.String(20), nullable=False, server_default="active"),
            sa.Column("max_seats", sa.Integer, nullable=True),
            sa.Column("valid_from", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("features", JSONB, nullable=True),
            sa.Column("notes", sa.Text, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    if _table_exists("subscriptions"):
        # First non-cancelled subscription per company, with its first active licence (or any licence).
        op.execute(sa.text("""
            INSERT INTO company_licenses (company_id, license_key, tier, status, max_seats, valid_from, valid_until, features, notes)
            SELECT DISTINCT ON (s.company_id)
                   s.company_id,
                   COALESCE(l.license_key, md5(random()::text)),
                   s.plan,
                   CASE WHEN s.status IN ('trial','active') THEN 'active' ELSE 'suspended' END,
                   l.max_users,
                   s.starts_at, s.ends_at, s.features, s.notes
            FROM subscriptions s
            LEFT JOIN licenses l ON l.subscription_id = s.id
            WHERE s.status <> 'cancelled'
            ORDER BY s.company_id, (l.status = 'active') DESC, l.id
        """))
    for name in ("invoice_lines", "invoices", "licenses", "subscriptions"):
        if _table_exists(name):
            op.drop_table(name)
