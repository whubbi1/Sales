# backend/app/routers/projects.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, text
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.database import get_db
from app.models.project import (
    Project, ProjectComment, ProjectDocument, ProjectActivityLog, ProjectExpense,
    ProjectStaffingTask, ProjectStaffingAllocation, ProjectStaffingRole,
)
from app.models.timesheet import TimesheetEntry
from app.models.opportunity import Opportunity
from app.models.company import Company
from app.models.rfp import rfp_opportunity, RFPStaffingTask, RFPStaffingRole
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectCommentCreate, ProjectCommentResponse,
    ProjectDocumentCreate, ProjectDocumentResponse,
    ProjectExpenseCreate, ProjectExpenseResponse,
    ProjectActivityLogResponse,
    ProjectStaffingTaskCreate, ProjectStaffingTaskUpdate, ProjectStaffingTaskResponse,
    ProjectStaffingAllocationsSet,
    ProjectStaffingRoleCreate, ProjectStaffingRoleUpdate, ProjectStaffingRoleResponse,
    PartnerSummary,
)
from app.services.ids import next_internal_id

router = APIRouter()


async def _attach_related(db: AsyncSession, projects: list):
    # Project doesn't declare ORM relationships to Opportunity/Company/Partner (same reasoning
    # as _attach_partners in opportunities.py) — resolved manually and attached as plain
    # instance attributes so ProjectResponse's from_attributes picks them up.
    opp_ids = {p.opportunity_id for p in projects if p.opportunity_id}
    opps = {}
    if opp_ids:
        r = await db.execute(select(Opportunity).where(Opportunity.id.in_(opp_ids)))
        opps = {o.id: o for o in r.scalars().all()}

    company_ids = {o.company_id for o in opps.values() if o.company_id}
    companies = {}
    if company_ids:
        r = await db.execute(select(Company).where(Company.id.in_(company_ids)))
        companies = {c.id: c for c in r.scalars().all()}

    partner_ids = {str(p.partner_id) for p in projects if p.partner_id}
    partners = {}
    for pid in partner_ids:
        r = await db.execute(text("SELECT id, internal_id, name, status FROM partners WHERE id = CAST(:id AS UUID)"), {"id": pid})
        row = r.fetchone()
        if row:
            partners[pid] = PartnerSummary(id=row.id, internal_id=row.internal_id, name=row.name, status=row.status)

    for p in projects:
        opp = opps.get(p.opportunity_id) if p.opportunity_id else None
        p.opportunity = opp
        p.company = companies.get(opp.company_id) if opp and opp.company_id else None
        p.partner = partners.get(str(p.partner_id)) if p.partner_id else None


async def _log_change(db: AsyncSession, project_id, field_name: str, old_value, new_value, email, name):
    if old_value == new_value:
        return
    db.add(ProjectActivityLog(
        project_id=project_id, field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        changed_by_email=email, changed_by_name=name,
    ))


async def _maybe_create_project(db: AsyncSession, opp: Opportunity):
    # Fires once per opportunity — the moment its status is (or becomes) Contract Won,
    # mirroring _maybe_create_rfp in opportunities.py. Software Licenses deals get a Project
    # too (tracked via the license_* fields on Project), just without the RFP-staffing-copy
    # step below, which only makes sense for Daily Invoicing/Project delivery engagements.
    if opp.deal_status != 'Contract Won':
        return None
    if opp.project_status not in ('Daily Invoicing', 'Project', 'Software Licenses'):
        return None
    existing = await db.execute(select(Project.id).where(Project.opportunity_id == opp.id))
    if existing.first():
        return None

    project_number = await next_internal_id(db, 'project_number_seq', 'PRJ')
    proj = Project(
        project_number=project_number,
        is_internal=False,
        opportunity_id=opp.id,
        partner_id=opp.partner_id,
        project_name=opp.project_name or opp.deal_name,
    )
    db.add(proj)
    await db.flush()

    if opp.project_status == 'Software Licenses':
        await db.commit()
        await db.refresh(proj)
        return proj

    r = await db.execute(select(rfp_opportunity.c.rfp_id).where(rfp_opportunity.c.opportunity_id == opp.id))
    rfp_id = r.scalar_one_or_none()
    if rfp_id:
        r_roles = await db.execute(select(RFPStaffingRole).where(RFPStaffingRole.rfp_id == rfp_id))
        rfp_roles = r_roles.scalars().all()
        # Roles are copied into both plan_type buckets, same as tasks — Initial stays a
        # frozen baseline while Current can be edited independently from here on.
        role_id_map = {'initial': {}, 'current': {}}
        for role in rfp_roles:
            for plan_type in ('initial', 'current'):
                new_role = ProjectStaffingRole(
                    project_id=proj.id, plan_type=plan_type, name=role.name,
                    resource_email=role.resource_email, resource_name=role.resource_name,
                )
                db.add(new_role)
                await db.flush()
                role_id_map[plan_type][role.id] = new_role.id

        r2 = await db.execute(
            select(RFPStaffingTask).options(selectinload(RFPStaffingTask.allocations))
            .where(RFPStaffingTask.rfp_id == rfp_id)
        )
        for task in r2.scalars().all():
            for plan_type in ('initial', 'current'):
                new_task = ProjectStaffingTask(
                    project_id=proj.id, plan_type=plan_type, title=task.title,
                    role_id=role_id_map[plan_type].get(task.role_id),
                    position=task.position,
                )
                new_task.allocations = [
                    ProjectStaffingAllocation(period_start=a.period_start, period_type=a.period_type, days=a.days)
                    for a in task.allocations
                ]
                db.add(new_task)

    await db.commit()
    await db.refresh(proj)
    return proj


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    skip: int = 0, limit: int = 500, search: str = None, is_internal: bool = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Project)
    if is_internal is not None:
        query = query.where(Project.is_internal == is_internal)
    if search:
        query = query.where(or_(
            Project.project_name.ilike(f"%{search}%"),
            Project.project_number.ilike(f"%{search}%"),
        ))
    query = query.offset(skip).limit(limit).order_by(Project.created_at.desc())
    r = await db.execute(query)
    projects = r.scalars().all()
    await _attach_related(db, projects)
    return projects


@router.post("/internal", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_internal_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project_number = await next_internal_id(db, 'project_number_seq', 'PRJ')
    proj = Project(
        project_number=project_number,
        is_internal=True,
        partner_id=data.partner_id,
        project_name=data.project_name,
        description=data.description,
        start_date=data.start_date,
        end_date=data.end_date,
    )
    db.add(proj)
    await db.commit()
    await db.refresh(proj)
    await _attach_related(db, [proj])
    return proj


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Project).where(Project.id == project_id))
    proj = r.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    await _attach_related(db, [proj])
    return proj


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: UUID, data: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Project).where(Project.id == project_id))
    proj = r.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = data.model_dump(exclude={'changed_by_email', 'changed_by_name'}, exclude_unset=True)
    for k, v in update_data.items():
        old_value = getattr(proj, k)
        if old_value != v:
            await _log_change(db, proj.id, k, old_value, v, data.changed_by_email, data.changed_by_name)
            setattr(proj, k, v)

    await db.commit()
    await db.refresh(proj)
    await _attach_related(db, [proj])
    return proj


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Project).where(Project.id == project_id))
    proj = r.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(proj)
    await db.commit()


# ─── Activity log ───────────────────────────────────────────────────────────────
@router.get("/{project_id}/activity-log", response_model=List[ProjectActivityLogResponse])
async def list_activity_log(project_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectActivityLog).where(ProjectActivityLog.project_id == project_id).order_by(ProjectActivityLog.changed_at.desc()))
    return r.scalars().all()


# ─── Comments ───────────────────────────────────────────────────────────────────
@router.get("/{project_id}/comments/", response_model=List[ProjectCommentResponse])
async def list_project_comments(project_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectComment).where(ProjectComment.project_id == project_id).order_by(ProjectComment.created_at.desc()))
    return r.scalars().all()

@router.post("/{project_id}/comments/", response_model=ProjectCommentResponse, status_code=status.HTTP_201_CREATED)
async def add_project_comment(project_id: UUID, data: ProjectCommentCreate, db: AsyncSession = Depends(get_db)):
    row = ProjectComment(project_id=project_id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/{project_id}/comments/{comment_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_comment(project_id: UUID, comment_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectComment).where(ProjectComment.id == comment_id, ProjectComment.project_id == project_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Comment not found")
    await db.delete(row)
    await db.commit()


# ─── Expenses ───────────────────────────────────────────────────────────────────
@router.get("/{project_id}/expenses/", response_model=List[ProjectExpenseResponse])
async def list_project_expenses(project_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectExpense).where(ProjectExpense.project_id == project_id).order_by(ProjectExpense.expense_date.desc()))
    return r.scalars().all()

@router.post("/{project_id}/expenses/", response_model=ProjectExpenseResponse, status_code=status.HTTP_201_CREATED)
async def add_project_expense(project_id: UUID, data: ProjectExpenseCreate, db: AsyncSession = Depends(get_db)):
    row = ProjectExpense(project_id=project_id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/{project_id}/expenses/{expense_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_expense(project_id: UUID, expense_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectExpense).where(ProjectExpense.id == expense_id, ProjectExpense.project_id == project_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    await db.delete(row)
    await db.commit()


# ─── Documents (sales vs project) ───────────────────────────────────────────────
@router.get("/{project_id}/documents/", response_model=List[ProjectDocumentResponse])
async def list_project_documents(project_id: UUID, category: str = None, db: AsyncSession = Depends(get_db)):
    q = select(ProjectDocument).where(ProjectDocument.project_id == project_id)
    if category:
        q = q.where(ProjectDocument.category == category)
    q = q.order_by(ProjectDocument.created_at.desc())
    r = await db.execute(q)
    return r.scalars().all()

@router.post("/{project_id}/documents/", response_model=ProjectDocumentResponse, status_code=status.HTTP_201_CREATED)
async def add_project_document(project_id: UUID, data: ProjectDocumentCreate, db: AsyncSession = Depends(get_db)):
    row = ProjectDocument(project_id=project_id, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/{project_id}/documents/{document_id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_document(project_id: UUID, document_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectDocument).where(ProjectDocument.id == document_id, ProjectDocument.project_id == project_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(row)
    await db.commit()


# ─── Staffing Roles (one assigned resource each; a resource can hold several roles) ────
# Scoped per plan_type, same as tasks — Initial keeps its own frozen role set separate
# from Current's, which can be freely edited from here on.
@router.get("/{project_id}/staffing-roles", response_model=List[ProjectStaffingRoleResponse])
async def list_project_staffing_roles(project_id: UUID, plan_type: str = None, db: AsyncSession = Depends(get_db)):
    q = select(ProjectStaffingRole).where(ProjectStaffingRole.project_id == project_id)
    if plan_type:
        q = q.where(ProjectStaffingRole.plan_type == plan_type)
    q = q.order_by(ProjectStaffingRole.created_at)
    r = await db.execute(q)
    return r.scalars().all()


@router.post("/{project_id}/staffing-roles", response_model=ProjectStaffingRoleResponse, status_code=status.HTTP_201_CREATED)
async def create_project_staffing_role(project_id: UUID, data: ProjectStaffingRoleCreate, db: AsyncSession = Depends(get_db)):
    if data.plan_type == 'initial':
        raise HTTPException(status_code=400, detail="The initial plan is a frozen baseline and cannot be added to directly.")
    role = ProjectStaffingRole(project_id=project_id, **data.model_dump())
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


@router.put("/{project_id}/staffing-roles/{role_id}", response_model=ProjectStaffingRoleResponse)
async def update_project_staffing_role(project_id: UUID, role_id: UUID, data: ProjectStaffingRoleUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectStaffingRole).where(ProjectStaffingRole.id == role_id, ProjectStaffingRole.project_id == project_id))
    role = r.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.plan_type == 'initial':
        raise HTTPException(status_code=400, detail="The initial plan is a frozen baseline and cannot be edited.")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(role, k, v)
    await db.commit()
    await db.refresh(role)
    return role


@router.delete("/{project_id}/staffing-roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_staffing_role(project_id: UUID, role_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectStaffingRole).where(ProjectStaffingRole.id == role_id, ProjectStaffingRole.project_id == project_id))
    role = r.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.plan_type == 'initial':
        raise HTTPException(status_code=400, detail="The initial plan is a frozen baseline and cannot be deleted from.")
    await db.delete(role)
    await db.commit()


# ─── Staffing plan (Initial frozen baseline + Current editable) ────────────────
@router.get("/{project_id}/staffing", response_model=List[ProjectStaffingTaskResponse])
async def list_project_staffing(project_id: UUID, plan_type: str = None, db: AsyncSession = Depends(get_db)):
    q = select(ProjectStaffingTask).options(selectinload(ProjectStaffingTask.allocations), selectinload(ProjectStaffingTask.role)).where(ProjectStaffingTask.project_id == project_id)
    if plan_type:
        q = q.where(ProjectStaffingTask.plan_type == plan_type)
    q = q.order_by(ProjectStaffingTask.plan_type, ProjectStaffingTask.position, ProjectStaffingTask.created_at)
    r = await db.execute(q)
    return r.scalars().all()

@router.post("/{project_id}/staffing", response_model=ProjectStaffingTaskResponse, status_code=status.HTTP_201_CREATED)
async def add_project_staffing(project_id: UUID, data: ProjectStaffingTaskCreate, db: AsyncSession = Depends(get_db)):
    if data.plan_type == 'initial':
        raise HTTPException(status_code=400, detail="The initial plan is a frozen baseline and cannot be added to directly.")
    row = ProjectStaffingTask(project_id=project_id, **data.model_dump())
    db.add(row)
    await db.commit()
    # Re-query with an eager load rather than db.refresh() — refresh() re-expires
    # relationships, and AsyncSession can't lazy-load them during response serialization
    # (which runs after the handler returns, outside the active DB context).
    r = await db.execute(select(ProjectStaffingTask).options(selectinload(ProjectStaffingTask.allocations), selectinload(ProjectStaffingTask.role)).where(ProjectStaffingTask.id == row.id))
    return r.scalar_one()

@router.put("/{project_id}/staffing/{task_id}", response_model=ProjectStaffingTaskResponse)
async def update_project_staffing(project_id: UUID, task_id: UUID, data: ProjectStaffingTaskUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectStaffingTask).options(selectinload(ProjectStaffingTask.allocations), selectinload(ProjectStaffingTask.role))
                          .where(ProjectStaffingTask.id == task_id, ProjectStaffingTask.project_id == project_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Staffing task not found")
    if row.plan_type == 'initial':
        raise HTTPException(status_code=400, detail="The initial plan is a frozen baseline and cannot be edited.")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    await db.commit()
    # db.refresh() would re-expire the allocations relationship loaded above, and
    # AsyncSession can't lazy-load it during response serialization — re-query instead.
    r = await db.execute(select(ProjectStaffingTask).options(selectinload(ProjectStaffingTask.allocations), selectinload(ProjectStaffingTask.role)).where(ProjectStaffingTask.id == task_id))
    return r.scalar_one()

@router.delete("/{project_id}/staffing/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_staffing(project_id: UUID, task_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectStaffingTask).where(ProjectStaffingTask.id == task_id, ProjectStaffingTask.project_id == project_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Staffing task not found")
    if row.plan_type == 'initial':
        raise HTTPException(status_code=400, detail="The initial plan is a frozen baseline and cannot be deleted from.")
    await db.delete(row)
    await db.commit()

@router.put("/{project_id}/staffing/{task_id}/allocations", response_model=ProjectStaffingTaskResponse)
async def set_project_staffing_allocations(project_id: UUID, task_id: UUID, data: ProjectStaffingAllocationsSet, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectStaffingTask).options(selectinload(ProjectStaffingTask.allocations), selectinload(ProjectStaffingTask.role))
                          .where(ProjectStaffingTask.id == task_id, ProjectStaffingTask.project_id == project_id))
    row = r.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Staffing task not found")
    if row.plan_type == 'initial':
        raise HTTPException(status_code=400, detail="The initial plan is a frozen baseline and cannot be edited.")
    row.allocations = [ProjectStaffingAllocation(period_start=a.period_start, period_type=a.period_type, days=a.days) for a in data.allocations]
    await db.commit()
    r = await db.execute(select(ProjectStaffingTask).options(selectinload(ProjectStaffingTask.allocations), selectinload(ProjectStaffingTask.role)).where(ProjectStaffingTask.id == task_id))
    return r.scalar_one()


# ─── Actuals (rolled up live from timesheet entries, converting hours -> days) ──
@router.get("/{project_id}/staffing/actuals")
async def get_staffing_actuals(project_id: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(TimesheetEntry).where(TimesheetEntry.project_id == project_id))
    entries = r.scalars().all()
    by_resource = {}
    for e in entries:
        days = e.amount if e.unit == 'days' else e.amount / 8.0
        month_key = e.entry_date.strftime('%Y-%m-01')
        bucket = by_resource.setdefault(e.user_email, {"resource_email": e.user_email, "resource_name": e.user_name, "months": {}})
        bucket["months"][month_key] = bucket["months"].get(month_key, 0) + days
    return [
        {**v, "months": [{"month": m, "days": d} for m, d in sorted(v["months"].items())]}
        for v in by_resource.values()
    ]
