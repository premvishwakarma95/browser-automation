"""Processes one claimed job through the flow:

  validate → run agent (fill + save draft) → write status back → queue human review

Status transitions (guarded conceptually by models.Status / ALLOWED):
  NOT_STARTED → IN_PROGRESS → READY_FOR_REVIEW   (happy path, awaits human)
                            → MISSING_DATA        (student incomplete)
                            → FAILED              (error)
"""

from .config import config
from .models import Status
from .validation import find_missing_fields
from .instruction import build_instruction
from .documents import download_required_documents, cleanup as cleanup_documents
from . import db


# Core identity columns we expose to the agent, merged with the `data` jsonb bag.
_CORE_FIELDS = (
    "full_name", "email", "phone", "date_of_birth", "nationality",
    "passport_number", "program", "intake_year",
)


def student_values(student: dict) -> dict:
    """Flatten a student row (core columns + `data` jsonb) into one dict."""
    values = {k: student.get(k) for k in _CORE_FIELDS if student.get(k) not in (None, "")}
    values.update(student.get("data") or {})
    return values


def _required_as_pairs(university: dict) -> list[dict]:
    """Adapt university_fields → the shape find_missing_fields expects."""
    return [{"name": f["field_name"], "required": f.get("required", True), "type": f.get("field_type", "text")}
            for f in university.get("fields", [])]


async def process_job(job: dict) -> str:
    """Run one application job. Returns the final status string."""
    student = db.get_student(job["student_id"])
    university = db.get_university(job["university_id"])
    if not student or not university:
        db.update_application(job["id"], status=Status.FAILED.value,
                              error="student or university not found",
                              completed_at=db.now_iso())
        return Status.FAILED.value

    values = student_values(student)
    documents = db.get_documents(job["student_id"])

    # 1) Validate BEFORE automating — file-type fields are checked against
    # `documents`, everything else against the student data bag.
    missing = find_missing_fields(values, _required_as_pairs(university), documents)
    if missing:
        db.update_application(job["id"], status=Status.MISSING_DATA.value,
                              missing_fields=missing, completed_at=db.now_iso())
        return Status.MISSING_DATA.value

    # 2) Pull this student's matched documents down to local paths the agent
    # can actually hand to a file-upload input (it needs a real path, not a
    # Storage URL). Guaranteed cleanup below regardless of outcome.
    document_paths, temp_dir = download_required_documents(university.get("fields", []), documents)
    try:
        # 3) Fill the form (real agent, or a canned draft in MOCK mode).
        try:
            if config.mock_agent:
                result = _mock_fill(values, university)
            else:
                from .agent_runner import run_agent
                result = await run_agent(values, university, document_paths)

            filled = result.get("filled_fields") or [
                {"label": k, "value": v} for k, v in values.items()
            ]
            db.update_application(
                job["id"],
                status=Status.READY_FOR_REVIEW.value,
                filled_fields=filled,
                screenshot_path=result.get("screenshot_path"),
                agent_log=result.get("log", []),
                draft_saved=True,
                completed_at=db.now_iso(),
            )
            # 4) Queue the human review (approve → pay & submit).
            db.create_pending_action(job["id"], "REVIEW_DRAFT",
                                     {"filled_fields": filled})
            return Status.READY_FOR_REVIEW.value

        except Exception as e:  # noqa: BLE001
            db.update_application(job["id"], status=Status.FAILED.value,
                                  error=str(e), completed_at=db.now_iso())
            return Status.FAILED.value
    finally:
        cleanup_documents(temp_dir)


def _mock_fill(values: dict, university: dict) -> dict:
    """Canned 'draft' used when MOCK_AGENT=true (no browser)."""
    return {
        "filled_fields": [{"label": k, "value": v} for k, v in values.items()],
        "screenshot_path": None,
        "log": [f"[mock] opened {university.get('portal_url')}",
                "[mock] filled fields", "[mock] saved draft, paused before submit"],
    }
