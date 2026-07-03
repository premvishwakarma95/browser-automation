# Admin Panel (Next.js)

Admin UI for the Automated University Application System. Client adds students,
configures universities (form-builder), queues applications, and reviews/approves
the drafts the worker produces.

## Stack
- Next.js 16 (App Router) + Tailwind
- Supabase (server-side, **service_role** key — see security note)

## Setup
```bash
cd admission-system/admin
npm install
cp .env.example .env.local   # already filled during setup
npm run dev                  # http://localhost:3000
```

## Pages
| Route | Purpose |
|---|---|
| `/` | Dashboard: counts + recent applications + pending actions |
| `/students`, `/students/new` | List / add students (with selected university) |
| `/universities`, `/universities/new` | List / add universities + **form-builder** (required fields + hints) |
| `/applications` | Review drafted applications, **approve → mark submitted** |

## How it connects
- Data access is **server-side** via [`lib/supabaseServer.ts`](lib/supabaseServer.ts)
  using the service-role key. Mutations are **Server Actions** in
  [`app/actions.ts`](app/actions.ts).
- Queuing an application inserts a `NOT_STARTED` row → the Python **worker** picks
  it up, fills the form, saves a draft, and sets `READY_FOR_REVIEW` → the admin
  approves it here.

## ⚠️ Security note (before production)
This uses the **service_role** key server-side and has **no login yet**. Add
Supabase Auth + tighten the RLS policies before exposing this beyond local/dev.
