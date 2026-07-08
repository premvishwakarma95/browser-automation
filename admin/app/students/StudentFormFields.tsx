import { DOCUMENT_TYPES } from '@/lib/documentTypes';

type StudentDefaults = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  passport_number?: string | null;
  program?: string | null;
  intake_year?: string | null;
};

export function StudentFormFields({
  defaults,
  existingDocs,
}: {
  defaults?: StudentDefaults;
  existingDocs?: Record<string, string>; // doc_type -> file_name, for already-uploaded documents
}) {
  return (
    <>
      <Field name="full_name" label="Full name" required defaultValue={defaults?.full_name} />
      <div className="grid grid-cols-2 gap-4">
        <Field name="email" label="Email" type="email" defaultValue={defaults?.email} />
        <Field name="phone" label="Phone" defaultValue={defaults?.phone} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field name="date_of_birth" label="Date of birth" type="date" defaultValue={defaults?.date_of_birth} />
        <Field name="nationality" label="Nationality" defaultValue={defaults?.nationality} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field name="passport_number" label="Passport number" defaultValue={defaults?.passport_number} />
        <Field name="intake_year" label="Intake year" defaultValue={defaults?.intake_year} />
      </div>
      <Field name="program" label="Program / course" defaultValue={defaults?.program} />

      <div>
        <span className="mb-2 block text-sm font-medium text-gray-700">Documents (optional)</span>
        <p className="mb-3 text-xs text-gray-500">
          {existingDocs
            ? 'Upload a file only for documents you want to replace — everything else stays as-is.'
            : 'Common documents universities ask for — collect them once here so any application can reuse them.'}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {DOCUMENT_TYPES.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                {label}
                {existingDocs?.[key] && (
                  <span className="ml-1.5 text-emerald-600">✓ on file: {existingDocs[key]}</span>
                )}
              </span>
              <input
                name={`doc_${key}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | null;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ''}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}
