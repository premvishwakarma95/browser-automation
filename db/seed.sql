-- ============================================================================
-- Optional seed data — a sample university, its fields, a student, and a job.
-- Run AFTER schema.sql. Uses fixed UUIDs so it's idempotent (re-runnable).
-- ============================================================================

-- Sample university: Universitaly (the centralized pre-enrollment portal)
insert into universities (id, name, platform, portal_url, notes, requires_login, has_captcha, has_otp, requires_payment)
values (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'Universitaly (centralized pre-enrollment)',
  'Universitaly',
  'https://www.universitaly.it',
  array[
    'Mandatory pre-enrollment portal for non-EU students.',
    'Select the university and course exactly as stored on the student record.',
    'A login OTP is usually emailed — pause for human help.'
  ],
  true, true, true, false
)
on conflict (id) do nothing;

-- Its required fields (the form-builder output)
insert into university_fields (university_id, field_name, label, field_type, required, sort_order)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'full_name',       'Full name',       'text',  true, 1),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'email',           'Email',           'email', true, 2),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'passport_number', 'Passport number', 'text',  true, 3),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'program',         'Program',         'text',  true, 4),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'intake_year',     'Intake year',     'text',  true, 5)
on conflict (university_id, field_name) do nothing;

-- Sample student linked to Universitaly
insert into students (id, full_name, email, phone, date_of_birth, nationality, passport_number, program, intake_year, selected_university_id)
values (
  '22222222-2222-2222-2222-222222222222'::uuid,
  'Marco Rossi',
  'marco.rossi@example.com',
  '+39 000 000000',
  '2004-05-12',
  'India',
  'X1234567',
  'MSc Computer Science',
  '2026',
  '11111111-1111-1111-1111-111111111111'::uuid
)
on conflict (id) do nothing;

-- A queued job for that student -> their selected university
insert into applications (id, student_id, university_id, status)
values (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'NOT_STARTED'
)
on conflict (id) do nothing;
