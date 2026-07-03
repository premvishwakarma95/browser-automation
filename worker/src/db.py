"""Supabase access for the worker.

Reads NOT_STARTED jobs, claims them, writes status/drafts/screenshots back,
and creates pending_actions for the human-in-the-loop queue.
Uses the service-role key (bypasses RLS).
"""

from datetime import datetime, timezone
from .config import config

_client = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_client():
    """Create (once) the Supabase client."""
    global _client
    if _client is None:
        from supabase import create_client
        if not config.supabase_url or not config.supabase_service_key:
            raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env")
        _client = create_client(config.supabase_url, config.supabase_service_key)
    return _client


def claim_next_job():
    """Grab the oldest NOT_STARTED application and mark it IN_PROGRESS.

    The `.eq('status','NOT_STARTED')` on the UPDATE makes the claim safe against a
    second worker racing for the same row (only one update will match).
    """
    sb = get_client()
    found = (
        sb.table("applications")
        .select("*")
        .eq("status", "NOT_STARTED")
        .order("created_at")
        .limit(1)
        .execute()
    )
    if not found.data:
        return None
    job = found.data[0]
    claimed = (
        sb.table("applications")
        .update({"status": "IN_PROGRESS", "started_at": now_iso(), "attempts": job.get("attempts", 0) + 1})
        .eq("id", job["id"])
        .eq("status", "NOT_STARTED")
        .execute()
    )
    return claimed.data[0] if claimed.data else None


def get_student(student_id: str) -> dict | None:
    sb = get_client()
    res = sb.table("students").select("*").eq("id", student_id).limit(1).execute()
    return res.data[0] if res.data else None


def get_university(university_id: str) -> dict | None:
    """University row + its required fields (attached as `fields`)."""
    sb = get_client()
    uni = sb.table("universities").select("*").eq("id", university_id).limit(1).execute()
    if not uni.data:
        return None
    university = uni.data[0]
    fields = (
        sb.table("university_fields")
        .select("field_name,label,field_type,required,mapping_hint,sort_order")
        .eq("university_id", university_id)
        .order("sort_order")
        .execute()
    )
    university["fields"] = fields.data or []
    return university


def update_application(application_id: str, **patch):
    sb = get_client()
    return sb.table("applications").update(patch).eq("id", application_id).execute()


def create_pending_action(application_id: str, kind: str, payload: dict | None = None):
    sb = get_client()
    return sb.table("pending_actions").insert({
        "application_id": application_id,
        "kind": kind,
        "status": "open",
        "payload": payload or {},
    }).execute()
