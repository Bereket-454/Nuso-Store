import { supabase } from '../lib/supabase'

// Statuses from which a customer may request cancellation
export const CUSTOMER_CANCEL_STATUSES = new Set(['order_received', 'confirming', 'confirmed'])

// Statuses from which an admin may cancel (anything before delivered)
export const ADMIN_CANCEL_STATUSES = new Set([
  'order_received', 'confirming', 'confirmed', 'preparing', 'out_for_delivery',
])

/**
 * Cancel an order and restore product stock.
 * Works for both customer self-service and admin cancellation.
 *
 * @param {string} orderId
 * @param {string} reason  - free-text cancellation reason
 * @param {Array}  items   - order items array (each needs .productId and .quantity)
 * @returns {{ error }}
 */
export async function cancelOrder({ orderId, reason, items }) {
  // 1. Mark order cancelled in Supabase
  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      status:               'cancelled',
      cancelled_at:         new Date().toISOString(),
      cancellation_reason:  (reason || '').trim(),
    })
    .eq('id', orderId)

  if (updateErr) {
    console.error('[cancelOrder] order update failed:', updateErr.message, updateErr)
    return { error: updateErr }
  }

  // 2. Restore stock for every item in the order
  if (!items || items.length === 0) return { error: null }

  const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))]
  if (productIds.length === 0) return { error: null }

  const { data: stockRows, error: stockFetchErr } = await supabase
    .from('products')
    .select('id, stock')
    .in('id', productIds)

  if (stockFetchErr) {
    console.error('[cancelOrder] stock fetch failed — stock NOT restored:', stockFetchErr.message)
    return { error: null } // order is cancelled; stock restore is best-effort
  }

  const stockMap = Object.fromEntries((stockRows || []).map((p) => [p.id, p.stock]))

  const restores = items.map((item) =>
    supabase
      .from('products')
      .update({ stock: (stockMap[item.productId] ?? 0) + (item.quantity ?? 1) })
      .eq('id', item.productId)
      .select('id, stock'),
  )

  const results = await Promise.all(restores)
  results.forEach(({ data, error }) => {
    if (error) {
      console.error('[cancelOrder] stock restore failed for item:', error.message, error)
    } else {
      console.log('[cancelOrder] stock restored:', data)
    }
  })

  return { error: null }
}
