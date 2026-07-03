# Build Plan — Alzato Automated University Application System

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md). This is the step-by-step plan to
build the system. Phases are ordered so each is **independently testable** and de-risks
the next. Time estimates assume **one developer**.

---

## Repository Layout

Everything lives under `admission-system/`:

```
admission-system/
├── ARCHITECTURE.md        # the design (already written)
├── PLAN.md                # this file
├── db/                    # Supabase schema + migrations (SQL)
├── worker/                # Python automation worker (browser-use + cloakbrowser)
│   ├── src/
│   │   ├── main.py            # job loop entry point
│   │   ├── config.py          # env, MiniMax + Supabase settings
│   │   ├── db.py              # Supabase client + job read/write
│   │   ├── validation.py      # student-vs-university field check
│   │   ├── instruction.py     # builds the agent task prompt
│   │   ├── agent_runner.py    # browser-use + cloakbrowser integration
│   │   └── models.py          # status enum + dataclasses
│   ├── requirements.txt
│   └── .env.example
└── admin/                 # Next.js + Supabase admin panel & dashboard
    ├── app/                   # routes (students, universities, dashboard, analytics)
    ├── lib/supabase.ts        # Supabase client
    └── .env.example
```

---

## Milestones (at a glance)

| # | Milestone | Proves |
|---|---|---|
| **M1** | Python PoC fills a practice form | The AI automation actually works |
| **M2** | Supabase schema live + seed data | Data model is sound |
| **M3** | Worker reads a job from DB → fills → saves draft → writes status | End-to-end pipeline |
| **M4** | Admin can add students, universities & fields | Client can configure the system |
| **M5** | Dashboard shows jobs + human can review/pay/submit | Human-in-the-loop closed |
| **M6** | First real Italian university (POC) filled as draft | Real-world validation |

---

## Phase 0 — Project Setup  *(0.5 day)*

**Goal:** empty, runnable skeletons for both apps + shared config conventions.

Tasks:
- Create `admission-system/{db,worker,admin}` folders.
- `worker/`: Python 3.11+ venv, `requirements.txt` (browser-use, cloakbrowser, supabase, python-dotenv), `.env.example`.
- `admin/`: `create-next-app` + `@supabase/supabase-js`, `.env.example`.
- New Supabase project; put URL + keys in both `.env` files.
- Git init + `.gitignore` (node_modules, .env, venv, screenshots).

**Deliverable:** both apps start (`npm run dev`, `python -m src.main`) and print "ready".
**Acceptance:** no functionality yet, but both boot without error.

---

## Phase 1 — Supabase Schema  *(1 day)* → **M2**

**Goal:** the database from ARCHITECTURE §7 exists as SQL migrations.

Tasks:
- Write `db/schema.sql` with tables: `students`, `universities`, `university_fields`,
  `applications`, `documents`, `credentials`, `pending_actions`.
- Add the `application_status` enum: `NOT_STARTED, IN_PROGRESS, NEEDS_HUMAN,
  READY_FOR_REVIEW, SUBMITTED, FAILED, MISSING_DATA`.
- Enable Supabase Storage bucket for `documents`.
- Enable RLS; add basic policies (admin role full access; worker uses service key).
- Seed 1 sample student + 1 sample university (e.g. Universitaly) + its fields.

**Deliverable:** schema applied to Supabase; seed rows visible in the dashboard.
**Acceptance:** can query `applications` joined to `students` and `universities`.

---

## Phase 2 — Python Worker Proof-of-Concept  *(2–3 days)* → **M1**  ⭐ START HERE

**Goal:** prove browser-use + cloakbrowser + MiniMax can fill a form — on a **public
practice form**, NOT a real university yet.

Tasks:
- `agent_runner.py`: launch cloakbrowser (`humanize=True`), wire MiniMax via browser-use's
  OpenAI-compatible `ChatOpenAI` (base URL + model + key). Confirm the exact browser-use
  ↔ cloakbrowser connection API (likely a shared Playwright/CDP handle).
- `instruction.py`: the task template with the golden rule ("fill, DON'T submit, pause for
  CAPTCHA/OTP, save draft").
- Point it at a public test form (e.g. a demo signup form) and have it fill sample data.
- Capture a screenshot + the list of filled fields at the end.

**Deliverable:** `python -m src.main --demo` opens the stealth browser, fills the practice
form, stops before submit, saves a screenshot.
**Acceptance:** you watch the AI fill a real web form end-to-end. **This is the key de-risk.**

**Blocking input needed:** MiniMax **API key + model name**.

---

## Phase 3 — Validation Layer  *(1 day)*

**Goal:** stop wasted runs — check a student has every required field before automating.

Tasks:
- `validation.py`: given a student + a university's `university_fields`, return the list of
  missing/invalid required fields.
- On missing data → set application status `MISSING_DATA` + record what's missing.

**Deliverable:** unit-tested function; feeding an incomplete student flags the gaps.
**Acceptance:** complete student → passes; incomplete → precise missing-field list.

---

## Phase 4 — Next.js Admin (Configuration)  *(4–5 days)* → **M4**

**Goal:** the client can run the system without touching code.

Tasks:
- Auth (Supabase Auth) + protected admin routes.
- **Students**: list + add/edit form, document upload to Supabase Storage.
- **Universities**: list + add/edit (name, platform, portal URL, hints/notes).
- **Form-builder**: define `university_fields` per university (field name, type, required,
  mapping hint). *Decision to lock: store mapping hints, not just a checklist.*
- **Create job**: pick a student + university → insert an `applications` row (`NOT_STARTED`).

**Deliverable:** client can add a student, configure a university + fields, and queue a job.
**Acceptance:** a new `applications` row appears in Supabase from the UI.

---

## Phase 5 — Dashboard + Human-in-the-Loop  *(3–4 days)* → **M5**

**Goal:** close the human loop — review draft, handle CAPTCHA/OTP, pay & submit.

Tasks:
- **Dashboard**: table of applications with status + filters.
- **Job detail**: show filled fields, agent screenshot, log.
- **Pending actions queue**: items needing a human (review / CAPTCHA / OTP / pay+submit).
- Actions: **Approve → mark for submit**, **Reject → back to worker**, enter OTP/notes.

**Deliverable:** a `NEEDS_HUMAN`/`READY_FOR_REVIEW` job is fully resolvable from the UI.
**Acceptance:** human approves a draft → status becomes `SUBMITTED`.

---

## Phase 6 — Wire Worker ↔ Supabase  *(2–3 days)* → **M3**

**Goal:** the real pipeline — worker driven by the DB, not a demo flag.

Tasks:
- `db.py`: poll `applications` for `NOT_STARTED`; claim a job (`IN_PROGRESS`).
- Run: validate → fill via agent → **save draft** → write status + screenshot back.
- On CAPTCHA/OTP/payment/submit → status `NEEDS_HUMAN` + create a `pending_actions` row.
- Handle failures → `FAILED` + error message; support retry.

**Deliverable:** create a job in the admin → worker picks it up automatically → dashboard
shows the drafted result awaiting human review.
**Acceptance:** full loop with zero manual steps between admin "create job" and dashboard "needs review".

---

## Phase 7 — First Real University (POC)  *(3–5 days)* → **M6**

**Goal:** validate against a real Italian portal (recommended: **Universitaly**).

Tasks:
- Configure the real university + fields + portal URL + hints in the admin.
- Store portal credentials (encrypted).
- Run a real student through → agent fills the real form → **saves draft** (no submit).
- Iterate on the instruction/hints until reliable; document quirks.

**Deliverable:** a real Universitaly application drafted by the agent, reviewed by a human.
**Acceptance:** human confirms the drafted form is correct and ready to pay/submit.

---

## Phase 8 — Analytics & Hardening  *(ongoing)*

- Analytics: volumes, success rate, per-university bottlenecks.
- Retries, logging/monitoring, alerts when a portal changes and breaks a run.
- Add the next universities by platform group (ESSE3, then DreamApply, then custom).

---

## Suggested Timeline

| Weeks | Focus |
|---|---|
| **Week 1** | Phase 0–2: setup, schema, **Python PoC (M1)** |
| **Week 2** | Phase 3–4: validation + admin config (M4) |
| **Week 3** | Phase 5–6: dashboard + worker↔DB wiring (M3, M5) |
| **Week 4** | Phase 7: first real university (M6) |
| **Week 5+** | Phase 8: analytics, hardening, more universities |

**~4 weeks to a working end-to-end system on one real university**, then scale by platform.

---

## Critical Path & Risks

- **Biggest de-risk = Phase 2.** If browser-use + cloakbrowser + MiniMax can't reliably fill
  a form, everything else is moot. **Do this first.**
- **cloakbrowser licensing** — v146 free; budget for Pro (v148+) if needed.
- **CAPTCHA/OTP/payment** — handled by design (human-in-the-loop), not automated.
- **Portal changes** — universities redesign; hints/instructions need maintenance.
- **MiniMax reliability for agentic form-filling** — if weak, swap the LLM (config change).

---

## Immediate Next Action

**Start Phase 0 + Phase 2.** Needed from you: **MiniMax API key + model name**.
Then I scaffold `worker/` and we run the practice-form PoC to prove the automation.
```
