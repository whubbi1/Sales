# Patch for helpdesk.py - update_ticket to trigger Teams chat on assignment
# Replace the update_ticket function in helpdesk.py with this version

async def update_ticket_with_teams(tid: str, data: dict, db):
    """Updated update_ticket that creates Teams chat when ticket is assigned."""
    from app.routers.helpdesk_teams import create_teams_chat

    # Get current ticket state
    current = await db.execute(text("""
        SELECT t.*, c.name as category_name, t.teams_chat_id
        FROM tickets t
        LEFT JOIN ticket_categories c ON t.category_id = c.id
        WHERE t.id = CAST(:id AS UUID)
    """), {"id": tid})
    ticket = current.fetchone()
    if not ticket:
        return {"status": "error", "message": "Ticket not found"}

    old_assignee = ticket.assignee_email or ""
    new_assignee  = data.get("assignee_email", old_assignee)

    # Update ticket
    await db.execute(text("""
        UPDATE tickets SET
            status         = COALESCE(NULLIF(:status,''), status),
            priority       = COALESCE(NULLIF(:priority,''), priority),
            assignee_email = COALESCE(NULLIF(:assignee_email,''), assignee_email),
            assignee_name  = COALESCE(NULLIF(:assignee_name,''), assignee_name),
            group_id       = CASE WHEN :group_id = '' THEN group_id ELSE CAST(:group_id AS UUID) END,
            resolution     = COALESCE(NULLIF(:resolution,''), resolution),
            resolved_at    = CASE WHEN :status IN ('resolved','closed') AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
            updated_at     = NOW()
        WHERE id = CAST(:id AS UUID)
    """), {**{k: v or '' for k, v in data.items()}, "id": tid, "group_id": data.get("group_id", "")})
    await db.commit()

    # If assignee changed and we have both requester and assignee → create/update Teams chat
    if new_assignee and new_assignee != old_assignee:
        result = await create_teams_chat(
            ticket_id=tid,
            ticket_number=ticket.ticket_number,
            ticket_title=ticket.title,
            ticket_description=ticket.description or "",
            category_name=ticket.category_name or "",
            requester_email=ticket.requester_email,
            assignee_email=new_assignee,
            db=db
        )
        return {"status": "ok", "teams": result}

    return {"status": "ok"}
