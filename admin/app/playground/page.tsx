import { supabaseAdmin } from '@/lib/supabaseServer';
import PlaygroundClient from './PlaygroundClient';

export const dynamic = 'force-dynamic';

export default async function PlaygroundPage() {
  const sb = supabaseAdmin();
  const [studentsRes, universitiesRes] = await Promise.all([
    sb
      .from('students')
      .select('id,full_name,email,phone,date_of_birth,nationality,passport_number,program,intake_year,selected_university_id')
      .order('full_name'),
    sb.from('universities').select('id,name,platform,portal_url,notes').order('name'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Playground</h1>
        <p className="mt-1 text-sm text-slate-500">
          Test the browser agent interactively — give it a task and watch it work, step by step.
        </p>
      </div>
      <PlaygroundClient students={studentsRes.data ?? []} universities={universitiesRes.data ?? []} />
    </div>
  );
}
