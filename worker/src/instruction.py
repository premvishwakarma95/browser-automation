"""Builds the natural-language task handed to the browser agent.

The golden rule is baked in: the agent NEVER submits, pays, or solves a
CAPTCHA/OTP. It fills the form, saves a draft, and hands back to a human.
"""


def build_instruction(student: dict, university: dict, document_paths: dict[str, str] | None = None) -> str:
    fields = "\n".join(f"- {k}: {v}" for k, v in student.items() if v)
    hints = "\n".join(f"- {h}" for h in university.get("notes", [])) or "- (none)"

    field_labels = {f["field_name"]: f.get("label") or f["field_name"] for f in university.get("fields", [])}
    if document_paths:
        docs = "\n".join(
            f"- {field_labels.get(name, name)}: {path}" for name, path in document_paths.items()
        )
    else:
        docs = "- (none available for this run)"

    return f"""ROLE: You are registering a student on an Italian university admission portal.
Fill the form accurately. DO NOT submit — save it as a draft and hand back to a human.

PORTAL: {university.get('portal_url', '')}
UNIVERSITY: {university.get('name', '')}
PLATFORM: {university.get('platform', '')}

PORTAL-SPECIFIC HINTS:
{hints}

STUDENT DATA:
{fields}

DOCUMENTS AVAILABLE TO UPLOAD (local file paths on this machine):
{docs}

TASK STEPS:
1. Open the portal URL and log in (credentials are provided by the runner).
2. Navigate to the admission/application section for the student's program.
3. Fill every required field from STUDENT DATA. Match labels carefully.
4. For any file-upload field, use the exact local path listed under DOCUMENTS
   AVAILABLE TO UPLOAD whose label matches that field. If a required document
   isn't listed there, STOP and report MISSING_FIELD: <field name>.
5. When the form is complete, SAVE AS DRAFT. Do NOT click final submit or pay.
6. Take a screenshot and list every field you filled with its value.
7. Report status: READY_FOR_REVIEW.

RULES (non-negotiable):
- Never submit, never pay, never solve a CAPTCHA/OTP yourself.
- If a CAPTCHA / OTP / payment appears -> STOP and report NEEDS_HUMAN.
- If a required field has no matching student data -> STOP and report MISSING_FIELD: <name>.
- If the page looks unexpected -> describe what you see and ask before acting.

STOPPING CRITERIA (read carefully — this is what "done" means for this task):
- As soon as the draft is saved and you've reported READY_FOR_REVIEW, call the
  `done` action immediately. One check is enough to confirm the draft saved —
  do not re-verify repeatedly or keep exploring the portal afterward.
- Do not take any action that wasn't asked for above.
"""
