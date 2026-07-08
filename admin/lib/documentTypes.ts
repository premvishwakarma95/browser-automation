// Common documents universities ask for — collected once per student so any
// application can reuse them, instead of re-asking per university.
export const DOCUMENT_TYPES = [
  { key: 'passport', label: 'Passport copy' },
  { key: 'transcript', label: 'Academic transcript' },
  { key: 'english_test', label: 'English test (IELTS/TOEFL)' },
  { key: 'sop', label: 'Statement of purpose' },
  { key: 'cv', label: 'CV / résumé' },
  { key: 'photo', label: 'Passport photo' },
] as const;
