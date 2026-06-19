import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../app/store'
import { insertNotification, sendOrderEmail } from '../services/notificationsService'
import { ORDER_STEPS, statusIndex } from './OrderTracker'
import { isSuperAdmin, isOrderManager, isDeliveryManager } from '../utils/auth'
import { cancelOrder, updatePaymentStatus, ADMIN_CANCEL_STATUSES } from '../services/ordersService'
import { insertAuditLog } from '../services/auditService'
import { PaymentStatusBadge } from './PaymentStatusBadge'
import { useTranslation } from '../i18n'

const ACTION_LABELS = {
  confirming:       'Start Confirming',
  confirmed:        'Confirm Order',
  preparing:        'Start Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Mark Delivered',
}

const ORDER_MANAGER_STEPS  = new Set(['confirming', 'confirmed'])
const DELIVERY_STEPS       = new Set(['preparing', 'out_for_delivery', 'delivered'])

const PAYMENT_ACTIONS = ['paid', 'failed', 'refund_needed', 'refunded']

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

export function AdminOrderActions({ order, onUpdated }) {
  const { t } = useTranslation()
  const { state } = useStore()

  // Order status state
  const [loading, setLoading]           = useState(false)
  const [showMore, setShowMore]         = useState(false)
  const [advError, setAdvError]         = useState('')
  const [showCancel, setShowCancel]     = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError]   = useState('')

  // Payment status state
  const [paymentSel, setPaymentSel]       = useState('')
  const [refundReason, setRefundReason]   = useState('')
  const [refundRef, setRefundRef]         = useState('')
  const [payUpdating, setPayUpdating]     = useState(false)
  const [payUpdated, setPayUpdated]       = useState(false)
  const [payError, setPayError]           = useState('')

  const canAdminManage = isSuperAdmin(state.user) || isOrderManager(state.user)
  const canAdminCancel = canAdminManage && ADMIN_CANCEL_STATUSES.has(order.status)

  async function handleAdminCancel() {
    setCancelLoading(true)
    setCancelError('')
    const { error } = await cancelOrder({
      orderId: order.id,
      reason:  cancelReason,
      items:   order.items ?? [],
      payment: order.payment,
    })
    if (error) {
      setCancelError(`Cancel failed: ${error.message}`)
      setCancelLoading(false)
      return
    }
    insertAuditLog({
      adminUserId: state.user?.id,
      adminEmail:  state.user?.email,
      action:      'order_cancelled',
      targetType:  'order',
      targetId:    order.id,
      oldValue:    { status: order.status },
      newValue:    { status: 'cancelled', cancellation_reason: cancelReason.trim() || null },
    })
    setShowCancel(false)
    setCancelReason('')
    setCancelLoading(false)
    // If payment was online-now, local state should also reflect refund_needed
    const paymentUpdate = (order.payment?.method !== 'cod' && order.payment?.when === 'now')
      ? { payment_status: 'refund_needed' }
      : {}
    onUpdated?.({ status: 'cancelled', ...paymentUpdate })
  }

  async function handlePaymentUpdate() {
    if (!paymentSel) return
    setPayUpdating(true)
    setPayUpdated(false)
    setPayError('')
    const { error } = await updatePaymentStatus({
      orderId:         order.id,
      paymentStatus:   paymentSel,
      refundReason:    refundReason,
      refundReference: refundRef,
    })
    if (error) {
      setPayError(`Failed: ${error.message}`)
      setPayUpdating(false)
      return
    }
    insertAuditLog({
      adminUserId: state.user?.id,
      adminEmail:  state.user?.email,
      action:      `payment_status_changed_to_${paymentSel}`,
      targetType:  'order',
      targetId:    order.id,
      oldValue:    { payment_status: order.payment_status ?? 'pending' },
      newValue:    { payment_status: paymentSel },
    })
    setPayUpdating(false)
    setPayUpdated(true)
    setPaymentSel('')
    onUpdated?.({
      payment_status:   paymentSel,
      refund_reason:    paymentSel === 'refunded' || paymentSel === 'refund_needed' ? refundReason : undefined,
      refund_reference: paymentSel === 'refunded' ? refundRef : undefined,
      refunded_at:      paymentSel === 'refunded' ? new Date().toISOString() : undefined,
    })
  }

  const currentIndex     = statusIndex(order.status)
  const nextStep         = ORDER_STEPS[currentIndex + 1] ?? null
  const futureSteps      = ORDER_STEPS.slice(currentIndex + 2)
  const isCancelled      = order.status === 'cancelled'
  const isDelivered      = !isCancelled && currentIndex >= ORDER_STEPS.length - 1

  const canAdvanceTo = (targetStatus) => {
    if (isSuperAdmin(state.user))      return true
    if (isOrderManager(state.user))    return ORDER_MANAGER_STEPS.has(targetStatus)
    if (isDeliveryManager(state.user)) return DELIVERY_STEPS.has(targetStatus)
    return false
  }

  const allowedNextStep    = nextStep    && canAdvanceTo(nextStep.id)  ? nextStep  : null
  const allowedFutureSteps = futureSteps.filter((s) => canAdvanceTo(s.id))

  const advance = async (targetStatus) => {
    setLoading(true)
    setAdvError('')
    try {
      console.log(`[AdminOrderActions] advance() called — ${new Date().toISOString()} | orderId: ${order.id} | targetStatus: ${targetStatus} | currentLoading: ${loading}`)
      const { error } = await supabase
        .from('orders')
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id)
      if (error) {
        setAdvError(`Failed: ${error.message}`)
        setLoading(false)
        return
      }
      insertAuditLog({
        adminUserId: state.user?.id,
        adminEmail:  state.user?.email,
        action:      `order_status_changed_to_${targetStatus}`,
        targetType:  'order',
        targetId:    order.id,
        oldValue:    { status: order.status },
        newValue:    { status: targetStatus },
      })
      const notif = buildNotif(targetStatus, order.id)
      if (notif && order.user_id) {
        insertNotification({
          userId:    order.user_id,
          type:      `order_${targetStatus}`,
          message:   notif.en,
          messageAm: notif.am,
          link:      '/account',
        })
      }
      if ((targetStatus === 'confirmed' || targetStatus === 'delivered') && notif) {
        sendOrderEmail({
          toEmail: order.customer_email,
          toName:  order.customer_name,
          message: notif.en,
          orderId: order.id,
        })
      }
      setLoading(false)
      setShowMore(false)
      onUpdated?.({ status: targetStatus })
    } catch (err) {
      console.error('[AdminOrderActions] unexpected error:', err)
      setAdvError('Unexpected error — please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="admin-order-actions">
      {/* ── Order status controls ─────────────────────────────── */}
      {!isCancelled && !isDelivered && (
        <>
          {allowedNextStep && (
            <button
              type="button"
              className="btn btn-primary admin-order-actions__primary"
              onClick={() => advance(allowedNextStep.id)}
              disabled={loading || cancelLoading}
            >
              {loading ? '…' : `→ ${ACTION_LABELS[allowedNextStep.id] ?? allowedNextStep.id}`}
            </button>
          )}

          {allowedFutureSteps.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-secondary admin-order-actions__more"
                onClick={() => setShowMore((v) => !v)}
                aria-expanded={showMore}
                disabled={loading || cancelLoading}
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
                      onMouseDown={(e) => { e.preventDefault(); advance(step.id) }}
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
        </>
      )}

      {isCancelled && (
        <p style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 600, margin: 0 }}>
          ✗ Cancelled{order.cancellation_reason ? ` — ${order.cancellation_reason}` : ''}
        </p>
      )}

      {isDelivered && (
        <p style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600, margin: 0 }}>
          ✓ Delivered
        </p>
      )}

      {/* ── Cancel order ─────────────────────────────────────── */}
      {canAdminCancel && (
        <div style={{ marginTop: '0.4rem', width: '100%' }}>
          {showCancel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Cancellation reason (optional)"
                disabled={cancelLoading}
                style={{
                  width: '100%', minHeight: '52px', resize: 'vertical', fontSize: '0.82rem',
                  padding: '0.35rem 0.5rem', border: '1px solid var(--border)',
                  borderRadius: '6px', fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface)',
                }}
              />
              {cancelError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.78rem', margin: 0 }}>{cancelError}</p>
              )}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem', background: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={handleAdminCancel}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? '…' : 'Confirm Cancel'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }}
                  onClick={() => { setShowCancel(false); setCancelReason(''); setCancelError('') }}
                  disabled={cancelLoading}
                >
                  Keep
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => { setShowCancel(true); setCancelError('') }}
              disabled={loading}
            >
              ✕ Cancel Order
            </button>
          )}
        </div>
      )}

      {/* ── Payment status management (super_admin + order_manager) ── */}
      {canAdminManage && (
        <div className="dash-order__pay-section">
          <p className="dash-order__pay-section__label">{t('admin.paymentSection')}</p>
          <PaymentStatusBadge status={order.payment_status || 'pending'} />
          <div className="dash-order__pay-actions">
            {PAYMENT_ACTIONS.map((ps) => (
              <button
                key={ps}
                type="button"
                className={`pay-action-btn${paymentSel === ps ? ' pay-action-btn--active' : ''}`}
                onClick={() => { setPaymentSel((prev) => prev === ps ? '' : ps); setPayUpdated(false); setPayError('') }}
              >
                {t(`admin.mark${ps.charAt(0).toUpperCase() + ps.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`)}
              </button>
            ))}
          </div>

          {(paymentSel === 'refund_needed' || paymentSel === 'refunded') && (
            <input
              type="text"
              className="form-input"
              placeholder={t('admin.refundReason')}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              style={{ fontSize: '0.82rem', marginTop: '0.4rem' }}
            />
          )}
          {paymentSel === 'refunded' && (
            <input
              type="text"
              className="form-input"
              placeholder={t('admin.refundReference')}
              value={refundRef}
              onChange={(e) => setRefundRef(e.target.value)}
              style={{ fontSize: '0.82rem', marginTop: '0.3rem' }}
            />
          )}

          {paymentSel && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem', marginTop: '0.4rem' }}
              onClick={handlePaymentUpdate}
              disabled={payUpdating}
            >
              {payUpdating ? '…' : t('admin.updatePayment')}
            </button>
          )}
          {payUpdated && (
            <p style={{ color: 'var(--success)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {t('admin.paymentUpdated')}
            </p>
          )}
          {payError && (
            <p style={{ color: 'var(--danger)', fontSize: '0.78rem', margin: '0.25rem 0 0' }}>
              {payError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
