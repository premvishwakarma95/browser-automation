# Alzato Overseas — Automated University Application System

> Automates filling Italian university admission forms so staff stop doing it manually.
> Built with an **AI browser agent** (browser-use) running on a **stealth browser**
> (cloakbrowser), with a **human-in-the-loop** for payment and final submit.

---

## 1. The Problem

Alzato receives a large volume of study-abroad applications. Today the team fills out
each university's online application form **by hand** — slow, repetitive, error-prone,
and it doesn't scale as volume grows.

**Unit of work:** `1 student → their 1 selected university`.

---

## 2. The Solution (in one line)

An admin platform where the client adds students and configures universities, and a
Python worker uses an AI browser agent to fill each application form and **save it as a
draft** — a human then reviews, pays, and submits.

---

## 3. Scope & Confirmed Decisions

| Decision | Choice |
|---|---|
| **Scope** | **Italy-only** (~50+ universities) |
| **Payment & final submit** | **Human-in-the-loop** — agent NEVER auto-pays or auto-submits |
| **Student data source** | Client adds students via the **admin panel** |
| **University data source** | Client uploads/configures universities + required fields via the **admin form-builder** |
| **System independence** | **Self-contained** — its own database; does NOT reuse the alzato / enquiry-app DBs |
| **Admin + dashboard stack** | **Next.js + Supabase** |
| **Database** | New **Supabase** project |
| **Automation worker** | **Python** (browser-use + cloakbrowser) |
| **LLM** | **MiniMax** for now (pluggable — swap to Claude/other later via config) |
| **POC starting university** | Deferred — foundation work is university-agnostic |

### Why Italy-only matters
Italian universities are **consolidated onto a few shared platforms**, so we automate the
*platform*, not each university:
- **Universitaly** — the centralized government pre-enrollment portal (one portal, all non-EU students, mandatory for the visa).
- **CINECA ESSE3** — the student system used by a large share of Italian universities (`esse3.uni-x.it`).
- **DreamApply** — application platform used by several universities.
- **Custom** — a few big universities (Bologna, Sapienza, Politecnico) with in-house portals.

Result: **~8–12 configurations cover 50+ universities**, not 50 separate scripts.

---

## 4. The Tech Stack

**browser-use** — https://github.com/browser-use/browser-use
Open-source **Python** AI-agent framework. An LLM drives a real browser (via Playwright)
to complete tasks from natural-language goals. Supports MiniMax/OpenAI/Claude/Gemini/Ollama.
**This IS the AI wrapper — we do NOT rebuild it.**

**cloakbrowser** — https://github.com/CloakHQ/cloakbrowser
**Stealth Chromium**, a drop-in Playwright replacement patched at the C++ level to beat
bot detection (reCAPTCHA v3 ~0.9 human score, passes Cloudflare Turnstile, FingerprintJS).
Supports `humanize=True`, proxies, `geoip`, persistent profiles. Explicitly integrates
with browser-use.
> Licensing note: wrapper is MIT/free; Chromium **v146 is permanently free**, **v148+ needs a Pro subscription**.

**MiniMax** — the LLM. Exposes an **OpenAI-compatible API**, so it plugs into browser-use
through its OpenAI-style interface (base URL + model id + key). Swappable later.

**Our value-add (what we actually build):** the admin form-builder, validation layer,
job/status harness, human-in-the-loop dashboard, and analytics **around** browser-use.

---

## 5. How It Works — Core Mechanic (one registration)

The Python worker runs this loop for one `student → university` job:

```
1. Load the student's data + the university's config from the DB
2. Validate: does the student have every required field?
      → if not, mark job "missing_data", flag it, STOP
3. Launch cloakbrowser (stealth Chromium)
4. Hand browser-use an instruction + the student data + the university URL
5. browser-use (via MiniMax) reads the page and fills fields step by step
6. On reaching submit / pay / CAPTCHA / OTP → SAVE DRAFT, STOP, flag "needs_human"
7. Write status + screenshot back to the DB
8. Human opens the dashboard → reviews the draft → pays & submits
```

**The AI only does steps 5–6. Everything else is plain code we control.**

### How the two tools plug together (rough shape — confirm exact API when building)

```python
from cloakbrowser import launch
from browser_use import Agent
from browser_use.llm import ChatOpenAI    # MiniMax speaks OpenAI's protocol

# 1) stealth browser — looks like a real Italian user
browser = launch(humanize=True, geoip=True)

# 2) point MiniMax at browser-use
llm = ChatOpenAI(
    model="MiniMax-Text-01",
    base_url="https://api.minimax.io/v1",   # MiniMax OpenAI-compatible endpoint
    api_key=MINIMAX_KEY,
)

# 3) the agent drives the stealth browser toward a goal
agent = Agent(
    task=build_instruction(student, university),  # "fill, DON'T submit, pause for CAPTCHA/OTP"
    llm=llm,
    browser=browser,
)
await agent.run()
```

`build_instruction(...)` is our task template with the golden rule baked in:
**never submit, never pay, never solve CAPTCHA/OTP — save draft and hand back to a human.**

---

## 6. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  ADMIN PANEL (Next.js)                                    │
│   • Add/manage students                                   │
│   • Upload/configure universities + required fields       │
│   • Dashboard: application status + pending actions        │
│     (review draft / solve CAPTCHA·OTP / pay·submit)        │
│   • Analytics                                             │
└───────────────┬─────────────────────────────────────────┘
                │  (own database)
        ┌───────▼────────┐
        │  SUPABASE DB   │  students · universities+fields · jobs+status ·
        │                │  documents · encrypted credentials · pending_actions
        └───────┬────────┘
                │  queue of jobs
        ┌───────▼───────────────────────────────────────┐
        │  AUTOMATION WORKER (Python)                    │
        │   browser-use (MiniMax) → cloakbrowser (stealth)│
        │   fills form → saves DRAFT → pauses for human  │
        └───────────────────────────────────────────────┘
```

**How the pieces talk:** the Next.js admin and the Python worker **share one Supabase DB**.
The admin writes jobs; the worker reads them, runs the loop, and writes status/screenshots
back. No direct API between them is required.

---

## 7. Data Model (Supabase — draft)

| Table | Purpose |
|---|---|
| `students` | All applicant data the client enters |
| `universities` | One row per university: name, platform (Universitaly/ESSE3/DreamApply/Custom), portal URL, notes/hints |
| `university_fields` | Per-university required-field definitions (the form-builder output) |
| `applications` | One job per `student → university`; holds status, draft info, screenshot, log |
| `documents` | Uploaded files (passport, transcripts, IELTS) — Supabase Storage |
| `credentials` | Per-portal login credentials, **encrypted at rest** |
| `pending_actions` | Human queue: review draft / solve CAPTCHA / enter OTP / pay & submit |

### Application status machine
```
NOT_STARTED → IN_PROGRESS → NEEDS_HUMAN → READY_FOR_REVIEW → SUBMITTED
                    │            │                              
                    └────────────┴──────────────▶ FAILED / MISSING_DATA
```

---

## 8. Modules (from the solution doc)

| Module | Purpose |
|---|---|
| Admin Panel | Configure universities + define required fields via form-builder |
| Student DB | Central store for all applicant data |
| University Forms | Per-university field definitions that drive collection + mapping |
| Automation + AI | browser-use + cloakbrowser fill and draft the forms |
| Dashboard | Track status, progress, pending actions |
| Analytics | Volumes, success rates, bottlenecks across universities |

---

## 9. Build Sequence

Each step is independently testable:

1. **Supabase schema** — the tables in §7.
2. **Python worker "hello world"** — browser-use + cloakbrowser + MiniMax filling a
   **public practice form** (NOT a real university yet). Proves the tools work and teaches them.
3. **Validation layer** — student-vs-university required-field check.
4. **Next.js admin** — add students, upload universities/fields, create jobs.
5. **Dashboard** — job status + the human review / pay / submit screen.
6. **Wire worker ↔ Supabase** — worker reads jobs, writes drafts + status back.
7. **First real university** — the deferred POC (recommended: Universitaly).

**Recommended first move:** Step 2 (the Python proof-of-concept). It's small, needs no DB,
and de-risks the whole project by proving the automation actually works before we build the
platform around it.

---

## 10. Open Items To Define

- Does the form-builder store **field mapping / per-portal hints**, or only a data checklist? (Recommendation: both — hints greatly improve agent reliability.)
- **Encrypted credential storage** approach.
- **Document upload/storage** flow (Supabase Storage).
- **MiniMax** exact model name + API key.
- **CAPTCHA/OTP pause-and-resume** mechanism detail (lives in `pending_actions` + dashboard).

---

## 11. Key Benefit

Replaces slow manual data entry with a **validated, automated, human-supervised pipeline** —
fewer errors, less staff time, and it scales as applications and partner universities grow.
```
