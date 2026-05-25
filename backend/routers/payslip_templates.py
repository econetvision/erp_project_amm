from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.payslip_template import PayslipTemplate
from models.user import User
from schemas.payslip_template import (
    PayslipTemplateCreate,
    PayslipTemplateUpdate,
    PayslipTemplateResponse,
    DEFAULT_LAYOUT,
)
from auth.dependencies import require_admin, get_current_user

router = APIRouter()


@router.get("", response_model=list[PayslipTemplateResponse])
def list_templates(
    company_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(PayslipTemplate).filter(PayslipTemplate.is_active == True)
    if company_id:
        q = q.filter(
            (PayslipTemplate.company_id == company_id)
            | (PayslipTemplate.company_id.is_(None))
        )
    return q.order_by(PayslipTemplate.is_default.desc(), PayslipTemplate.name).all()


@router.get("/default-layout")
def get_default_layout():
    """Return the built-in default layout JSON for the builder UI."""
    return DEFAULT_LAYOUT


@router.get("/{template_id}", response_model=PayslipTemplateResponse)
def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t = db.query(PayslipTemplate).filter(PayslipTemplate.id == template_id).first()
    if not t:
        raise HTTPException(404, "Template not found")
    return t


@router.post("", response_model=PayslipTemplateResponse, status_code=201)
def create_template(
    payload: PayslipTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    if payload.is_default:
        # Unset other defaults in the same scope
        db.query(PayslipTemplate).filter(
            PayslipTemplate.company_id == payload.company_id,
            PayslipTemplate.is_default == True,
        ).update({"is_default": False})

    t = PayslipTemplate(
        **payload.model_dump(),
        created_by=user.id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.put("/{template_id}", response_model=PayslipTemplateResponse)
def update_template(
    template_id: int,
    payload: PayslipTemplateUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    t = db.query(PayslipTemplate).filter(PayslipTemplate.id == template_id).first()
    if not t:
        raise HTTPException(404, "Template not found")

    data = payload.model_dump(exclude_unset=True)

    if data.get("is_default"):
        db.query(PayslipTemplate).filter(
            PayslipTemplate.company_id == t.company_id,
            PayslipTemplate.is_default == True,
            PayslipTemplate.id != template_id,
        ).update({"is_default": False})

    for k, v in data.items():
        setattr(t, k, v)

    db.commit()
    db.refresh(t)
    return t


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    t = db.query(PayslipTemplate).filter(PayslipTemplate.id == template_id).first()
    if not t:
        raise HTTPException(404, "Template not found")
    db.delete(t)
    db.commit()


@router.post("/{template_id}/duplicate", response_model=PayslipTemplateResponse, status_code=201)
def duplicate_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    src = db.query(PayslipTemplate).filter(PayslipTemplate.id == template_id).first()
    if not src:
        raise HTTPException(404, "Template not found")

    dup = PayslipTemplate(
        name=f"{src.name} (Copy)",
        description=src.description,
        company_id=src.company_id,
        is_default=False,
        layout=src.layout,
        logo_url=src.logo_url,
        company_name=src.company_name,
        company_address=src.company_address,
        company_phone=src.company_phone,
        company_email=src.company_email,
        footer_text=src.footer_text,
        signature_label=src.signature_label,
        created_by=user.id,
    )
    db.add(dup)
    db.commit()
    db.refresh(dup)
    return dup
