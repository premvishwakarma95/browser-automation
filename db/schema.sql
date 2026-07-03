-- ============================================================================
-- Alzato Automated University Application System — Supabase schema
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / DROP ... IF EXISTS where needed).
-- ============================================================================

create extension if not exists pgcrypto;   -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type university_platform as enum ('Universitaly', 'ESSE3', 'DreamApply', 'Custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type application_status as enum (
    'NOT_STARTED',       -- queued, nothing done yet
    'IN_PROGRESS',       -- agent is filling the form
    'NEEDS_HUMAN',       -- paused: CAPTCHA / OTP / payment / review
    'READY_FOR_REVIEW',  -- draft filled, awaiting human approval
    'SUBMITTED',         -- human approved -> submitted
    'FAILED',            -- could not complete
    'MISSING_DATA'       -- student missing required fields
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type pending_action_kind as enum (
    'REVIEW_DRAFT', 'SOLVE_CAPTCHA', 'ENTER_OTP', 'PAY_AND_SUBMIT'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- universities — one row per university (client-configured)
-- ---------------------------------------------------------------------------
create table if not exists universities (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  platform         university_platform not null default 'Custom',
  portal_url       text,
  notes            text[] default '{}',      -- per-portal hints handed to the agent
  requires_login   boolean default true,
  has_captcha      boolean default false,
  has_otp          boolean default false,
  requires_payment boolean default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists trg_universities_updated on universities;
create trigger trg_universities_updated before update on universities
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- university_fields — the form-builder output: what each university requires
-- ---------------------------------------------------------------------------
create table if not exists university_fields (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  field_name    text not null,               -- key used to look up the value on the student
  label         text,                         -- human label shown in the admin
  field_type    text not null default 'text', -- text | email | number | date | select | file
  required      boolean not null default true,
  options       jsonb default '[]',           -- for select fields
  mapping_hint  text,                          -- e.g. "Academic tab, step 2"
  sort_order    int default 0,
  created_at    timestamptz not null default now(),
  unique (university_id, field_name)
);
create index if not exists idx_university_fields_uni on university_fields(university_id);

-- ---------------------------------------------------------------------------
-- students — central applicant store (client-entered)
-- Core identity columns + a flexible `data` bag for form-builder custom fields.
-- ---------------------------------------------------------------------------
create table if not exists students (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null,
  email                  text,
  phone                  text,
  date_of_birth          date,
  nationality            text,
  passport_number        text,
  program                text,               -- selected course/program
  intake_year            text,
  selected_university_id uuid references universities(id) on delete set null,
  data                   jsonb not null default '{}',  -- custom fields keyed by field_name
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
drop trigger if exists trg_students_updated on students;
create trigger trg_students_updated before update on students
  for each row execute function set_updated_at();
create index if not exists idx_students_selected_uni on students(selected_university_id);

-- ---------------------------------------------------------------------------
-- documents — uploaded files (stored in Supabase Storage; row holds the path)
-- ---------------------------------------------------------------------------
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  doc_type     text not null,               -- passport | transcript | ielts | ...
  storage_path text not null,               -- path in the Storage bucket
  file_name    text,
  uploaded_at  timestamptz not null default now()
);
create index if not exists idx_documents_student on documents(student_id);

-- ---------------------------------------------------------------------------
-- credentials — portal logins (ciphertext only; encrypted at the app layer
-- using CREDENTIAL_ENCRYPTION_KEY. NEVER store plaintext here.)
-- ---------------------------------------------------------------------------
create table if not exists credentials (
  id                 uuid primary key default gen_random_uuid(),
  university_id      uuid not null references universities(id) on delete cascade,
  student_id         uuid references students(id) on delete cascade,  -- null = agency-level login
  scope              text not null default 'agency',                   -- 'agency' | 'student'
  username           text,
  password_encrypted text,                    -- ciphertext
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
drop trigger if exists trg_credentials_updated on credentials;
create trigger trg_credentials_updated before update on credentials
  for each row execute function set_updated_at();
create index if not exists idx_credentials_uni on credentials(university_id);

-- ---------------------------------------------------------------------------
-- applications — one job per (student -> their selected university)
-- ---------------------------------------------------------------------------
create table if not exists applications (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students(id) on delete cascade,
  university_id  uuid not null references universities(id) on delete restrict,
  status         application_status not null default 'NOT_STARTED',
  missing_fields text[] default '{}',        -- populated when status = MISSING_DATA
  filled_fields  jsonb default '[]',         -- what the agent filled (for human review)
  screenshot_path text,                       -- draft screenshot for review
  agent_log      jsonb default '[]',         -- step-by-step agent trace
  error          text,                        -- populated when status = FAILED
  draft_saved    boolean not null default false,
  attempts       int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz
);
drop trigger if exists trg_applications_updated on applications;
create trigger trg_applications_updated before update on applications
  for each row execute function set_updated_at();
create index if not exists idx_applications_status on applications(status);  -- worker polls this
create index if not exists idx_applications_student on applications(student_id);
create index if not exists idx_applications_uni on applications(university_id);

-- ---------------------------------------------------------------------------
-- pending_actions — the human-in-the-loop queue (review / CAPTCHA / OTP / pay)
-- ---------------------------------------------------------------------------
create table if not exists pending_actions (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  kind           pending_action_kind not null,
  status         text not null default 'open',  -- 'open' | 'resolved'
  payload        jsonb default '{}',            -- context for the human (screenshot, prompt)
  resolution     jsonb default '{}',            -- what the human provided (OTP value, notes)
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    text
);
create index if not exists idx_pending_actions_status on pending_actions(status);
create index if not exists idx_pending_actions_app on pending_actions(application_id);

-- ============================================================================
-- Row Level Security
-- The Python worker uses the SERVICE ROLE key, which BYPASSES RLS.
-- The Next.js admin uses authenticated users, so we allow authenticated access.
-- Tighten these policies later (per-role, per-org) before production.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'universities','university_fields','students','documents',
    'credentials','applications','pending_actions'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists authenticated_all on %I;', t);
    execute format(
      'create policy authenticated_all on %I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- Done. See seed.sql for optional sample data to test the pipeline.
-- ============================================================================
