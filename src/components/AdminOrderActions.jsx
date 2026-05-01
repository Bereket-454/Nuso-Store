import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../app/store'
import { insertNotification, sendOrderEmail } from '../services/notificationsService'
import { ORDER_STEPS, resolveStatus, statusIndex } from './OrderTracker'
import { isSuperAdmin, isOrderManager, isDeliveryManager } from '../utils/auth'

// What the admin button says for each target status
const ACTION_LABELS = {
  confirming:       'Start Confirming',
  confirmed:        'Confirm Order',
  preparing:        'Start Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Mark Delivered',
}

// Role-based step access — which statuses each role may advance an order to
const ORDER_MANAGER_STEPS  = new Set(['confirming', 'confirmed'])
const DELIVERY_STEPS       = new Set(['preparing', 'out_for_delivery', 'delivered'])

// Notification copy sent to the customer when admin advances the order
function buildNotif(targetStatus, orderId) {
  const map = {
    confirming:       { en: `⏳ We received your order ${orderId} and are verifying it`,    am: `⏳ ትዕዛዝዎ ${orderId} ደርሶናል፣ እናረጋግጣለን` },
    confirmed:        { en: `✅ Your order ${orderId} has been confirmed`,                   am: `✅ ትዕዛዝዎ ${orderId} ተረጋግጧል` },
    preparing:        { en: `📦 Your order ${orderId} is being prepared`,                    am: `📦 ትዕዛዝዎ ${orderId} እየተዘጋጀ ነው` },
    out_for_delivery: { en: `🚚 Your order ${orderId} is out for delivery`,                 am: `🚚 ትዕዛዝዎ ${orderId} ወደ እርስዎ ሲሄድ ነው` },
    delivered:        { en: `🎉 Your order ${orderId} has been delivered! Thank you.`,      am: `🎉 ትዕዛዝዎ ${orderId} ደርሷል! አመሰግናለን።` },
  }
  return map[targetStatus] ?? null
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AdminOrderActions({ order, onUpdated }) {
  const [loading, setLoading] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [advError, setAdvError] = useState('')
  const { state } = useStore()

  const currentIndex = statusIndex(order.status)
  const nextStep     = ORDER_STEPS[currentIndex + 1] ?? null
  // All forward steps beyond the immediate next (for skip/edge-case use)
  const futureSteps  = ORDER_STEPS.slice(currentIndex + 2)

  const canAdvanceTo = (targetStatus) => {
    if (isSuperAdmin(state.user))      return true
    if (isOrderManager(state.user))    return ORDER_MANAGER_STEPS.has(targetStatus)
    if (isDeliveryManager(state.user)) return DELIVERY_STEPS.has(targetStatus)
    return false
  }

  const allowedNextStep    = nextStep   && canAdvanceTo(nextStep.id)  ? nextStep  : null
  const allowedFutureSteps = futureSteps.filter(s => canAdvanceTo(s.id))

  const advance = async (targetStatus) => {
    setLoading(true)
    setAdvError('')

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id)

      if (error) {
        console.error('[AdminOrderActions] status update failed:', error.message)
        setAdvError(`Failed: ${error.message}`)
        setLoading(false)
        return
      }

      // Fire notifications (non-blocking)
      const notif = buildNotif(targetStatus, order.id)
      if (notif && order.user_id) {
        insertNotification({
          userId: order.user_id,
          type: `order_${targetStatus}`,
          message: notif.en,
          messageAm: notif.am,
          link: '/account',
        })
      }

      // Email on key milestones
      if ((targetStatus === 'confirmed' || targetStatus === 'delivered') && notif) {
        sendOrderEmail({
          toEmail: order.customer_email,
          toName: order.customer_name,
          message: notif.en,
          orderId: order.id,
        })
      }

      setLoading(false)
      setShowMore(false)
      onUpdated?.(targetStatus)
    } catch (err) {
      console.error('[AdminOrderActions] unexpected error:', err)
      setAdvError('Unexpected error — please try again.')
      setLoading(false)
    }
  }

  // Order is fully delivered — nothing left to do
  if (currentIndex >= ORDER_STEPS.length - 1) {
    return (
      <p style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600, margin: 0 }}>
        ✓ Delivered
      </p>
    )
  }

  // No allowed actions for this user at this order stage
  if (!allowedNextStep && allowedFutureSteps.length === 0) return null

  return (
    <div className="admin-order-actions">
      {/* Primary: advance to next allowed step */}
      {allowedNextStep && (
        <button
          type="button"
          className="btn btn-primary admin-order-actions__primary"
          onClick={() => advance(allowedNextStep.id)}
          disabled={loading}
        >
          {loading ? '…' : `→ ${ACTION_LABELS[allowedNextStep.id] ?? allowedNextStep.id}`}
        </button>
      )}

      {/* Secondary: jump to an allowed step further ahead */}
      {allowedFutureSteps.length > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary admin-order-actions__more"
            onClick={() => setShowMore((v) => !v)}
            aria-expanded={showMore}
            disabled={loading}
          >
            ⋯
          </button>
          {showMore && (
            <div className="admin-order-actions__menu">
              {allowedFutureSteps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className="admin-order-actions__menu-item"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    advance(step.id)
                  }}
                >
                  {ACTION_LABELS[step.id] ?? step.id}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {advError && (
        <p style={{ color: 'var(--danger)', fontSize: '0.78rem', margin: '0.25rem 0 0', width: '100%' }}>
          {advError}
        </p>
      )}
    </div>
  )
}
