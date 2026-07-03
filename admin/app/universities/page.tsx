import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function UniversitiesPage() {
  const sb = supabaseAdmin();
  const { data: universities } = await sb
    .from('universities')
    .select('id,name,platform,portal_url,university_fields(count)')
    .order('name');

  const rows = universities ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Universities</h1>
          <p className="mt-1 text-sm text-slate-500">Configured portals and their required fields.</p>
        </div>
        <Link href="/universities/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
          + Add university
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Platform</th>
              <th className="px-5 py-3 font-semibold">Portal</th>
              <th className="px-5 py-3 font-semibold">Fields</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No universities yet.</td></tr>
            )}
            {rows.map((u) => {
              const fieldCount = (u.university_fields as { count: number }[] | null)?.[0]?.count ?? 0;
              return (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium">{u.name}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{u.platform}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {u.portal_url ? (
                      <a href={u.portal_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                        {u.portal_url.replace(/^https?:\/\//, '')}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{fieldCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
