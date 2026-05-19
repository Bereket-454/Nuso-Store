import { supabase } from '../lib/supabase'

export const STUDENT_DISCOUNT_PCT = 0.05
export const STUDENT_DISCOUNT_CAP = 500

const BUCKET = 'student-ids'

export async function submitStudentVerification(userId, { schoolName, studentIdNumber, imageFile }) {
  const ext = imageFile.name.split('.').pop().toLowerCase()
  const uploadPath = `${userId}/${Date.now()}.${ext}`

  console.log('[studentVerification] inputs:', {
    userId,
    schoolName,
    studentIdNumber,
    fileName: imageFile?.name,
    fileSize: imageFile?.size,
    fileType: imageFile?.type,
    computedUploadPath: uploadPath,
  })

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(uploadPath, imageFile, { upsert: true, cacheControl: '3600' })

  console.log('[studentVerification] storage upload result:', {
    uploadData,
    uploadErr,
    storagePath: uploadData?.path ?? null,
  })

  if (uploadErr) {
    console.error('[studentVerification] upload failed — aborting insert:', uploadErr)
    return { error: uploadErr }
  }

  // Use the path Supabase actually stored (may differ from our computed string)
  const storedPath = uploadData?.path ?? uploadPath

  const payload = {
    user_id: userId,
    school_name: schoolName,
    student_id_number: studentIdNumber,
    id_image_path: storedPath,
    status: 'pending',
    reviewer_note: null,
    reviewed_at: null,
  }

  console.log('[studentVerification] attempting insert with payload:', payload)

  const { data: insertData, error: insertErr } = await supabase
    .from('student_verifications')
    .insert(payload)
    .select()
    .single()

  console.log('[studentVerification] insert result:', { insertData, insertErr })

  // Postgres duplicate key violation — row already exists for this user_id, update it instead
  if (insertErr) {
    const isDuplicate = insertErr.code === '23505' || insertErr.message?.includes('duplicate key')
    if (!isDuplicate) {
      console.error('[studentVerification] insert failed (not a duplicate):', insertErr)
      return { error: insertErr }
    }

    console.log('[studentVerification] duplicate detected — falling back to update for user_id:', userId)

    const { data: updateData, error: updateErr } = await supabase
      .from('student_verifications')
      .update({
        school_name: schoolName,
        student_id_number: studentIdNumber,
        id_image_path: storedPath,
        status: 'pending',
        reviewer_note: null,
        reviewed_at: null,
      })
      .eq('user_id', userId)
      .select()
      .single()

    console.log('[studentVerification] update result:', { updateData, updateErr })
    return { error: updateErr }
  }

  return { error: null }
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
