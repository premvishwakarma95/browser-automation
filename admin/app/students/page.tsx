import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
  const sb = supabaseAdmin();
  const { data: students } = await sb
    .from('students')
    .select('id,full_name,email,program,intake_year')
    .order('created_at', { ascending: false });

  const rows = students ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-slate-500">Applicants. Queue an application (with a university) from the Applications page.</p>
        </div>
        <Link href="/students/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
          + Add student
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Program</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No students yet.</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-5 py-3 font-medium">{s.full_name}</td>
                <td className="px-5 py-3 text-slate-600">{s.email ?? '—'}</td>
                <td className="px-5 py-3 text-slate-600">{s.program ?? '—'}</td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href={`/students/${s.id}/edit`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
