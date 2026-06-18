import { supabase } from './supabase'

/**
 * Normalise an Ethiopian phone number to E.164 (+251XXXXXXXXX).
 * Accepts: 09XXXXXXXX  → +2519XXXXXXXX
 *          07XXXXXXXX  → +2517XXXXXXXX
 *          +251...     → unchanged
 *          251...      → +251...
 *          9XXXXXXXX   → +2519XXXXXXXX  (digits only, no leading 0)
 */
export function formatPhone(raw) {
  const cleaned = raw.trim().replace(/[\s\-()]/g, '')
  if (cleaned.startsWith('+251')) return cleaned
  if (cleaned.startsWith('251')) return '+' + cleaned
  if (cleaned.startsWith('0')) return '+251' + cleaned.slice(1)
  if (/^[79]/.test(cleaned)) return '+251' + cleaned
  return cleaned
}

/**
 * Returns true for valid Ethiopian mobile numbers after normalisation.
 * Valid network prefixes after +251: 9x (Ethio Telecom) or 7x (Safaricom ET).
 */
export function isValidEthiopianPhone(raw) {
  return /^\+251[79]\d{8}$/.test(formatPhone(raw))
}

/**
 * Create a new account with email + password.
 * Phone is passed via options.data so the handle_new_user trigger can store it.
 * referralCode (optional) is stored in metadata so the trigger can link the referral.
 * Returns { data, error }. When data.session is null, email confirmation is required.
 */
export async function signUp(email, password, phone, name, referralCode) {
  const meta = {
    phone: formatPhone(phone),
    name:  (name || '').trim(),
  }
  if (referralCode && referralCode.trim()) {
    meta.referral_code_used = referralCode.trim().toUpperCase()
  }
  console.log('[signUp] attempting signup — email:', email, '| metadata being sent:', meta)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta },
  })
  if (error) {
    console.log('[signUp] error:', error.message, '| status:', error.status, '| code:', error.code)
  } else {
    console.log('[signUp] success — user id:', data?.user?.id, '| user metadata stored:', data?.user?.user_metadata)
    // Wait 1 s then check whether the trigger created the referral row
    if (meta.referral_code_used && data?.user?.id) {
      setTimeout(async () => {
        const { data: row, error: rowErr } = await supabase
          .from('referrals')
          .select('*')
          .eq('referred_user_id', data.user.id)
          .maybeSingle()
        console.log('[signUp] referrals row for new user (1 s after signup):', row, '| error:', rowErr)
      }, 1000)
    }
  }
  return { data, error }
}

/**
 * Sign in with email + password.
 * Returns { data, error }.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

/**
 * Fetch the profiles row for an authenticated user.
 *
 * On any error (row not found, RLS denial, network) this returns a safe
 * non-admin default so admin access is never accidentally granted on failure.
 */
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, phone, name, role, referral_code, referred_by, student_verified, student_discount_enabled')
    .eq('id', userId)
    .single()

  if (error) {
    // Profile row may not exist yet (handle_new_user trigger may be delayed).
    return { profile: { id: userId, email: '', phone: '', name: '', role: 'user' }, error: null }
  }
  return { profile: data, error: null }
}

/**
 * Check whether an email address is already registered in the profiles table.
 * Calls a SECURITY DEFINER RPC so it works for unauthenticated callers (RLS bypass).
 * Used during sign-in error handling to distinguish "wrong password" from "no account".
 * Returns { exists: boolean, error }.
 */
export async function checkEmailExists(email) {
  const { data, error } = await supabase.rpc('email_exists', {
    p_email: email.trim().toLowerCase(),
  })
  return { exists: !!data, error }
}

/**
 * Check whether a phone number is already registered in the profiles table.
 * Calls an RPC function (SECURITY DEFINER + GRANT TO anon) so this works
 * for unauthenticated users during sign-up validation.
 * Returns { exists: boolean, error }.
 */
export async function checkPhoneExists(raw) {
  const { data, error } = await supabase.rpc('phone_exists', {
    p_phone: formatPhone(raw),
  })
  return { exists: !!data, error }
}

/**
 * Update a user's profile name / phone, and optionally their auth password.
 * Requires an active authenticated session.
 * Returns { error }.
 */
export async function updateProfile({ userId, name, phone, newPassword }) {
  const profileUpdate = { name: (name || '').trim() }
  if (phone !== undefined && phone !== null && phone !== '') {
    profileUpdate.phone = formatPhone(phone)
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', userId)

  if (profileError) return { error: profileError }

  if (newPassword) {
    const { error: authError } = await supabase.auth.updateUser({ password: newPassword })
    if (authError) return { error: authError }
  }

  return { error: null }
}

/**
 * Sign out the current user.
 * Automatically triggers onAuthStateChange(SIGNED_OUT) in the store.
 */
export async function signOut() {
  return supabase.auth.signOut()
}

/**
 * Permanently delete a user account:
 *   1. Anonymizes the profiles row (clears name, phone, email, sets deleted_at).
 *   2. Replaces all personal data in orders with 'Deleted User' placeholders —
 *      order totals, items, payment records, and audit logs are left intact.
 *   3. Calls the delete_user() SECURITY DEFINER RPC to remove the auth.users
 *      row so the email address can be reused for a new account.
 *   4. Signs the client session out.
 * Returns { error }.
 */
export async function deleteAccount(userId) {
  // 1. Anonymize the profile row
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      name:             'Deleted User',
      phone:            null,
      email:            null,
      default_shipping: null,
      deleted_at:       new Date().toISOString(),
    })
    .eq('id', userId)

  if (profileErr) return { error: profileErr }

  // 2. Anonymize personal data in all orders for this user
  //    Shipping JSONB gets a placeholder; top-level contact columns are cleared.
  await supabase
    .from('orders')
    .update({
      shipping:        { fullName: 'Deleted User', phone: '—', city: '—', area: '—' },
      customer_name:   'Deleted User',
      customer_email:  null,
      customer_phone:  null,
    })
    .eq('user_id', userId)

  // 3. Hard-delete the auth.users row via SECURITY DEFINER RPC
  const { error: rpcErr } = await supabase.rpc('delete_user')
  if (rpcErr) console.error('[deleteAccount] delete_user RPC failed:', rpcErr.message)

  // 4. Sign out the client session (best-effort after RPC)
  await supabase.auth.signOut()

  return { error: rpcErr ?? null }
}

/**
 * Send a password-reset email. Always resolves without throwing — callers
 * should show a generic success message regardless of whether the email exists.
 */
export async function sendPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

/**
 * Update the signed-in user's password. Called from the reset-password page
 * after Supabase has verified the recovery token from the email link.
 * Returns { error }.
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  return { error }
}

/**
 * Fetch the user's saved default shipping address from their profile row.
 * Returns the parsed shipping object, or null on any error (including when
 * the default_shipping column doesn't yet exist in the table).
 */
export async function fetchDefaultShipping(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('default_shipping')
      .eq('id', userId)
      .single()
    if (error || !data?.default_shipping) return null
    return data.default_shipping
  } catch {
    return null
  }
}

/**
 * Persist the user's delivery details back to their profile row so future
 * checkouts can be pre-filled. Fire-and-forget — never blocks order placement.
 * Saves with canonical DB field names: { name, phone, city, subCity, landmark }.
 */
export async function saveDefaultShipping(userId, shipping) {
  try {
    const payload = {
      name:     (shipping.fullName || '').trim(),
      phone:    shipping.phone    || '',
      city:     shipping.city     || '',
      subCity:  shipping.area     || '',
      landmark: shipping.landmark || '',
    }
    await supabase
      .from('profiles')
      .update({ default_shipping: payload })
      .eq('id', userId)
  } catch {
    // Non-blocking: the order is already placed; localStorage already has it.
  }
}
