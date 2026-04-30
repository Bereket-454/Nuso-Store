import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { insertNotification, sendOrderEmail } from '../services/notificationsService'
import { ORDER_STEPS, resolveStatus, statusIndex } from './OrderTracker'

// What the admin button says for each target status
const ACTION_LABELS = {
  confirming:       'Start Confirming',
  confirmed:        'Confirm Order',
  preparing:        'Start Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Mark Delivered',
}

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

  const currentIndex = statusIndex(order.status)
  const nextStep = ORDER_STEPS[currentIndex + 1] ?? null
  // All forward steps beyond the immediate next (for skip/edge-case use)
  const futureSteps = ORDER_STEPS.slice(currentIndex + 2)

  const advance = async (targetStatus) => {
    setLoading(true)
    setShowMore(false)

    const { error } = await supabase
      .from('orders')
      .update({ status: targetStatus, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    if (error) {
      console.error('[AdminOrderActions] status update failed:', error.message)
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
    onUpdated?.(targetStatus)
  }

  // Order is fully delivered — nothing left to do
  if (currentIndex >= ORDER_STEPS.length - 1) {
    return (
      <p style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600, margin: 0 }}>
        ✓ Delivered
      </p>
    )
  }

  return (
    <div className="admin-order-actions">
      {/* Primary: advance to next step */}
      {nextStep && (
        <button
          className="btn btn-primary admin-order-actions__primary"
          onClick={() => advance(nextStep.id)}
          disabled={loading}
        >
          {loading ? '…' : `→ ${ACTION_LABELS[nextStep.id] ?? nextStep.id}`}
        </button>
      )}

      {/* Secondary: jump to a step further ahead */}
      {futureSteps.length > 0 && (
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
              {futureSteps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  className="admin-order-actions__menu-item"
                  onClick={() => advance(step.id)}
                >
                  {ACTION_LABELS[step.id] ?? step.id}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
