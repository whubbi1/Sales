# backend/app/services/reporting_query.py
# Executes a report spec against the real database. Every entity/column/operator/function
# name is checked against the REPORT_REGISTRY whitelist before it ever reaches a SQL
# string; only values are interpolated, and always as bound parameters. This is the single
# path both the manual report builder and the Claude-assisted drafting endpoint go through
# — nothing bypasses this validation, regardless of where the spec came from.
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.reporting_registry import REPORT_REGISTRY, FILTER_OPERATORS, AGGREGATE_FUNCTIONS


class ReportSpecError(ValueError):
    pass


def _validate_column(entity_cfg: dict, col: str):
    if col not in entity_cfg["columns"]:
        raise ReportSpecError(f"Unknown column '{col}' for this entity")


async def run_report_query(db: AsyncSession, spec: dict) -> list:
    entity = spec.get("entity")
    if entity not in REPORT_REGISTRY:
        raise ReportSpecError(f"Unknown entity '{entity}'")
    cfg = REPORT_REGISTRY[entity]
    table = cfg["table"]

    columns = spec.get("columns") or list(cfg["columns"].keys())[:5]
    for c in columns:
        _validate_column(cfg, c)

    group_by = spec.get("group_by") or []
    for c in group_by:
        _validate_column(cfg, c)

    aggregates = spec.get("aggregates") or []
    for agg in aggregates:
        if agg.get("function") not in AGGREGATE_FUNCTIONS:
            raise ReportSpecError(f"Unknown aggregate function '{agg.get('function')}'")
        _validate_column(cfg, agg["column"])

    filters = spec.get("filters") or []
    for f in filters:
        _validate_column(cfg, f["column"])
        if f.get("operator") not in FILTER_OPERATORS:
            raise ReportSpecError(f"Unknown filter operator '{f.get('operator')}'")

    sort = spec.get("sort")
    if sort and sort.get("column"):
        _validate_column(cfg, sort["column"])

    if group_by or aggregates:
        select_parts = [f'"{c}"' for c in group_by]
        for agg in aggregates:
            fn = agg["function"].upper()
            col = agg["column"]
            alias = f'{agg["function"]}_{col}'
            select_parts.append(f'{fn}("{col}") AS "{alias}"')
        if not select_parts:
            raise ReportSpecError("At least one column or aggregate is required")
    else:
        select_parts = [f'"{c}"' for c in columns]

    sql = f'SELECT {", ".join(select_parts)} FROM {table}'
    params = {}

    where_clauses = []
    for i, f in enumerate(filters):
        col = f["column"]
        op = f["operator"]
        key = f"filter_{i}"
        if op == 'is_null':
            where_clauses.append(f'"{col}" IS NULL')
        elif op == 'is_not_null':
            where_clauses.append(f'"{col}" IS NOT NULL')
        elif op == 'contains':
            where_clauses.append(f'"{col}"::text ILIKE :{key}')
            params[key] = f'%{f.get("value")}%'
        elif op == 'in':
            values = f.get("value") if isinstance(f.get("value"), list) else [f.get("value")]
            in_keys = []
            for j, v in enumerate(values):
                k2 = f'{key}_{j}'
                in_keys.append(f':{k2}')
                params[k2] = v
            where_clauses.append(f'"{col}" IN ({", ".join(in_keys)})')
        else:
            where_clauses.append(f'"{col}" {op} :{key}')
            params[key] = f.get("value")
    if where_clauses:
        sql += " WHERE " + " AND ".join(where_clauses)

    if group_by:
        sql += " GROUP BY " + ", ".join(f'"{c}"' for c in group_by)

    if sort and sort.get("column"):
        direction = "DESC" if sort.get("dir") == "desc" else "ASC"
        sql += f' ORDER BY "{sort["column"]}" {direction}'
    elif not (group_by or aggregates):
        sql += " ORDER BY 1"

    try:
        limit = min(int(spec.get("limit") or 500), 2000)
    except (TypeError, ValueError):
        raise ReportSpecError("limit must be a number")
    sql += f" LIMIT {limit}"

    result = await db.execute(text(sql), params)
    return [dict(r) for r in result.mappings().all()]
