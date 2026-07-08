import Link from 'next/link';
import { createStudent } from '@/app/actions';
import { StudentFormFields } from '../StudentFormFields';

export const dynamic = 'force-dynamic';

export default function NewStudentPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/students" className="hover:underline">Students</Link>
        <span>/</span>
        <span>Add</span>
      </div>
      <h1 className="text-2xl font-semibold">Add student</h1>

      <form action={createStudent} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <StudentFormFields />
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
