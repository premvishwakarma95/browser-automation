"""HTTP API for the admin Playground — runs the browser agent live and streams
its steps AND a near-real-time screenshot feed back as Server-Sent Events
(SSE), so the admin can watch it work. Everything here is self-hosted —
cloakbrowser's stealth Chromium, same as the production worker, no external
browser service.

The screenshot feed is polled on its own clock (FRAME_INTERVAL_SECONDS),
independent of the agent's step cadence — a single MiniMax step can take many
seconds to reason through, so waiting for step boundaries alone made the live
view feel laggy.

Run:  uvicorn src.api:app --port 8000   (from the worker/ dir, venv active)
"""

import asyncio
import base64
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
    max_steps: int = 15


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


FRAME_INTERVAL_SECONDS = 0.7


@app.get("/health")
def health():
    return {"status": "ok", "model": config.minimax_model}


@app.post("/playground/run")
async def playground_run(req: RunRequest):
    """Run the agent on a free-form task and stream steps (with a screenshot each) as they happen."""

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

        # Polls a fresh screenshot on its own clock, independent of agent steps —
        # a single step can take many seconds, so this is what makes the live
        # view feel close to real-time instead of jumping only at step boundaries.
        async def stream_frames():
            while True:
                try:
                    data = await browser.take_screenshot(format="jpeg", quality=55)
                    await queue.put(("frame", {"screenshot": base64.b64encode(data).decode()}))
                except Exception:  # noqa: BLE001 — e.g. mid-navigation; just skip this frame
                    pass
                await asyncio.sleep(FRAME_INTERVAL_SECONDS)

        # Lazy imports so the module loads even before the browser stack is ready.
        from cloakbrowser import ensure_binary, build_args
        from browser_use import Agent, ChatOpenAI, Browser

        from .llm_output_fix import patch_agent_output_json_parsing
        patch_agent_output_json_parsing()

        task = req.task if not req.url else f"{req.task}\n\nStart at this URL: {req.url}"
        task += """

STOPPING CRITERIA (read carefully — this is what "done" means for this task):
- The moment the objective above is achieved, call the `done` action immediately.
  One check is enough to confirm success (e.g. a success message, a URL change,
  an expected element appearing) — do not re-verify repeatedly or keep exploring.
- Do not take any action that wasn't asked for (e.g. logging out after logging
  in, navigating to unrelated pages, clicking things "just to check").
- If you determine the objective can't be completed, call `done` with
  success=false and explain why — don't keep retrying indefinitely.
- Never submit, never pay, never solve a CAPTCHA/OTP yourself."""

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
                          headless=config.headless, locale="it-IT", timezone="Europe/Rome")
        browser = Browser(executable_path=binary, args=args, headless=config.headless)

        agent = Agent(
            task=task, llm=llm, browser=browser, use_vision=True,
            register_new_step_callback=on_step,
        )

        async def run_agent():
            frame_task = None
            try:
                # Start explicitly (rather than letting agent.run() lazily start it)
                # so the frame poller has a live CDP session to shoot against from
                # the first tick, not just from whenever the agent's first step lands.
                await browser.start()
                frame_task = asyncio.create_task(stream_frames())

                history = await agent.run(max_steps=req.max_steps)
                final = history.final_result() if hasattr(history, "final_result") else str(history)
                await queue.put(("done", {"result": str(final)}))
            except Exception as e:  # noqa: BLE001
                await queue.put(("error", {"message": str(e)}))
            finally:
                if frame_task:
                    frame_task.cancel()
                    try:
                        await frame_task
                    except (asyncio.CancelledError, Exception):  # noqa: BLE001
                        pass
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
