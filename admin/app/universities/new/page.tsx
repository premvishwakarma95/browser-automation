import Link from 'next/link';
import UniversityForm from './UniversityForm';

export default function NewUniversityPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/universities" className="hover:underline">Universities</Link>
        <span>/</span>
        <span>Add</span>
      </div>
      <h1 className="text-2xl font-semibold">Add university</h1>
      <UniversityForm />
    </div>
  );
}
