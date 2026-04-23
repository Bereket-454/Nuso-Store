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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta },
  })
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
    .select('id, email, phone, name, role, referral_code, referred_by')
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
