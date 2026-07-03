# Worker — Python automation

browser-use (MiniMax) + cloakbrowser. Fills a university form and saves a draft;
never submits/pays (human-in-the-loop).

## Setup

```bash
cd admission-system/worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in the values
```

## Run

```bash
python -m src.main          # boots, checks config (Phase 0)
python -m src.main --demo   # fills a public practice form (Phase 2)
python -m src.main --once   # process one queued job from Supabase (Phase 6)
python -m src.main          # (no flag) poll loop over Supabase jobs
```

## Playground API (powers the admin's Playground chat)

```bash
python -m uvicorn src.api:app --port 8000
```

Endpoints: `GET /health`, `POST /playground/run` (streams agent steps as SSE).
The admin Playground page (`/playground`) calls this at `NEXT_PUBLIC_WORKER_API_URL`.

> The Supabase project here must be a NEW/SEPARATE project — not alzato, not enquiry-app.
