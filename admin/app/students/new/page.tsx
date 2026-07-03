import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { createStudent } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function NewStudentPage() {
  const sb = supabaseAdmin();
  const { data: universities } = await sb.from('universities').select('id,name').order('name');

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/students" className="hover:underline">Students</Link>
        <span>/</span>
        <span>Add</span>
      </div>
      <h1 className="text-2xl font-semibold">Add student</h1>

      <form action={createStudent} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <Field name="full_name" label="Full name" required />
        <div className="grid grid-cols-2 gap-4">
          <Field name="email" label="Email" type="email" />
          <Field name="phone" label="Phone" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field name="date_of_birth" label="Date of birth" type="date" />
          <Field name="nationality" label="Nationality" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field name="passport_number" label="Passport number" />
          <Field name="intake_year" label="Intake year" />
        </div>
        <Field name="program" label="Program / course" />

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Selected university</span>
          <select name="selected_university_id" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" defaultValue="">
            <option value="">— none —</option>
            {(universities ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Save student
          </button>
          <Link href="/students" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ name, label, type = 'text', required }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}
