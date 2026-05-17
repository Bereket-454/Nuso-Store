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
  const payload = {
    status:              'cancelled',
    cancelled_at:        new Date().toISOString(),
    cancellation_reason: (reason || '').trim(),
  }

  console.log('[cancelOrder] STEP 1 — about to update order in Supabase')
  console.log('[cancelOrder] orderId:', orderId)
  console.log('[cancelOrder] payload:', payload)
  console.log('[cancelOrder] query: UPDATE orders SET', payload, 'WHERE id =', orderId)

  const { data: updateData, error: updateErr } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId)
    .select('id, status, cancelled_at, cancellation_reason')

  console.log('[cancelOrder] STEP 2 — Supabase update result:')
  console.log('  data :', updateData)
  console.log('  error:', updateErr)

  if (updateErr) {
    console.error('[cancelOrder] order update FAILED with error:', updateErr.message, updateErr)
    return { error: updateErr }
  }

  if (!updateData || updateData.length === 0) {
    const rlsMsg = `[cancelOrder] order update returned 0 rows — order "${orderId}" was NOT changed in the database.`
      + '\n  This is almost always an RLS (Row Level Security) policy blocking the UPDATE.'
      + '\n  Fix: run this SQL in your Supabase dashboard → SQL editor:'
      + '\n\n  -- Allow authenticated users to cancel their own orders:'
      + '\n  CREATE POLICY "Users can update own orders" ON orders'
      + '\n  FOR UPDATE TO authenticated'
      + '\n  USING  (auth.uid() = user_id)'
      + '\n  WITH CHECK (auth.uid() = user_id);'
      + '\n\n  -- Allow admin roles to update any order:'
      + '\n  CREATE POLICY "Admins can update any order" ON orders'
      + '\n  FOR UPDATE TO authenticated'
      + '\n  USING  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN (\'super_admin\',\'order_manager\',\'delivery_manager\')))'
      + '\n  WITH CHECK (true);'
    console.error(rlsMsg)
    return { error: new Error('Order not updated — RLS policy likely blocking write. See console for required SQL.') }
  }

  console.log('[cancelOrder] STEP 3 — order row updated successfully:', updateData)

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
