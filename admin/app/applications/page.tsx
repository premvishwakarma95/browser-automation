import { supabaseAdmin } from '@/lib/supabaseServer';
import { StatusBadge } from '@/lib/ui';
import { approveApplication } from '@/app/actions';

export const dynamic = 'force-dynamic';

type FilledField = { label: string; value: string };

export default async function ApplicationsPage() {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from('applications')
    .select('id,status,created_at,filled_fields,missing_fields,error,students(full_name),universities(name)')
    .order('created_at', { ascending: false });

  const apps = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
        <p className="mt-1 text-sm text-slate-500">
          The worker fills each form and saves a draft. Review the filled data, then approve to mark it submitted.
        </p>
      </div>

      <div className="space-y-4">
        {apps.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">
            No applications yet. Queue one from the Students page.
          </div>
        )}

        {apps.map((a) => {
          const student = (a.students as { full_name?: string } | null)?.full_name ?? '—';
          const uni = (a.universities as { name?: string } | null)?.name ?? '—';
          const filled = (a.filled_fields as FilledField[] | null) ?? [];
          const missing = (a.missing_fields as string[] | null) ?? [];

          return (
            <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">
                    {student} <span className="text-slate-400">→</span> {uni}
                  </div>
                  <div className="mt-1.5"><StatusBadge status={a.status} /></div>
                </div>
                {a.status === 'READY_FOR_REVIEW' && (
                  <form action={approveApplication}>
                    <input type="hidden" name="application_id" value={a.id} />
                    <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                      Approve &amp; mark submitted
                    </button>
                  </form>
                )}
              </div>

              {filled.length > 0 && (
                <div className="mt-4 rounded-lg bg-slate-50 p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Filled fields (draft)</div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                    {filled.map((f, i) => (
                      <div key={i} className="flex justify-between border-b border-slate-100 py-1">
                        <span className="text-slate-500">{f.label}</span>
                        <span className="font-medium">{String(f.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {missing.length > 0 && (
                <div className="mt-3 text-sm text-amber-600">Missing required fields: {missing.join(', ')}</div>
              )}
              {a.error && <div className="mt-3 text-sm text-red-600">Error: {a.error}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
