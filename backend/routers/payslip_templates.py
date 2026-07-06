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
from auth.dependencies import require_admin, get_current_user, assert_tenant

router = APIRouter()


@router.get("", response_model=list[PayslipTemplateResponse])
def list_templates(
    company_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(PayslipTemplate).filter(PayslipTemplate.is_active == True)
    if user.role != "master":
        # Non-master: ignore any client-supplied company_id, force own company
        # (plus shared NULL-company defaults).
        company_id = user.company_id
    if company_id:
        q = q.filter(
            (PayslipTemplate.company_id == company_id)
            | (PayslipTemplate.company_id.is_(None))
        )
    return q.order_by(PayslipTemplate.is_default.desc(), PayslipTemplate.name).all()


@router.get("/default-layout")
def get_default_layout(_: User = Depends(get_current_user)):
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
    # NULL-company templates are shared defaults readable by all; company-owned
    # templates are only visible to their own tenant.
    if t.company_id is not None:
        assert_tenant(user, t.company_id)
    return t


@router.post("", response_model=PayslipTemplateResponse, status_code=201)
def create_template(
    payload: PayslipTemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    data = payload.model_dump()
    # Non-master may not re-parent a template into another company (mass-assignment).
    if user.role != "master":
        data["company_id"] = user.company_id

    if data.get("is_default"):
        # Unset other defaults in the same scope
        db.query(PayslipTemplate).filter(
            PayslipTemplate.company_id == data.get("company_id"),
            PayslipTemplate.is_default == True,
        ).update({"is_default": False})

    t = PayslipTemplate(
        **data,
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

    if user.role != "master":
        if t.company_id is None:
            # Shared default: readable by all, editable only by master.
            raise HTTPException(403, "Cannot modify a shared default template")
        assert_tenant(user, t.company_id)

    data = payload.model_dump(exclude_unset=True)
    # Never honour a client-supplied company_id/id (re-parenting / mass-assignment);
    # a non-master template stays pinned to its own company.
    data.pop("id", None)
    if user.role != "master":
        data.pop("company_id", None)

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
    if user.role != "master":
        if t.company_id is None:
            # Shared default: editable/deletable only by master.
            raise HTTPException(403, "Cannot delete a shared default template")
        assert_tenant(user, t.company_id)
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
    # Shared (NULL-company) templates are readable/duplicable by all; company-owned
    # ones only by their tenant.
    if src.company_id is not None:
        assert_tenant(user, src.company_id)

    # A non-master copy always lands in the caller's own company, never a foreign
    # company and never a shared (NULL) default.
    dup_company_id = user.company_id if user.role != "master" else src.company_id

    dup = PayslipTemplate(
        name=f"{src.name} (Copy)",
        description=src.description,
        company_id=dup_company_id,
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
