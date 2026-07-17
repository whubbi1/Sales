# backend/app/services/reporting_registry.py
# Whitelisted, reportable slice of the WHUBBI data model — used by both the manual report
# builder and the Claude-assisted drafting endpoint. A report spec is only ever executed
# after every entity/column/filter/aggregate name in it is checked against this registry;
# nothing from a report spec is ever interpolated into SQL without that check passing.
# Values are always bound as parameters, never interpolated as text.

REPORT_REGISTRY = {
    "companies": {
        "label": "Companies",
        "table": "companies",
        "columns": {
            "internal_id": {"label": "Internal ID", "type": "text"},
            "name": {"label": "Name", "type": "text"},
            "status": {"label": "Status", "type": "text"},
            "level": {"label": "Level", "type": "number"},
            "sector": {"label": "Sector", "type": "text"},
            "country": {"label": "Country", "type": "text"},
            "created_at": {"label": "Created At", "type": "date"},
        },
    },
    "contacts": {
        "label": "Contacts",
        "table": "contacts",
        "columns": {
            "internal_id": {"label": "Internal ID", "type": "text"},
            "first_name": {"label": "First Name", "type": "text"},
            "last_name": {"label": "Last Name", "type": "text"},
            "email": {"label": "Email", "type": "text"},
            "job_type": {"label": "Job Type", "type": "text"},
            "lead_status": {"label": "Lead Status", "type": "text"},
            "assigned_to": {"label": "Owner", "type": "text"},
            "created_at": {"label": "Created At", "type": "date"},
        },
    },
    "partners": {
        "label": "Partners",
        "table": "partners",
        "columns": {
            "name": {"label": "Name", "type": "text"},
            "status": {"label": "Status", "type": "text"},
            "sector": {"label": "Sector", "type": "text"},
            "country": {"label": "Country", "type": "text"},
            "assigned_to": {"label": "Owner", "type": "text"},
            "created_at": {"label": "Created At", "type": "date"},
        },
    },
    "leads": {
        "label": "Leads",
        "table": "leads",
        "columns": {
            "lead_number": {"label": "Lead ID", "type": "text"},
            "title": {"label": "Title", "type": "text"},
            "origin": {"label": "Origin", "type": "text"},
            "status": {"label": "Status", "type": "text"},
            "start_date": {"label": "Start Date", "type": "date"},
            "end_date": {"label": "End Date", "type": "date"},
            "assigned_to": {"label": "Owner", "type": "text"},
            "created_at": {"label": "Created At", "type": "date"},
        },
    },
    "opportunities": {
        "label": "Opportunities",
        "table": "opportunities",
        "columns": {
            "deal_id": {"label": "Deal ID", "type": "text"},
            "deal_name": {"label": "Name", "type": "text"},
            "deal_amount": {"label": "Amount", "type": "number"},
            "deal_status": {"label": "Status", "type": "text"},
            "deal_type": {"label": "Deal Type", "type": "text"},
            "project_status": {"label": "Project Type", "type": "text"},
            "closing_date": {"label": "Closing Date", "type": "date"},
            "contract_start_date": {"label": "Contract Start", "type": "date"},
            "contract_end_date": {"label": "Contract End", "type": "date"},
            "assigned_to": {"label": "Owner", "type": "text"},
            "created_at": {"label": "Created At", "type": "date"},
        },
    },
    "rfps": {
        "label": "RFPs",
        "table": "rfps",
        "columns": {
            "reference": {"label": "Reference", "type": "text"},
            "name": {"label": "Name", "type": "text"},
            "status": {"label": "Status", "type": "text"},
            "owner": {"label": "Owner", "type": "text"},
            "created_at": {"label": "Created At", "type": "date"},
        },
    },
    "projects": {
        "label": "Projects",
        "table": "projects",
        "columns": {
            "project_number": {"label": "Project ID", "type": "text"},
            "project_name": {"label": "Name", "type": "text"},
            "is_internal": {"label": "Internal?", "type": "boolean"},
            "start_date": {"label": "Start Date", "type": "date"},
            "end_date": {"label": "End Date", "type": "date"},
            "created_at": {"label": "Created At", "type": "date"},
        },
    },
    "tasks": {
        "label": "Tasks",
        "table": "tasks",
        "columns": {
            "title": {"label": "Title", "type": "text"},
            "status": {"label": "Status", "type": "text"},
            "source": {"label": "Source", "type": "text"},
            "entity_type": {"label": "Linked To", "type": "text"},
            "owner_email": {"label": "Owner", "type": "text"},
            "assignee_email": {"label": "Assignee", "type": "text"},
            "due_date": {"label": "Due Date", "type": "date"},
            "created_at": {"label": "Created At", "type": "date"},
        },
    },
    "timesheet_entries": {
        "label": "Timesheet Entries",
        "table": "timesheet_entries",
        "columns": {
            "user_email": {"label": "User", "type": "text"},
            "unit": {"label": "Unit", "type": "text"},
            "amount": {"label": "Amount", "type": "number"},
            "entry_date": {"label": "Entry Date", "type": "date"},
            "created_at": {"label": "Created At", "type": "date"},
        },
    },
}

FILTER_OPERATORS = {'=', '!=', '>', '<', '>=', '<=', 'contains', 'in', 'is_null', 'is_not_null'}
AGGREGATE_FUNCTIONS = {'count', 'sum', 'avg', 'min', 'max'}
CHART_TYPES = {'table', 'bar', 'line', 'pie'}


def registry_for_frontend():
    # Shape consumed by the report builder UI — entity key, label, and its columns.
    return [
        {"entity": key, "label": cfg["label"], "columns": [
            {"key": col, "label": meta["label"], "type": meta["type"]} for col, meta in cfg["columns"].items()
        ]}
        for key, cfg in REPORT_REGISTRY.items()
    ]
