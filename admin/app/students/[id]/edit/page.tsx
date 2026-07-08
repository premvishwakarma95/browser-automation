import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { updateStudent } from '@/app/actions';
import { StudentFormFields } from '../../StudentFormFields';

export const dynamic = 'force-dynamic';

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseAdmin();
  const [{ data: student }, { data: docs }] = await Promise.all([
    sb.from('students').select('*').eq('id', id).single(),
    sb.from('documents').select('doc_type,file_name,uploaded_at').eq('student_id', id).order('uploaded_at'),
  ]);
  if (!student) notFound();

  const existingDocs: Record<string, string> = {};
  for (const d of docs ?? []) {
    if (d.file_name) existingDocs[d.doc_type] = d.file_name; // ordered ascending -> most recent wins
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/students" className="hover:underline">Students</Link>
        <span>/</span>
        <span>Edit</span>
      </div>
      <h1 className="text-2xl font-semibold">Edit student</h1>

      <form action={updateStudent} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <input type="hidden" name="student_id" value={student.id} />
        <StudentFormFields defaults={student} existingDocs={existingDocs} />
        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Save changes
          </button>
          <Link href="/students" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
