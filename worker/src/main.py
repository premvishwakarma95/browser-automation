"""Worker entry point.

Modes:
  python -m src.main            → poll Supabase for jobs and process them (Phase 6)
  python -m src.main --once     → process a single job then exit (good for testing)
  python -m src.main --demo     → run the browser agent against a public practice form
"""

import sys
import time
import asyncio

from .config import config
from . import db
from .process import process_job


def print_status():
    print("🎓 Alzato admission worker")
    print(f"   Supabase URL     : {config.supabase_url or '(not set)'}")
    print(f"   MiniMax model    : {config.minimax_model or '(not set)'}")
    print(f"   agent mode       : {'MOCK (no browser)' if config.mock_agent else 'LIVE (cloakbrowser)'}")
    missing = config.missing()
    if missing:
        print(f"   ⚠️  Missing env vars: {', '.join(missing)} — fill them in worker/.env")
    else:
        print("   ✅ Config looks complete.")
    return not missing


async def run_one() -> bool:
    """Claim and process one job. Returns True if a job was handled."""
    job = db.claim_next_job()
    if not job:
        return False
    print(f"▶️  Processing job {job['id']} (student={job['student_id']})")
    status = await process_job(job)
    print(f"   → {status}")
    return True


async def poll_loop():
    print(f"👀 Polling for jobs every {config.poll_interval}s (Ctrl+C to stop)...")
    while True:
        handled = await run_one()
        if not handled:
            await asyncio.sleep(config.poll_interval)


async def demo():
    """Run the browser agent against a public PRACTICE form (not a real university)."""
    from .agent_runner import run_agent
    student = {
        "full_name": "Marco Rossi",
        "email": "marco.rossi@example.com",
        "password": "Wonderland123",
        "program": "MSc Computer Science",
    }
    university = {
        "name": "Practice Form",
        "platform": "Custom",
        "portal_url": "https://www.selenium.dev/selenium/web/web-form.html",
        "notes": ["This is a practice run. Fill the text fields, do not click submit."],
    }
    print("Demo result:", await run_agent(student, university))


def main():
    ready = print_status()
    if "--demo" in sys.argv:
        if not ready:
            sys.exit("Cannot run --demo until required env vars are set.")
        asyncio.run(demo())
    elif "--once" in sys.argv:
        asyncio.run(run_one()) or print("No NOT_STARTED jobs found.")
    else:
        asyncio.run(poll_loop())


if __name__ == "__main__":
    main()
