"""Validation layer — check a student has every required field for a university
BEFORE running the automation. (Phase 3 — logic to be expanded.)"""


def find_missing_fields(student: dict, required_fields: list[dict], documents: dict[str, dict] | None = None) -> list[str]:
    """
    required_fields: list of {"name": str, "required": bool, "type": str} from `university_fields`.
    documents: {doc_type: {...}} from db.get_documents() — checked instead of `student`
    for fields with type == "file", since uploads never live in the student data bag.
    Returns the names of required fields the student is missing/blank.
    """
    documents = documents or {}
    missing = []
    for field in required_fields:
        if not field.get("required"):
            continue
        if field.get("type") == "file":
            if field["name"] not in documents:
                missing.append(field["name"])
            continue
        value = student.get(field["name"])
        if value is None or str(value).strip() == "":
            missing.append(field["name"])
    return missing
