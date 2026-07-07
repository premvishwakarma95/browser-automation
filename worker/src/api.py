"""HTTP API for the admin Playground — runs the browser agent live and streams
each step back as Server-Sent Events (SSE), so the admin can watch it work.

Run:  uvicorn src.api:app --port 8000   (from the worker/ dir, venv active)
"""

import asyncio
import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import config
from .browser_lifecycle import make_user_data_dir, teardown_browser

app = FastAPI(title="Alzato Worker API")

# Allow the admin (localhost:3000) to call us from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the admin origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    task: str
    url: str | None = None
    headless: bool = True
    max_steps: int = 15


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.get("/health")
def health():
    return {"status": "ok", "model": config.minimax_model}


@app.post("/playground/run")
async def playground_run(req: RunRequest):
    """Run the agent on a free-form task and stream steps as they happen."""

    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()

        # Called by browser-use after each model step: (browser_state, model_output, n).
        async def on_step(browser_state, model_output, n_steps):
            try:
                actions = []
                for a in getattr(model_output, "action", None) or []:
                    dumped = a.model_dump(exclude_none=True) if hasattr(a, "model_dump") else {}
                    actions.append(dumped)
                await queue.put(("step", {
                    "n": n_steps,
                    "url": getattr(browser_state, "url", "") or "",
                    "evaluation": getattr(model_output, "evaluation_previous_goal", "") or "",
                    "next_goal": getattr(model_output, "next_goal", "") or "",
                    "actions": actions,
                }))
            except Exception as e:  # noqa: BLE001
                await queue.put(("step", {"n": n_steps, "error": str(e)}))

        # Lazy imports so the module loads even before the browser stack is ready.
        from cloakbrowser import ensure_binary, build_args
        from browser_use import Agent, ChatOpenAI, Browser

        from .llm_output_fix import patch_agent_output_json_parsing
        patch_agent_output_json_parsing()

        task = req.task if not req.url else f"{req.task}\n\nStart at this URL: {req.url}"

        llm = ChatOpenAI(
            model=config.minimax_model,
            api_key=config.minimax_api_key,
            base_url=config.minimax_base_url,
            dont_force_structured_output=True,
            add_schema_to_system_prompt=True,
        )
        binary = ensure_binary(license_key=config.cloak_license_key or None)
        user_data_dir = make_user_data_dir()
        args = build_args(stealth_args=True, extra_args=[f"--user-data-dir={user_data_dir}"],
                          headless=req.headless, locale="it-IT", timezone="Europe/Rome")
        browser = Browser(executable_path=binary, args=args, headless=req.headless)

        agent = Agent(
            task=task, llm=llm, browser=browser, use_vision=True,
            register_new_step_callback=on_step,
        )

        async def run_agent():
            try:
                history = await agent.run(max_steps=req.max_steps)
                final = history.final_result() if hasattr(history, "final_result") else str(history)
                await queue.put(("done", {"result": str(final)}))
            except Exception as e:  # noqa: BLE001
                await queue.put(("error", {"message": str(e)}))
            finally:
                # browser.kill()/.stop()/.close() only reset browser-use's own
                # session state — none of them terminate the OS Chromium process
                # (verified empirically). teardown_browser() force-kills it via
                # its unique user_data_dir marker, guaranteeing no orphaned
                # process survives this request.
                #
                # shield() matters here: if the client disconnects right after
                # "done" but before "__end__", the outer handler below cancels
                # this task. Without shielding, that cancellation could land
                # mid-teardown and abort the kill, leaking the browser (verified
                # empirically — this happened during testing before the fix).
                try:
                    await asyncio.shield(teardown_browser(browser, user_data_dir))
                except asyncio.CancelledError:
                    pass  # our await was cancelled; the shielded teardown still runs to completion
                try:
                    await queue.put(("__end__", {}))
                except Exception:  # noqa: BLE001
                    pass

        runner = asyncio.create_task(run_agent())
        try:
            yield _sse("start", {"task": task, "model": config.minimax_model})
            while True:
                kind, data = await queue.get()
                if kind == "__end__":
                    break
                yield _sse(kind, data)
            await runner
        finally:
            # Client disconnected (Stop) or stream ended → cancel the agent + close browser.
            if not runner.done():
                runner.cancel()
                try:
                    await runner
                except (asyncio.CancelledError, Exception):  # noqa: BLE001
                    pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")
