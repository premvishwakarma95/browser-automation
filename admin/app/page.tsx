import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { StatusBadge } from '@/lib/ui';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sb = supabaseAdmin();

  const [{ count: studentCount }, { count: uniCount }, appsRes, pendingRes] = await Promise.all([
    sb.from('students').select('*', { count: 'exact', head: true }),
    sb.from('universities').select('*', { count: 'exact', head: true }),
    sb
      .from('applications')
      .select('id,status,created_at,students(full_name),universities(name)')
      .order('created_at', { ascending: false })
      .limit(10),
    sb.from('pending_actions').select('id,kind,application_id').eq('status', 'open'),
  ]);

  const apps = appsRes.data ?? [];
  const pending = pendingRes.data ?? [];

  const byStatus = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Overview of students, universities, and application progress.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Students" value={studentCount ?? 0} href="/students" accent="indigo" />
        <Stat label="Universities" value={uniCount ?? 0} href="/universities" accent="sky" />
        <Stat label="Applications" value={apps.length} href="/applications" accent="violet" />
        <Stat label="Pending actions" value={pending.length} href="/applications" accent="amber" highlight={pending.length > 0} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent applications</h2>
          <Link href="/applications" className="text-sm font-medium text-indigo-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Student</th>
                <th className="px-5 py-3 font-semibold">University</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-slate-400">No applications yet.</td>
                </tr>
              )}
              {apps.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium">{(a.students as { full_name?: string } | null)?.full_name ?? '—'}</td>
                  <td className="px-5 py-3 text-slate-600">{(a.universities as { name?: string } | null)?.name ?? '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {Object.keys(byStatus).length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {Object.entries(byStatus).map(([s, n]) => `${s.replace(/_/g, ' ')}: ${n}`).join('   ·   ')}
          </p>
        )}
      </section>
    </div>
  );
}

const ACCENTS: Record<string, string> = {
  indigo: 'text-indigo-600',
  sky: 'text-sky-600',
  violet: 'text-violet-600',
  amber: 'text-amber-600',
};

function Stat({
  label, value, href, accent, highlight,
}: { label: string; value: number; href: string; accent: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        highlight ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
      }`}
    >
      <div className={`text-4xl font-bold ${ACCENTS[accent] ?? 'text-slate-900'}`}>{value}</div>
      <div className="mt-2 text-sm font-medium text-slate-500">{label}</div>
    </Link>
  );
}
