import { supabase } from '../lib/supabase'

/**
 * Fetch referral stats (code, counts, wallet balance) for the signed-in user.
 * Calls the SECURITY DEFINER RPC so no direct table access is needed.
 */
export async function getReferralStats(userId) {
  const { data, error } = await supabase.rpc('get_referral_stats', {
    p_user_id: userId,
  })
  if (error) {
    console.error('[referral] get_referral_stats error:', error)
    return { stats: null, error }
  }
  return { stats: data, error: null }
}

/**
 * Quick existence check for a referral code — anon-accessible.
 * Used to validate the code in the sign-up form before submission.
 */
export async function checkReferralCodeExists(code) {
  if (!code || !code.trim()) return { exists: false, error: null }
  const { data, error } = await supabase.rpc('referral_code_exists', {
    p_code: code.trim().toUpperCase(),
  })
  return { exists: !!data, error }
}

/**
 * Award 100 ETB to the referrer after a successful first-order payment.
 * Must be called after payment is confirmed — safe to call multiple times (idempotent).
 * Returns { rewarded: boolean, reason?: string }.
 */
export async function completeReferralReward(orderId, userId) {
  const { data, error } = await supabase.rpc('complete_referral_reward', {
    p_order_id: orderId,
    p_user_id:  userId,
  })
  if (error) {
    console.error('[referral] complete_referral_reward error:', error)
    return { rewarded: false, error }
  }
  console.log('[referral] complete_referral_reward result:', data)
  return { rewarded: data?.rewarded ?? false, error: null }
}
