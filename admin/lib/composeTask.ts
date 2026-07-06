// Composes the natural-language agent task from a real student + university,
// mirroring worker/src/instruction.py so Playground "Try" runs match production.

export type PlaygroundStudent = {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  passport_number?: string | null;
  program?: string | null;
  intake_year?: string | null;
  selected_university_id?: string | null;
};

export type PlaygroundUniversity = {
  id: string;
  name: string;
  platform: string;
  portal_url?: string | null;
  notes?: string[] | null;
};

const FIELD_LABELS: [keyof PlaygroundStudent, string][] = [
  ['full_name', 'Full name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['date_of_birth', 'Date of birth'],
  ['nationality', 'Nationality'],
  ['passport_number', 'Passport number'],
  ['program', 'Program'],
  ['intake_year', 'Intake year'],
];

export function composeTask(
  student: PlaygroundStudent,
  university: PlaygroundUniversity,
  operatorPrompt: string
): string {
  const fields = FIELD_LABELS
    .filter(([key]) => student[key])
    .map(([key, label]) => `- ${label}: ${student[key]}`)
    .join('\n');

  const hints = (university.notes ?? []).length
    ? university.notes!.map((n) => `- ${n}`).join('\n')
    : '- (none)';

  return `ROLE: You are registering a student on a university admission portal.
Fill the form accurately. DO NOT submit — save it as a draft and hand back to a human.

PORTAL: ${university.portal_url ?? ''}
UNIVERSITY: ${university.name}
PLATFORM: ${university.platform}

PORTAL-SPECIFIC HINTS:
${hints}

STUDENT DATA:
${fields}

OPERATOR INSTRUCTIONS:
${operatorPrompt || '(none — just fill the form with the student data above)'}

RULES (non-negotiable):
- Never submit, never pay, never solve a CAPTCHA/OTP yourself.
- If a CAPTCHA / OTP / payment appears -> STOP and report NEEDS_HUMAN.
- If a required field has no matching student data -> STOP and report MISSING_FIELD: <name>.
- If the page looks unexpected -> describe what you see and ask before acting.`;
}
