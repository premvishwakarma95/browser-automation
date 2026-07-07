"""Guaranteed browser process teardown.

Verified empirically (see project history): browser-use's `Browser.kill()` only
resets its own session bookkeeping — it does NOT terminate the underlying OS
Chromium process. That process stays alive for the rest of the parent Python
process's lifetime. Since the worker's poll loop (main.py) runs forever, every
processed job would otherwise leak one permanent orphaned Chromium process.

Fix: launch every browser with a unique --user-data-dir marker, then after
`browser.kill()` (best-effort), force-kill anything whose command line contains
that marker. This is safe under concurrency — each run gets its own marker, so
we only ever kill the process(es) belonging to THIS run, never another job's.
"""

import shutil
import subprocess
import tempfile


def make_user_data_dir() -> str:
    """A fresh, uniquely-named profile dir — doubles as this run's kill marker."""
    return tempfile.mkdtemp(prefix="alzato-cloak-")


async def teardown_browser(browser, user_data_dir: str) -> None:
    """Best-effort polite kill, THEN a guaranteed hard kill by marker, THEN cleanup."""
    try:
        await browser.kill()
    except Exception:  # noqa: BLE001 — best-effort only, the hard kill below is what matters
        pass

    # Guaranteed teardown: match any process (main + zygote/gpu/renderer children)
    # whose argv contains this run's unique profile dir, and SIGKILL them.
    subprocess.run(["pkill", "-9", "-f", user_data_dir], check=False)

    shutil.rmtree(user_data_dir, ignore_errors=True)
