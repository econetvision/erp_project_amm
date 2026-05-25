from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class Permission(Base):
    __tablename__ = "permissions"

    id          = Column(Integer, primary_key=True, index=True)
    code        = Column(String(100), nullable=False, unique=True)   # e.g. "attendance.view"
    name        = Column(String(255), nullable=False)                # e.g. "View Attendance"
    module      = Column(String(50), nullable=False)                 # e.g. "attendance"
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())


class Role(Base):
    __tablename__ = "roles"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(50), nullable=False)         # e.g. "admin", "supervisor", custom roles
    company_id  = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    is_system   = Column(Boolean, nullable=False, default=False)  # system roles can't be deleted
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("name", "company_id", name="uq_role_name_company"),
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id            = Column(Integer, primary_key=True, index=True)
    role_id       = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    company_id  = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    action      = Column(String(50), nullable=False)        # create, update, delete, login, impersonate
    entity_type = Column(String(50), nullable=True)          # e.g. "employee", "payroll"
    entity_id   = Column(Integer, nullable=True)
    details     = Column(Text, nullable=True)
    ip_address  = Column(String(45), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
