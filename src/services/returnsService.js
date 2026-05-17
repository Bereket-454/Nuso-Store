import { supabase } from '../lib/supabase'

export const RETURN_REASONS = [
  { value: 'wrong_item',       label: 'Wrong item received' },
  { value: 'damaged',          label: 'Damaged or defective' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'changed_mind',     label: 'Changed my mind' },
  { value: 'other',            label: 'Other' },
]

export const RETURN_REASON_LABELS = Object.fromEntries(
  RETURN_REASONS.map(({ value, label }) => [value, label]),
)

export const RETURN_STATUS_LABELS = {
  pending:  'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
}

export async function submitReturnRequest(orderId, userId, reason, description) {
  const { data, error } = await supabase
    .from('return_requests')
    .insert({ order_id: orderId, user_id: userId, reason, description: (description || '').trim() })
    .select()
    .single()
  if (error) console.error('[submitReturnRequest] failed:', error.message)
  return { data, error }
}

export async function fetchReturnRequestsForUser(userId) {
  const { data, error } = await supabase
    .from('return_requests')
    .select('*')
    .eq('user_id', userId)
  if (error) console.error('[fetchReturnRequestsForUser] failed:', error.message)
  return { data: data ?? [], error }
}

export async function fetchAllReturnRequests() {
  const { data, error } = await supabase
    .from('return_requests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) console.error('[fetchAllReturnRequests] failed:', error.message)
  return { data: data ?? [], error }
}

/**
 * Approve or reject a return request.
 * Requires the admin_note column: ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS admin_note TEXT;
 */
export async function updateReturnStatus(id, status, adminNote) {
  const payload = { status }
  if (adminNote != null) payload.admin_note = adminNote.trim()
  const { data, error } = await supabase
    .from('return_requests')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) console.error('[updateReturnStatus] failed:', error.message)
  return { data, error }
}
