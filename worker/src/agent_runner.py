"""browser-use + cloakbrowser integration (Phase 2).

This is the ONE place the AI automation lives. Everything else is plain code.

Integration approach (verified against browser-use 0.13.x + cloakbrowser 0.4.x):
  - cloakbrowser.ensure_binary() downloads/returns the STEALTH Chromium binary
    (free v146). Its anti-detection patches live in the binary itself (C++ level).
  - cloakbrowser.build_args() produces the stealth launch flags (+ Italian locale/tz).
  - browser-use's Browser drives that binary via `executable_path` + `args`.
  - MiniMax is wired through browser-use's OpenAI-compatible ChatOpenAI.
"""

from .config import config
from .instruction import build_instruction

# Defaults tuned for Italian university portals.
LOCALE = "it-IT"
TIMEZONE = "Europe/Rome"


async def run_agent(student: dict, university: dict) -> dict:
    """Launch the stealth browser, let MiniMax fill the form, pause before submit."""
    from cloakbrowser import ensure_binary, build_args
    from browser_use import Agent, ChatOpenAI, Browser

    # 1) MiniMax as the driving LLM (OpenAI-compatible endpoint)
    #
    # MiniMax compatibility notes:
    #  - Its `response_format` json_schema validator is STRICTER than OpenAI's and
    #    rejects browser-use's optimized schema (properties with empty `type`).
    #    -> dont_force_structured_output=True: don't send response_format.
    #    -> add_schema_to_system_prompt=True: give the model the schema in the prompt.
    #  - Use a NON-reasoning model (MiniMax-Text-01), not M2, or output is wrapped
    #    in <think>...</think> and won't parse as JSON.
    llm = ChatOpenAI(
        model=config.minimax_model,
        api_key=config.minimax_api_key,
        base_url=config.minimax_base_url,
        dont_force_structured_output=True,
        add_schema_to_system_prompt=True,
    )

    # 2) cloakbrowser stealth Chromium binary + stealth launch args
    binary_path = ensure_binary(license_key=config.cloak_license_key or None)
    args = build_args(
        stealth_args=True,
        extra_args=None,
        headless=config.headless,
        locale=LOCALE,
        timezone=TIMEZONE,
    )

    # 3) browser-use drives the stealth binary
    browser = Browser(
        executable_path=binary_path,
        args=args,
        headless=config.headless,
    )

    # 4) run the agent toward the "fill, don't submit" task
    agent = Agent(
        task=build_instruction(student, university),
        llm=llm,
        browser=browser,
        use_vision=True,
    )
    result = await agent.run()
    return {"status": "READY_FOR_REVIEW", "result": str(result)}
