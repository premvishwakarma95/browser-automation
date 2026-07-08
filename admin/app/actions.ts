'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { DOCUMENT_TYPES } from '@/lib/documentTypes';

const str = (fd: FormData, k: string) => {
  const v = (fd.get(k) as string | null)?.trim();
  return v ? v : null;
};

// Uploads any files present in formData under `doc_<key>` (see DOCUMENT_TYPES)
// to Storage and records each as a `documents` row. Shared by create + update
// so a student can pick up new/replacement documents either way.
async function uploadStudentDocuments(sb: ReturnType<typeof supabaseAdmin>, studentId: string, formData: FormData) {
  for (const { key, label } of DOCUMENT_TYPES) {
    const file = formData.get(`doc_${key}`);
    if (!(file instanceof File) || file.size === 0) continue;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${studentId}/${key}-${Date.now()}-${safeName}`;
    const { error: uploadErr } = await sb.storage
      .from('documents')
      .upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (uploadErr) throw new Error(`Failed to upload ${label}: ${uploadErr.message}`);

    const { error: docErr } = await sb.from('documents').insert({
      student_id: studentId,
      doc_type: key,
      storage_path: path,
      file_name: file.name,
    });
    if (docErr) throw new Error(docErr.message);
  }
}

// --- Students ---------------------------------------------------------------
export async function createStudent(formData: FormData) {
  const sb = supabaseAdmin();
  const { data: student, error } = await sb
    .from('students')
    .insert({
      full_name: str(formData, 'full_name'),
      email: str(formData, 'email'),
      phone: str(formData, 'phone'),
      date_of_birth: str(formData, 'date_of_birth'),
      nationality: str(formData, 'nationality'),
      passport_number: str(formData, 'passport_number'),
      program: str(formData, 'program'),
      intake_year: str(formData, 'intake_year'),
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  await uploadStudentDocuments(sb, student.id, formData);

  revalidatePath('/students');
  redirect('/students');
}

export async function updateStudent(formData: FormData) {
  const sb = supabaseAdmin();
  const studentId = str(formData, 'student_id');
  if (!studentId) throw new Error('student_id required');

  const { error } = await sb
    .from('students')
    .update({
      full_name: str(formData, 'full_name'),
      email: str(formData, 'email'),
      phone: str(formData, 'phone'),
      date_of_birth: str(formData, 'date_of_birth'),
      nationality: str(formData, 'nationality'),
      passport_number: str(formData, 'passport_number'),
      program: str(formData, 'program'),
      intake_year: str(formData, 'intake_year'),
    })
    .eq('id', studentId);
  if (error) throw new Error(error.message);

  await uploadStudentDocuments(sb, studentId, formData);

  revalidatePath('/students');
  redirect('/students');
}

// --- Universities (with form-builder fields) --------------------------------
export type UniversityInput = {
  name: string;
  platform: string;
  portal_url: string | null;
  notes: string[];
  fields: { field_name: string; label: string; field_type: string; required: boolean }[];
};

export async function createUniversity(input: UniversityInput) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('universities')
    .insert({
      name: input.name,
      platform: input.platform,
      portal_url: input.portal_url,
      notes: input.notes,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  if (input.fields.length) {
    const rows = input.fields
      .filter((f) => f.field_name.trim())
      .map((f, i) => ({
        university_id: data.id,
        field_name: f.field_name.trim(),
        label: f.label.trim() || f.field_name.trim(),
        field_type: f.field_type,
        required: f.required,
        sort_order: i + 1,
      }));
    if (rows.length) {
      const { error: fErr } = await sb.from('university_fields').insert(rows);
      if (fErr) throw new Error(fErr.message);
    }
  }
  revalidatePath('/universities');
}

// --- Applications (queue a job) ---------------------------------------------
export async function createApplication(formData: FormData) {
  const sb = supabaseAdmin();
  const studentId = str(formData, 'student_id');
  const universityId = str(formData, 'university_id');
  if (!studentId) throw new Error('student_id required');
  if (!universityId) throw new Error('university_id required');

  const { error } = await sb.from('applications').insert({
    student_id: studentId,
    university_id: universityId,
    status: 'NOT_STARTED',
  });
  if (error) throw new Error(error.message);
  revalidatePath('/applications');
  revalidatePath('/');
  redirect('/applications');
}

// --- Human review: approve a drafted application -> mark SUBMITTED -----------
export async function approveApplication(formData: FormData) {
  const sb = supabaseAdmin();
  const appId = str(formData, 'application_id');
  if (!appId) throw new Error('application_id required');

  const { error } = await sb
    .from('applications')
    .update({ status: 'SUBMITTED', completed_at: new Date().toISOString() })
    .eq('id', appId);
  if (error) throw new Error(error.message);

  await sb
    .from('pending_actions')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: 'admin' })
    .eq('application_id', appId)
    .eq('status', 'open');

  revalidatePath('/applications');
  revalidatePath('/');
}
