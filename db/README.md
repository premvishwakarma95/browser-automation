# Database (Supabase)

Schema for the Automated University Application System. See
[../ARCHITECTURE.md](../ARCHITECTURE.md) §7 for the design.

## Apply the schema

1. Open your Supabase project → **SQL Editor**.
2. Paste the contents of [`schema.sql`](./schema.sql) → **Run**.
3. (Optional) Paste [`seed.sql`](./seed.sql) → **Run** to add sample data
   (Universitaly + its fields + a sample student + one queued job).

Both files are **re-runnable** (idempotent).

## Storage bucket (for documents)

Create a Storage bucket named `documents` (Supabase → Storage → New bucket, keep
it private). The `documents.storage_path` column points at files in this bucket.

## Tables

| Table | Purpose |
|---|---|
| `universities` | One row per university + platform + agent hints |
| `university_fields` | Form-builder: required fields per university |
| `students` | Applicant data (core columns + `data` jsonb for custom fields) |
| `documents` | Uploaded files (passport, transcripts…) — paths into Storage |
| `credentials` | Portal logins, **ciphertext only** (encrypted at app layer) |
| `applications` | One job per student→university; status + draft + log |
| `pending_actions` | Human queue: review / CAPTCHA / OTP / pay+submit |

## Status flow (`application_status`)

```
NOT_STARTED → IN_PROGRESS → NEEDS_HUMAN → READY_FOR_REVIEW → SUBMITTED
                   │             │                              
                   └─────────────┴───────────────▶ FAILED / MISSING_DATA
```

## Security notes

- The **Python worker** uses the **service_role** key → bypasses RLS.
- The **Next.js admin** uses **authenticated** users → the `authenticated_all`
  policies grant access. **Tighten these before production** (per-role/org).
- `credentials.password_encrypted` is **ciphertext** — encryption happens in the
  app using `CREDENTIAL_ENCRYPTION_KEY`. Never store plaintext.
