"""Validation layer — check a student has every required field for a university
BEFORE running the automation. (Phase 3 — logic to be expanded.)"""


def find_missing_fields(student: dict, required_fields: list[dict]) -> list[str]:
    """
    required_fields: list of {"name": str, "required": bool} from `university_fields`.
    Returns the names of required fields the student is missing/blank.
    """
    missing = []
    for field in required_fields:
        if not field.get("required"):
            continue
        value = student.get(field["name"])
        if value is None or str(value).strip() == "":
            missing.append(field["name"])
    return missing
