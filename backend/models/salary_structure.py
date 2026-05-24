from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, SmallInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(255), nullable=False, unique=True)
    description = Column(String(500), nullable=True)
    is_default  = Column(Boolean, nullable=False, default=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    components = relationship("SalaryComponent", back_populates="structure", cascade="all, delete")


class SalaryComponent(Base):
    __tablename__ = "salary_components"

    id                    = Column(Integer, primary_key=True, index=True)
    structure_id          = Column(Integer, ForeignKey("salary_structures.id", ondelete="CASCADE"), nullable=False)
    name                  = Column(String(100), nullable=False)
    type                  = Column(String(20), nullable=False)      # earning | deduction
    calculation_type      = Column(String(30), nullable=False)      # fixed | percentage_of_basic | percentage_of_gross
    amount_or_percentage  = Column(Numeric(12, 4), nullable=False, default=0)
    is_mandatory          = Column(Boolean, nullable=False, default=True)
    display_order         = Column(SmallInteger, nullable=False, default=0)

    structure = relationship("SalaryStructure", back_populates="components")


class EmployeeSalary(Base):
    __tablename__ = "employee_salary"

    id              = Column(Integer, primary_key=True, index=True)
    employee_id     = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    structure_id    = Column(Integer, ForeignKey("salary_structures.id", ondelete="CASCADE"), nullable=False)
    basic_pay       = Column(Numeric(12, 2), nullable=False)
    effective_from  = Column(DateTime(timezone=True), server_default=func.now())
    effective_to    = Column(DateTime(timezone=True), nullable=True)  # null = currently active
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
