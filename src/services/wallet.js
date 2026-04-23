import { supabase } from '../lib/supabase'

/**
 * Fetch the current wallet balance for a user.
 * Returns 0 if the user has no wallet row yet (i.e. never received a credit).
 */
export async function getWalletBalance(userId) {
  const { data, error } = await supabase
    .from('wallets')
    .select('balance_etb')
    .eq('user_id', userId)
    .single()

  // PGRST116 = "no rows returned" — user simply has no wallet yet.
  if (error && error.code !== 'PGRST116') {
    console.error('[wallet] getWalletBalance error:', error)
    return { balance: 0, error }
  }
  return { balance: Number(data?.balance_etb ?? 0), error: null }
}

/**
 * Deduct wallet credit from the user's balance.
 * Called after Telebirr payment is confirmed during checkout.
 * Returns { success: boolean, newBalance?: number }.
 */
export async function useWalletCredit(userId, amount, orderId) {
  const { data, error } = await supabase.rpc('use_wallet_credit', {
    p_user_id:  userId,
    p_amount:   amount,
    p_order_id: orderId,
  })
  if (error) {
    console.error('[wallet] use_wallet_credit error:', error)
    return { success: false, error }
  }
  console.log('[wallet] use_wallet_credit result:', data)
  return {
    success:    data?.success ?? false,
    newBalance: data?.new_balance ?? 0,
    error:      null,
  }
}

/**
 * Fetch the last 20 wallet transactions for a user (newest first).
 */
export async function getWalletTransactions(userId) {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('id, type, amount_etb, reference, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return { transactions: data ?? [], error }
}
