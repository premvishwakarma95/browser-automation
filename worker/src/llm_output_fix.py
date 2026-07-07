"""Tolerate markdown-fenced JSON from MiniMax.

We drive MiniMax with `dont_force_structured_output=True` + `add_schema_to_system_prompt=True`
(see agent_runner.py/api.py) because MiniMax's `response_format` json_schema
validator is stricter than OpenAI's and rejects browser-use's schema. Without
strict mode, MiniMax sometimes wraps its JSON reply in a markdown code fence
(```json ... ```) instead of returning raw JSON. browser-use parses the model
reply with a direct `AgentOutput.model_validate_json(content)` call and does
no cleanup first, so a fenced reply fails immediately with "Invalid JSON:
expected value at line 1 column 1" — verified as the cause of repeated step
failures/retries during testing (and, downstream, of unrelated CDP tab
churn during those retries, which briefly broke the live-view feature).

Fix: monkey-patch the base `AgentOutput.model_validate_json` classmethod once
at import time to strip a wrapping code fence before validating. Every
per-run output schema browser-use builds (`type_with_custom_actions*`) is a
real subclass of this base class via `pydantic.create_model(__base__=...)`,
so the patch applies to all of them through normal inheritance — no need to
touch each dynamically-created subclass individually. Already-clean JSON is
passed through completely unchanged.
"""

import re


def _strip_markdown_json_fence(raw: str) -> str:
    s = raw.strip()
    if not s.startswith("```"):
        return raw
    s = re.sub(r"^```[a-zA-Z]*\r?\n", "", s)
    s = re.sub(r"\r?\n?```\s*$", "", s)
    return s.strip()


def patch_agent_output_json_parsing() -> None:
    from browser_use.agent.views import AgentOutput

    if getattr(AgentOutput, "_alzato_json_fence_patch", False):
        return  # idempotent — safe to call from every entry point

    original = AgentOutput.model_validate_json.__func__

    def patched(cls, json_data, *args, **kwargs):
        if isinstance(json_data, (bytes, bytearray)):
            json_data = json_data.decode()
        if isinstance(json_data, str):
            json_data = _strip_markdown_json_fence(json_data)
        return original(cls, json_data, *args, **kwargs)

    AgentOutput.model_validate_json = classmethod(patched)
    AgentOutput._alzato_json_fence_patch = True
