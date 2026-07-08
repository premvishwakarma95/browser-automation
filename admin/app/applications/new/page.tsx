import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { createApplication } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function NewApplicationPage() {
  const sb = supabaseAdmin();
  const [{ data: students }, { data: universities }] = await Promise.all([
    sb.from('students').select('id,full_name').order('full_name'),
    sb.from('universities').select('id,name').order('name'),
  ]);

  const rows = students ?? [];
  const unis = universities ?? [];

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/applications" className="hover:underline">Applications</Link>
        <span>/</span>
        <span>Queue</span>
      </div>
      <h1 className="text-2xl font-semibold">Queue application</h1>

      {rows.length === 0 || unis.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          You need at least one {rows.length === 0 ? 'student' : ''}
          {rows.length === 0 && unis.length === 0 ? ' and ' : ''}
          {unis.length === 0 ? 'university' : ''} before you can queue an application.
        </div>
      ) : (
        <form action={createApplication} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Student <span className="text-red-500">*</span></span>
            <select name="student_id" required defaultValue="" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>— select a student —</option>
              {rows.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">University <span className="text-red-500">*</span></span>
            <select name="university_id" required defaultValue="" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="" disabled>— select a university —</option>
              {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Queue application
            </button>
            <Link href="/applications" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
