"""payslip templates

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0012_payslip_templates"
down_revision = "0011_integrations"
branch_labels = None
depends_on = None

DEFAULT_LAYOUT = {
    "paperSize": "A4",
    "orientation": "portrait",
    "margins": {"top": 20, "right": 20, "bottom": 20, "left": 20},
    "showHeader": True,
    "showFooter": True,
    "showLogo": True,
    "showSignature": True,
    "primaryColor": "#0d6efd",
    "headerBg": "#0d6efd",
    "headerTextColor": "#ffffff",
    "fontFamily": "Arial, sans-serif",
    "fontSize": 14,
    "sections": [
        {"id": "company_header", "type": "header", "label": "Company Header", "enabled": True, "order": 0},
        {"id": "employee_details", "type": "info", "label": "Employee Details", "enabled": True, "order": 1, "fields": [
            {"key": "name", "label": "Employee Name", "enabled": True},
            {"key": "id", "label": "Employee ID", "enabled": True},
            {"key": "aadhar_number", "label": "Aadhar Number", "enabled": True, "masked": True},
            {"key": "bank_account_number", "label": "Bank Account", "enabled": True},
            {"key": "shift", "label": "Shift", "enabled": True},
            {"key": "department", "label": "Department", "enabled": True},
            {"key": "designation", "label": "Designation", "enabled": True},
            {"key": "work_location", "label": "Work Location", "enabled": False},
            {"key": "phone", "label": "Phone", "enabled": False},
            {"key": "email", "label": "Email", "enabled": False},
        ]},
        {"id": "pay_period", "type": "info", "label": "Pay Period", "enabled": True, "order": 2, "fields": [
            {"key": "month_year", "label": "Pay Period", "enabled": True},
            {"key": "generated_at", "label": "Generated On", "enabled": True},
        ]},
        {"id": "earnings", "type": "table", "label": "Earnings", "enabled": True, "order": 3, "fields": [
            {"key": "days_worked", "label": "Days Worked", "enabled": True},
            {"key": "total_hours", "label": "Total Hours", "enabled": True},
            {"key": "hourly_rate", "label": "Hourly Rate", "enabled": True},
            {"key": "daily_rate", "label": "Daily Rate", "enabled": True},
            {"key": "overtime_hours", "label": "Overtime Hours", "enabled": True},
            {"key": "overtime_pay", "label": "Overtime Pay", "enabled": True},
            {"key": "gross_pay", "label": "Gross Pay", "enabled": True},
        ]},
        {"id": "deductions", "type": "table", "label": "Deductions", "enabled": True, "order": 4, "fields": [
            {"key": "esi", "label": "ESI (0.75%)", "enabled": True},
            {"key": "pf", "label": "PF (12%)", "enabled": True},
            {"key": "professional_tax", "label": "Professional Tax", "enabled": False},
            {"key": "advance_deduction", "label": "Advance Deduction", "enabled": True},
            {"key": "other_deductions", "label": "Other Deductions", "enabled": False},
        ]},
        {"id": "net_pay", "type": "summary", "label": "Net Pay", "enabled": True, "order": 5},
        {"id": "formula", "type": "note", "label": "Calculation Formula", "enabled": True, "order": 6},
        {"id": "footer", "type": "footer", "label": "Footer & Signature", "enabled": True, "order": 7},
    ],
}


def upgrade() -> None:
    op.create_table(
        "payslip_templates",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("company_id", sa.Integer, sa.ForeignKey("companies.id", ondelete="CASCADE"), nullable=True),
        sa.Column("is_default", sa.Boolean, server_default="false", nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("layout", postgresql.JSONB, nullable=False),
        sa.Column("logo_url", sa.Text),
        sa.Column("company_name", sa.String(200)),
        sa.Column("company_address", sa.Text),
        sa.Column("company_phone", sa.String(50)),
        sa.Column("company_email", sa.String(200)),
        sa.Column("footer_text", sa.Text),
        sa.Column("signature_label", sa.String(200)),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_payslip_templates_company", "payslip_templates", ["company_id"])

    # Seed a default system-wide template
    import json
    op.execute(f"""
        INSERT INTO payslip_templates (name, description, is_default, is_active, layout)
        VALUES (
            'Standard Payslip',
            'Default payslip template with all standard fields',
            true,
            true,
            '{json.dumps(DEFAULT_LAYOUT)}'::jsonb
        )
    """)


def downgrade() -> None:
    op.drop_index("ix_payslip_templates_company", table_name="payslip_templates")
    op.drop_table("payslip_templates")
