"""Resolves a university's `file`-type fields to a specific student's uploaded
documents, and downloads them to local paths the browser agent can upload.

A university field with field_type == "file" has its field_name constrained
(in the admin form-builder) to one of the same document-type keys used when a
student uploads documents — passport, transcript, english_test, sop, cv,
photo. So matching a required file field to an actual document is a plain
dict lookup by that shared key, no fuzzy name matching needed.

The agent needs a real local file path to hand to a <input type=file> upload,
not a Storage URL — so we download each matched document to a temp dir before
the run, and the caller (process.py) removes that dir when the job finishes.
"""

import shutil
import tempfile
from pathlib import Path

from . import db


def download_required_documents(university_fields: list[dict], documents: dict[str, dict]) -> tuple[dict[str, str], str]:
    """Download each matched file-type field's document to a local temp dir.

    Returns ({field_name: local_file_path}, temp_dir). temp_dir is "" if there
    were no file-type fields — caller should still always call cleanup(), it's
    a no-op on an empty string.
    """
    file_fields = [f for f in university_fields if f.get("field_type") == "file"]
    if not file_fields:
        return {}, ""

    sb = db.get_client()
    temp_dir = tempfile.mkdtemp(prefix="alzato-docs-")
    paths: dict[str, str] = {}
    for f in file_fields:
        doc = documents.get(f["field_name"])
        if not doc:
            continue  # not uploaded — find_missing_fields() already caught this if required
        data = sb.storage.from_("documents").download(doc["storage_path"])
        local_path = Path(temp_dir) / (doc.get("file_name") or f["field_name"])
        local_path.write_bytes(data)
        paths[f["field_name"]] = str(local_path)
    return paths, temp_dir


def cleanup(temp_dir: str) -> None:
    if temp_dir:
        shutil.rmtree(temp_dir, ignore_errors=True)
