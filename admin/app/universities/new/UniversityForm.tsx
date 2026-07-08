'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUniversity, type UniversityInput } from '@/app/actions';
import { DOCUMENT_TYPES } from '@/lib/documentTypes';

type FieldRow = { field_name: string; label: string; field_type: string; required: boolean };

const PLATFORMS = ['Universitaly', 'ESSE3', 'DreamApply', 'Custom'];
const FIELD_TYPES = ['text', 'email', 'number', 'date', 'select', 'file'];

const STARTER_FIELDS: FieldRow[] = [
  { field_name: 'full_name', label: 'Full name', field_type: 'text', required: true },
  { field_name: 'email', label: 'Email', field_type: 'email', required: true },
];

export default function UniversityForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('Custom');
  const [portalUrl, setPortalUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [fields, setFields] = useState<FieldRow[]>(STARTER_FIELDS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addField = () =>
    setFields((f) => [...f, { field_name: '', label: '', field_type: 'text', required: true }]);
  const removeField = (i: number) => setFields((f) => f.filter((_, idx) => idx !== i));
  const updateField = (i: number, patch: Partial<FieldRow>) =>
    setFields((f) => f.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const input: UniversityInput = {
      name: name.trim(),
      platform,
      portal_url: portalUrl.trim() || null,
      notes: notes.split('\n').map((n) => n.trim()).filter(Boolean),
      fields: fields.filter((f) => f.field_name.trim()),
    };
    try {
      await createUniversity(input);
      router.push('/universities');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">University name <span className="text-red-500">*</span></span>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Platform</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Portal URL</span>
            <input value={portalUrl} onChange={(e) => setPortalUrl(e.target.value)} placeholder="https://…"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Agent hints (one per line)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="e.g. Program dropdown uses codes, match by course name"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </div>

      {/* Form builder */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Required fields (form-builder)</h2>
          <button type="button" onClick={addField} className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50">
            + Add field
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              {f.field_type === 'file' ? (
                <select
                  value={f.field_name}
                  onChange={(e) => {
                    const doc = DOCUMENT_TYPES.find((d) => d.key === e.target.value);
                    updateField(i, { field_name: e.target.value, label: doc?.label ?? '' });
                  }}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">— choose document —</option>
                  {DOCUMENT_TYPES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              ) : (
                <input placeholder="field_name (key)" value={f.field_name} onChange={(e) => updateField(i, { field_name: e.target.value })}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              )}
              <input placeholder="Label" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              <select
                value={f.field_type}
                onChange={(e) => {
                  const field_type = e.target.value;
                  // Switching to "file" resets field_name so it always comes from the
                  // fixed document-type list below — that's what lets the worker match
                  // this field to a specific uploaded document by key, no fuzzy matching.
                  updateField(i, { field_type, field_name: field_type === 'file' ? '' : f.field_name });
                }}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs text-gray-600">
                <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                req
              </label>
              <button type="button" onClick={() => removeField(i)} className="px-2 text-gray-400 hover:text-red-500">✕</button>
            </div>
          ))}
          {fields.length === 0 && <p className="text-sm text-gray-400">No fields — add at least one.</p>}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save university'}
        </button>
        <button type="button" onClick={() => router.push('/universities')}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
