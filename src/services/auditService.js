import { supabase } from '../lib/supabase'

/**
 * Fire-and-forget audit log insert. Never throws — failures are logged to console only.
 */
export async function insertAuditLog({ adminUserId, adminEmail, action, targetType, targetId, oldValue, newValue }) {
  const { error } = await supabase.from('admin_audit_logs').insert({
    admin_user_id: adminUserId,
    admin_email:   adminEmail,
    action,
    target_type:   targetType,
    target_id:     String(targetId ?? ''),
    old_value:     oldValue  != null ? JSON.stringify(oldValue)  : null,
    new_value:     newValue  != null ? JSON.stringify(newValue)  : null,
  })
  if (error) console.error('[auditLog] insert failed:', error.message, error)
}

export async function fetchAuditLogs({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[auditLog] fetch failed:', error.message)
    return []
  }
  return data ?? []
}
