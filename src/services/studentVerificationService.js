import { supabase } from '../lib/supabase'

export const STUDENT_DISCOUNT_PCT = 0.05
export const STUDENT_DISCOUNT_CAP = 500

const BUCKET = 'student-ids'

export async function submitStudentVerification(userId, { schoolName, studentIdNumber, imageFile }) {
  const ext = imageFile.name.split('.').pop().toLowerCase()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, imageFile, { upsert: true, cacheControl: '3600' })
  if (uploadErr) return { error: uploadErr }

  const { error } = await supabase.from('student_verifications').upsert(
    {
      user_id: userId,
      school_name: schoolName,
      student_id_number: studentIdNumber,
      id_image_path: path,
      status: 'pending',
      reviewer_note: null,
      reviewed_at: null,
    },
    { onConflict: 'user_id' },
  )
  return { error }
}

export async function getMyVerification(userId) {
  const { data, error } = await supabase
    .from('student_verifications')
    .select('id, school_name, student_id_number, status, reviewer_note, created_at')
    .eq('user_id', userId)
    .maybeSingle()
  return { data, error }
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function getAllVerifications() {
  const { data, error } = await supabase
    .from('student_verifications')
    .select('id, user_id, school_name, student_id_number, id_image_path, status, reviewer_note, created_at, reviewed_at')
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

export async function getSignedImageUrl(imagePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(imagePath, 300)
  return { url: data?.signedUrl ?? null, error }
}

export async function approveVerification(verificationId, userId) {
  const { error: vErr } = await supabase
    .from('student_verifications')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewer_note: null })
    .eq('id', verificationId)
  if (vErr) return { error: vErr }
  const { error } = await supabase
    .from('profiles')
    .update({ student_verified: true, student_discount_enabled: true })
    .eq('id', userId)
  return { error }
}

export async function rejectVerification(verificationId, userId, note) {
  const { error: vErr } = await supabase
    .from('student_verifications')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewer_note: note || null })
    .eq('id', verificationId)
  if (vErr) return { error: vErr }
  const { error } = await supabase
    .from('profiles')
    .update({ student_verified: false, student_discount_enabled: false })
    .eq('id', userId)
  return { error }
}
