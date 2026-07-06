# backend/app/services/ids.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def next_internal_id(db: AsyncSession, sequence_name: str, prefix: str) -> str:
    r = await db.execute(text(f"SELECT nextval('{sequence_name}')"))
    n = r.scalar()
    return f"{prefix}-{n:05d}"


def compute_deal_name(closing_date, company_name: str = None, partner_name: str = None, project_name: str = None) -> str:
    if closing_date:
        quarter = (closing_date.month - 1) // 3 + 1
        quarter_label = f"Q{quarter}{closing_date.strftime('%y')}"
    else:
        quarter_label = "TBD"

    segments = [quarter_label, company_name, partner_name, project_name]
    return " - ".join(s for s in segments if s)
