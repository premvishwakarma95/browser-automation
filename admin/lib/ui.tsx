// Shared UI helpers.

const STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  NEEDS_HUMAN: 'bg-amber-100 text-amber-800',
  READY_FOR_REVIEW: 'bg-purple-100 text-purple-700',
  SUBMITTED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  MISSING_DATA: 'bg-orange-100 text-orange-800',
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
