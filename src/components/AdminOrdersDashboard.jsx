import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../app/store'
import { useTranslation } from '../i18n'
import { birr } from '../utils/format'
import { resolveStatus, ORDER_STEPS, statusIndex } from './OrderTracker'
import { AdminOrderActions } from './AdminOrderActions'
import { PaymentStatusBadge } from './PaymentStatusBadge'
import { isSuperAdmin, isOrderManager, isDeliveryManager } from '../utils/auth'
import { supabase } from '../lib/supabase'
import { insertNotification, sendOrderEmail } from '../services/notificationsService'
import { insertAuditLog } from '../services/auditService'
import { archiveOrder, unarchiveOrder } from '../services/ordersService'
import { fetchAllReturnRequests, updateReturnStatus, RETURN_REASON_LABELS, RETURN_STATUS_LABELS } from '../services/returnsService'

// ── Role + step constants ─────────────────────────────────────────────────────

const ORDER_MANAGER_STEPS = new Set(['confirming', 'confirmed'])
const DELIVERY_STEPS      = new Set(['preparing', 'out_for_delivery', 'delivered'])

const ACTION_LABELS = {
  confirming:       'Start Confirming',
  confirmed:        'Confirm Order',
  preparing:        'Start Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered:        'Mark Delivered',
}

const NOTIF_MAP = {
  confirming:       { en: (id) => `⏳ We received your order ${id} and are verifying it`,    am: (id) => `⏳ ትዕዛዝዎ ${id} ደርሶናል፣ እናረጋግጣለን` },
  confirmed:        { en: (id) => `✅ Your order ${id} has been confirmed`,                   am: (id) => `✅ ትዕዛዝዎ ${id} ተረጋግጧል` },
  preparing:        { en: (id) => `📦 Your order ${id} is being prepared`,                    am: (id) => `📦 ትዕዛዝዎ ${id} እየተዘጋጀ ነው` },
  out_for_delivery: { en: (id) => `🚚 Your order ${id} is out for delivery`,                 am: (id) => `🚚 ትዕዛዝዎ ${id} ወደ እርስዎ ሲሄድ ነው` },
  delivered:        { en: (id) => `🎉 Your order ${id} has been delivered! Thank you.`,      am: (id) => `🎉 ትዕዛዝዎ ${id} ደርሷል! አመሰግናለን።` },
}

// ── Tab + summary config ──────────────────────────────────────────────────────

const TAB_FILTERS = {
  all:        () => true,
  new:        (o) => o.status === 'order_received',
  confirming: (o) => o.status === 'confirming',
  preparing:  (o) => o.status === 'confirmed' || o.status === 'preparing',
  delivery:   (o) => o.status === 'out_for_delivery',
  completed:  (o) => o.status === 'delivered',
  cancelled:  (o) => o.status === 'cancelled',
  refunds:    (o) => o.payment_status === 'refund_needed' || o.payment_status === 'refunded',
}

const TABS = [
  { id: 'all',        label: 'All' },
  { id: 'new',        label: 'New' },
  { id: 'confirming', label: 'Confirming' },
  { id: 'preparing',  label: 'Preparing' },
  { id: 'delivery',   label: 'Delivery' },
  { id: 'completed',  label: 'Completed' },
  { id: 'cancelled',  label: 'Cancelled' },
  { id: 'refunds',    label: 'Refunds' },
  { id: 'returns',    label: 'Returns' },
  { id: 'archived',   label: 'Archived' },
]

const ARCHIVABLE_STATUSES = new Set(['delivered', 'cancelled'])
const isArchivable = (o) =>
  !o.is_archived && (ARCHIVABLE_STATUSES.has(o.status) || o.payment_status === 'refunded')

const SUMMARY_GROUPS = [
  { key: 'new',       label: 'New',           tab: 'new',        accent: '#2563eb', filter: (o) => o.status === 'order_received' },
  { key: 'conf',      label: 'Confirming',    tab: 'confirming', accent: '#7c3aed', filter: (o) => o.status === 'confirming' },
  { key: 'prep',      label: 'Preparing',     tab: 'preparing',  accent: '#c45100', filter: (o) => o.status === 'confirmed' || o.status === 'preparing' },
  { key: 'deliv',     label: 'Delivery',      tab: 'delivery',   accent: '#0891b2', filter: (o) => o.status === 'out_for_delivery' },
  { key: 'done',      label: 'Delivered',     tab: 'completed',  accent: '#15803d', filter: (o) => o.status === 'delivered' },
  { key: 'cancelled', label: 'Cancelled',     tab: 'cancelled',  accent: '#6b7280', filter: (o) => o.status === 'cancelled' },
  { key: 'refund',    label: 'Refund Needed', tab: 'refunds',    accent: '#b45309', filter: (o) => o.payment_status === 'refund_needed' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusBadgeClass(status) {
  const map = {
    order_received:   'received',
    confirming:       'confirming',
    confirmed:        'confirmed',
    preparing:        'packed',
    out_for_delivery: 'on-the-way',
    delivered:        'delivered',
    cancelled:        'cancelled',
  }
  return `dash-status--${map[resolveStatus(status)] ?? 'received'}`
}

// ── Order Detail Modal ────────────────────────────────────────────────────────

function OrderDetailModal({ order, onClose, onUpdated }) {
  const { t } = useTranslation()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const items    = order.items    ?? []
  const shipping = order.shipping ?? {}
  const payment  = order.payment  ?? {}

  const paymentLabel =
    payment.method === 'cod'      ? 'Cash on Delivery'
    : payment.method === 'telebirr' ? 'Telebirr'
    : payment.method === 'cbe'      ? 'CBE Bank Transfer'
    : payment.method               ?? '—'

  const paymentWhen =
    payment.when === 'now'   ? ' · Screenshot uploaded'
    : payment.when === 'after' ? ' · Pay after confirmation'
    : ''

  return (
    <div
      className="aod-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Order details"
    >
      <div className="aod-modal">
        {/* Sticky header */}
        <div className="aod-modal__header">
          <div>
            <p className="aod-modal__order-id">{order.id}</p>
            <p className="aod-modal__customer">{order.customer_name ?? '—'}</p>
          </div>
          <button type="button" className="aod-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="aod-modal__body">
          {/* Status + payment + total + time */}
          <div className="aod-modal__badges">
            <span className={`dash-status ${statusBadgeClass(order.status)}`}>
              {t(`orderStatus.${resolveStatus(order.status)}`)}
            </span>
            <PaymentStatusBadge status={order.payment_status || 'pending'} />
            <span className="aod-modal__total">{birr(order.total)}</span>
            <span className="muted" style={{ fontSize: '0.78rem' }}>{timeAgo(order.created_at)}</span>
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="aod-modal__section">
              <p className="aod-modal__section-title">Items</p>
              <ul className="aod-modal__items">
                {items.map((item, i) => (
                  <li key={i} className="aod-modal__item">
                    {item.image && (
                      <img src={item.image} alt={item.name ?? 'Product'} className="aod-modal__item-img" />
                    )}
                    <div className="aod-modal__item-info">
                      <p className="aod-modal__item-name">{item.name ?? 'Product'}</p>
                      <p className="aod-modal__item-meta">
                        {birr(item.price ?? 0)} × {item.quantity ?? 1}
                        {item.size  ? ` · ${item.size}`  : ''}
                        {item.color ? ` · ${item.color}` : ''}
                      </p>
                    </div>
                    <p className="aod-modal__item-subtotal">
                      {birr((item.price ?? 0) * (item.quantity ?? 1))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Delivery address */}
          {(shipping.fullName || shipping.city) && (
            <div className="aod-modal__section">
              <p className="aod-modal__section-title">Delivery Address</p>
              {shipping.fullName && (
                <p className="aod-modal__address-line"><strong>{shipping.fullName}</strong></p>
              )}
              {(shipping.city || shipping.area || shipping.landmark) && (
                <p className="aod-modal__address-line muted">
                  {[shipping.city, shipping.area, shipping.landmark].filter(Boolean).join(' · ')}
                </p>
              )}
              {shipping.phone && (
                <p className="aod-modal__address-line muted">{shipping.phone}</p>
              )}
            </div>
          )}

          {/* Payment + screenshot */}
          <div className="aod-modal__section">
            <p className="aod-modal__section-title">Payment</p>
            <p className="aod-modal__address-line">{paymentLabel}{paymentWhen}</p>
            {payment.screenshotUrl && (
              <a
                href={payment.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="aod-modal__screenshot-link"
              >
                <img
                  src={payment.screenshotUrl}
                  alt="Payment screenshot"
                  className="aod-modal__screenshot"
                />
                <span className="aod-modal__screenshot-hint">Tap to open full image</span>
              </a>
            )}
          </div>

          {/* Cancellation note */}
          {order.cancellation_reason && (
            <div className="aod-modal__section">
              <p className="aod-modal__section-title">Cancellation Reason</p>
              <p className="aod-modal__address-line muted">{order.cancellation_reason}</p>
            </div>
          )}

          {/* Refund notes */}
          {(order.refund_reason || order.refund_reference || order.refunded_at) && (
            <div className="aod-modal__section">
              <p className="aod-modal__section-title">Refund Notes</p>
              {order.refund_reason    && <p className="aod-modal__address-line muted">{order.refund_reason}</p>}
              {order.refund_reference && <p className="aod-modal__address-line muted">Ref: {order.refund_reference}</p>}
              {order.refunded_at      && (
                <p className="aod-modal__address-line muted">
                  Refunded: {new Date(order.refunded_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="aod-modal__section">
            <p className="aod-modal__section-title">Actions</p>
            <AdminOrderActions order={order} onUpdated={onUpdated} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({ order, onView, onUpdated, onArchive, onUnarchive }) {
  const { state } = useStore()
  const { t }     = useTranslation()
  const [advancing, setAdvancing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const resolved     = resolveStatus(order.status)
  const currentIndex = statusIndex(resolved)
  const isCancelled  = order.status === 'cancelled'
  const isDelivered  = !isCancelled && currentIndex >= ORDER_STEPS.length - 1

  const canAdvanceTo = (targetStatus) => {
    if (isSuperAdmin(state.user))      return true
    if (isOrderManager(state.user))    return ORDER_MANAGER_STEPS.has(targetStatus)
    if (isDeliveryManager(state.user)) return DELIVERY_STEPS.has(targetStatus)
    return false
  }

  const nextStep    = ORDER_STEPS[currentIndex + 1] ?? null
  const allowedNext = !isCancelled && !isDelivered && nextStep && canAdvanceTo(nextStep.id)
    ? nextStep : null

  // Show informational badge for order_manager viewing orders Abi is handling.
  const showHandoff = !allowedNext && !order.is_archived && isOrderManager(state.user)
    && (order.status === 'preparing' || order.status === 'out_for_delivery')

  const quickAdvance = async () => {
    if (!allowedNext || advancing) return
    setAdvancing(true)
    try {
      console.log(`[OrderCard.quickAdvance] called — ${new Date().toISOString()} | orderId: ${order.id} | targetStatus: ${allowedNext.id} | advancing was: ${advancing}`)
      const { error } = await supabase
        .from('orders')
        .update({ status: allowedNext.id, updated_at: new Date().toISOString() })
        .eq('id', order.id)
      if (error) { setAdvancing(false); return }

      insertAuditLog({
        adminUserId: state.user?.id,
        adminEmail:  state.user?.email,
        action:      `order_status_changed_to_${allowedNext.id}`,
        targetType:  'order', targetId: order.id,
        oldValue:    { status: order.status },
        newValue:    { status: allowedNext.id },
      })

      const n = NOTIF_MAP[allowedNext.id]
      if (n && order.user_id) {
        insertNotification({
          userId:    order.user_id,
          type:      `order_${allowedNext.id}`,
          message:   n.en(order.id),
          messageAm: n.am(order.id),
          link:      '/account',
        })
      }
      if ((allowedNext.id === 'confirmed' || allowedNext.id === 'delivered') && n) {
        sendOrderEmail({ toEmail: order.customer_email, toName: order.customer_name, message: n.en(order.id), orderId: order.id })
      }

      onUpdated({ status: allowedNext.id })
    } catch (err) {
      console.error('[OrderCard] quickAdvance error:', err)
    }
    setAdvancing(false)
  }

  const phone = order.shipping?.phone || order.customer_phone || null

  return (
    <div className={`aod-card${isCancelled ? ' aod-card--cancelled' : ''}${order.payment_status === 'refund_needed' ? ' aod-card--refund' : ''}`}>
      <div className="aod-card__header">
        <span className="aod-card__id">{order.id}</span>
        <span className="aod-card__time">{timeAgo(order.created_at)}</span>
      </div>

      <div>
        <p className="aod-card__customer">{order.customer_name ?? '—'}</p>
        {phone && <p className="aod-card__phone">{phone}</p>}
      </div>

      <p className="aod-card__total">{birr(order.total)}</p>

      <div className="aod-card__badges">
        <span className={`dash-status ${statusBadgeClass(order.status)}`}>
          {t(`orderStatus.${resolveStatus(order.status)}`)}
        </span>
        <PaymentStatusBadge status={order.payment_status || 'pending'} />
      </div>

      <div className="aod-card__actions">
        {allowedNext && !order.is_archived ? (
          <button
            type="button"
            className="aod-card__advance"
            onClick={quickAdvance}
            disabled={advancing}
          >
            {advancing ? '…' : `→ ${ACTION_LABELS[allowedNext.id] ?? allowedNext.id}`}
          </button>
        ) : showHandoff ? (
          <span className="om-handoff-label">🚚 In Abi's hands</span>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <button type="button" className="aod-card__view" onClick={onView}>
          View Details
        </button>
        {order.is_archived ? (
          <button
            type="button"
            className="aod-card__archive aod-card__archive--undo"
            disabled={archiving}
            onClick={async () => { setArchiving(true); await onUnarchive(); setArchiving(false) }}
          >
            {archiving ? '…' : 'Unarchive'}
          </button>
        ) : isArchivable(order) ? (
          <button
            type="button"
            className="aod-card__archive"
            disabled={archiving}
            onClick={async () => { setArchiving(true); await onArchive(); setArchiving(false) }}
          >
            {archiving ? '…' : 'Archive'}
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ── Returns Panel ─────────────────────────────────────────────────────────────

function ReturnsPanel({ returnRequests, orders, onUpdate }) {
  const orderMap = useMemo(
    () => Object.fromEntries(orders.map((o) => [o.id, o])),
    [orders],
  )
  const [notes,    setNotes]    = useState({})
  const [updating, setUpdating] = useState(null)

  async function handleDecision(req, status) {
    setUpdating(req.id)
    const { data, error } = await updateReturnStatus(req.id, status, notes[req.id] ?? '')
    setUpdating(null)
    if (!error && data) onUpdate(req.id, data)
  }

  if (returnRequests.length === 0) {
    return (
      <p className="muted" style={{ padding: '2rem 0', textAlign: 'center' }}>No return requests yet.</p>
    )
  }

  return (
    <div className="aod-returns">
      {returnRequests.map((req) => {
        const order      = orderMap[req.order_id]
        const isUpdating = updating === req.id
        const customer   = order?.shipping?.fullName || order?.customer_name || '—'
        return (
          <div key={req.id} className={`aod-return-card aod-return-card--${req.status}`}>
            <div className="aod-return-card__header">
              <div>
                <p className="aod-return-card__order-id">{req.order_id}</p>
                <p className="aod-return-card__customer">
                  {customer}
                  {order && <span> · {birr(order.total)}</span>}
                </p>
              </div>
              <span className={`aod-return-badge aod-return-badge--${req.status}`}>
                {RETURN_STATUS_LABELS[req.status] ?? req.status}
              </span>
            </div>

            <p className="aod-return-card__reason">
              {RETURN_REASON_LABELS[req.reason] ?? req.reason}
            </p>
            {req.description && (
              <p className="aod-return-card__desc">{req.description}</p>
            )}
            <p className="aod-return-card__date">
              {new Date(req.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>

            {req.admin_note && (
              <p className="aod-return-card__admin-note">
                <strong>Note:</strong> {req.admin_note}
              </p>
            )}

            {req.status === 'pending' && (
              <div className="aod-return-card__actions">
                <input
                  type="text"
                  className="aod-return-card__note-input"
                  placeholder="Add a note (optional)…"
                  value={notes[req.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                  disabled={isUpdating}
                />
                <div className="aod-return-card__btns">
                  <button
                    type="button"
                    className="aod-return-card__btn aod-return-card__btn--approve"
                    onClick={() => handleDecision(req, 'approved')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? '…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    className="aod-return-card__btn aod-return-card__btn--reject"
                    onClick={() => handleDecision(req, 'rejected')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? '…' : 'Reject'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Delivery Manager view ─────────────────────────────────────────────────────

const DELIVERY_TAB_DEFS = [
  { id: 'active',    label: 'Active' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'all',       label: 'All' },
]

const DELIVERY_TAB_FILTERS = {
  active:    (o) => o.status !== 'delivered' && o.status !== 'cancelled',
  delivered: (o) => o.status === 'delivered',
  all:       () => true,
}

// Sort so the driver's most urgent work is always at the top.
const DELIVERY_PRIORITY = {
  out_for_delivery: 0,
  preparing:        1,
  confirmed:        2,
  confirming:       3,
  order_received:   4,
}

// Statuses Abi can act on vs. statuses he can only observe.
const ACTIONABLE_DM = new Set(['confirmed', 'preparing', 'out_for_delivery'])
const WAITING_DM    = new Set(['order_received', 'confirming'])

function DeliveryOrderCard({ order, onUpdated }) {
  const { t }       = useTranslation()
  const { state }   = useStore()
  const [advancing,   setAdvancing]   = useState(false)
  const [markingPaid, setMarkingPaid] = useState(false)
  const [localPaid,   setLocalPaid]   = useState(false)

  const resolved     = resolveStatus(order.status)
  const currentIndex = statusIndex(resolved)
  const isCancelled  = order.status === 'cancelled'
  const isDelivered  = !isCancelled && currentIndex >= ORDER_STEPS.length - 1
  const nextStep     = ORDER_STEPS[currentIndex + 1] ?? null
  const allowedNext  = !isCancelled && !isDelivered && nextStep && DELIVERY_STEPS.has(nextStep.id)
    ? nextStep : null

  const sh      = order.shipping ?? {}
  const phone   = sh.phone || order.customer_phone || null
  const address = [sh.city, sh.area, sh.landmark].filter(Boolean).join(' · ')

  // COD cash collection — only for cash-on-delivery orders in actionable statuses.
  // order.payment is a JSONB column: { method: 'cod' | 'telebirr' | 'cbe', ... }.
  // Some orders created before the payment field was added may have payment=null;
  // fall back to the top-level payment_method column if present.
  const isCod = order.payment?.method === 'cod' || order.payment_method === 'cod'
  const alreadyPaid    = localPaid || order.payment_status === 'paid'
  const canCollectCash = isCod
    && (order.status === 'out_for_delivery' || order.status === 'delivered')
    && !alreadyPaid

  // Debug: log values for every card in an actionable status so we can see
  // why the button is or isn't showing without guessing.
  if (process.env.NODE_ENV !== 'production') {
    if (order.status === 'out_for_delivery' || order.status === 'delivered') {
      console.log('[DeliveryOrderCard]', order.id, {
        status: order.status,
        payment: order.payment,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        isCod,
        alreadyPaid,
        canCollectCash,
      })
    }
  }

  const doAdvance = async () => {
    if (!allowedNext || advancing) return
    setAdvancing(true)
    console.log(`[DeliveryOrderCard.doAdvance] called — ${new Date().toISOString()} | orderId: ${order.id} | targetStatus: ${allowedNext.id}`)
    const { error } = await supabase
      .from('orders')
      .update({ status: allowedNext.id, updated_at: new Date().toISOString() })
      .eq('id', order.id)
    if (!error) {
      insertAuditLog({
        adminUserId: state.user?.id, adminEmail: state.user?.email,
        action: `order_status_changed_to_${allowedNext.id}`,
        targetType: 'order', targetId: order.id,
        oldValue: { status: order.status }, newValue: { status: allowedNext.id },
      })
      const n = NOTIF_MAP[allowedNext.id]
      if (n && order.user_id) {
        insertNotification({
          userId: order.user_id, type: `order_${allowedNext.id}`,
          message: n.en(order.id), messageAm: n.am(order.id), link: '/account',
        })
      }
      if ((allowedNext.id === 'confirmed' || allowedNext.id === 'delivered') && n) {
        sendOrderEmail({ toEmail: order.customer_email, toName: order.customer_name, message: n.en(order.id), orderId: order.id })
      }
      onUpdated({ status: allowedNext.id })
    }
    setAdvancing(false)
  }

  const doMarkPaid = async () => {
    if (markingPaid) return
    setMarkingPaid(true)
    const { data, error } = await supabase
      .from('orders')
      .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .select('id, payment_status')
      .single()
    console.log('[DeliveryOrderCard] markPaid result:', { id: order.id, data, error: error?.message ?? null })
    if (!error) {
      insertAuditLog({
        adminUserId: state.user?.id, adminEmail: state.user?.email,
        action: 'cod_payment_collected',
        targetType: 'order', targetId: order.id,
        oldValue: { payment_status: order.payment_status },
        newValue: { payment_status: 'paid' },
      })
      setLocalPaid(true)
      onUpdated({ payment_status: 'paid' })
    }
    setMarkingPaid(false)
  }

  return (
    <div className={`dm-card${isCancelled ? ' dm-card--cancelled' : ''}${isDelivered ? ' dm-card--done' : ''}`}>
      <div className="dm-card__header">
        <span className={`dash-status ${statusBadgeClass(order.status)}`}>
          {t(`orderStatus.${resolveStatus(order.status)}`)}
        </span>
        <span className="dm-card__time">{timeAgo(order.created_at)}</span>
        <span className="dm-card__total">{birr(order.total)}</span>
      </div>

      <p className="dm-card__name">{order.customer_name ?? '—'}</p>
      {phone && (
        <a className="dm-card__phone" href={`tel:${phone}`}>{phone}</a>
      )}
      {address && <p className="dm-card__addr">{address}</p>}

      {allowedNext && (
        <button
          type="button"
          className="dm-card__advance"
          onClick={doAdvance}
          disabled={advancing}
        >
          {advancing ? '…' : `→ ${ACTION_LABELS[allowedNext.id] ?? allowedNext.id}`}
        </button>
      )}

      {canCollectCash && (
        <button
          type="button"
          className="dm-card__collect-cash"
          onClick={doMarkPaid}
          disabled={markingPaid}
        >
          {markingPaid ? '…' : '💵 Cash Collected'}
        </button>
      )}
      {isCod && alreadyPaid && (
        <p className="dm-card__cash-paid">✓ Cash Paid</p>
      )}

      {isDelivered  && <p className="dm-card__state dm-card__state--done">✓ Delivered</p>}
      {isCancelled  && <p className="dm-card__state dm-card__state--cancelled">✗ Cancelled</p>}
    </div>
  )
}

// Read-only amber card — shown for order_received / confirming orders that are
// not yet Abi's to act on (order manager still needs to confirm them first).
function DeliveryWaitingCard({ order }) {
  const sh      = order.shipping ?? {}
  const phone   = sh.phone || order.customer_phone || null
  const address = [sh.city, sh.area, sh.landmark].filter(Boolean).join(' · ')

  return (
    <div className="dm-card dm-card--waiting">
      <div className="dm-card__header">
        <span className="dm-waiting-badge">⏳ Waiting for confirmation</span>
        <span className="dm-card__time">{timeAgo(order.created_at)}</span>
        <span className="dm-card__total">{birr(order.total)}</span>
      </div>
      <p className="dm-card__name">{order.customer_name ?? '—'}</p>
      {phone   && <p className="dm-card__addr">{phone}</p>}
      {address && <p className="dm-card__addr">{address}</p>}
    </div>
  )
}

function DeliveryView({ orders, onOrderUpdated }) {
  const [activeTab, setActiveTab] = useState('active')
  const [search, setSearch]       = useState('')

  const pool = useMemo(() => orders.filter((o) => !o.is_archived), [orders])

  const filtered = useMemo(() => {
    const filterFn = DELIVERY_TAB_FILTERS[activeTab] ?? (() => true)
    let list = pool.filter(filterFn)
    if (activeTab === 'active' && list.length === 0 && pool.length > 0) {
      console.log('[DeliveryView] Active tab empty. Pool statuses:', pool.map((o) => o.status))
    }
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((o) =>
      (o.id             ?? '').toLowerCase().includes(q) ||
      (o.customer_name  ?? '').toLowerCase().includes(q) ||
      (o.shipping?.phone ?? o.customer_phone ?? '').toLowerCase().includes(q),
    )
    return [...list].sort((a, b) => (DELIVERY_PRIORITY[a.status] ?? 99) - (DELIVERY_PRIORITY[b.status] ?? 99))
  }, [pool, activeTab, search])

  return (
    <div className="dm-view">
      <input
        type="search"
        className="aod-search"
        placeholder="Search by name or phone…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setActiveTab('all') }}
      />
      <div className="aod-tabs dm-tabs" role="tablist">
        {DELIVERY_TAB_DEFS.map(({ id, label }) => {
          const count = pool.filter(DELIVERY_TAB_FILTERS[id] ?? (() => true)).length
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`aod-tab${activeTab === id ? ' aod-tab--active' : ''}`}
              onClick={() => { setActiveTab(id); setSearch('') }}
            >
              {label}
              {count > 0 && <span className="aod-tab__badge">{count}</span>}
            </button>
          )
        })}
      </div>

      {activeTab === 'active' ? (
        // Active tab: split into "yours to act on" and "waiting for confirmation"
        (() => {
          const actionable = filtered.filter((o) => ACTIONABLE_DM.has(o.status))
          const waiting    = filtered.filter((o) => WAITING_DM.has(o.status))
          if (actionable.length === 0 && waiting.length === 0) {
            return (
              <p className="muted" style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                No active orders right now.
              </p>
            )
          }
          return (
            <>
              {actionable.length > 0 && (
                <>
                  <p className="dm-section-header">
                    Your active orders ({actionable.length})
                  </p>
                  <div className="dm-cards">
                    {actionable.map((o) => (
                      <DeliveryOrderCard
                        key={o.id}
                        order={o}
                        onUpdated={(upd) => onOrderUpdated(o.id, upd)}
                      />
                    ))}
                  </div>
                </>
              )}
              {waiting.length > 0 && (
                <>
                  <p className="dm-section-header dm-section-header--waiting">
                    ⏳ Waiting for confirmation ({waiting.length})
                  </p>
                  <div className="dm-cards">
                    {waiting.map((o) => <DeliveryWaitingCard key={o.id} order={o} />)}
                  </div>
                </>
              )}
            </>
          )
        })()
      ) : filtered.length === 0 ? (
        <p className="muted" style={{ padding: '1.5rem 0', textAlign: 'center' }}>
          {search ? 'No orders match your search.' : 'No orders here.'}
        </p>
      ) : (
        // Delivered / All tabs: use appropriate card type per status
        <div className="dm-cards">
          {filtered.map((o) =>
            WAITING_DM.has(o.status)
              ? <DeliveryWaitingCard key={o.id} order={o} />
              : <DeliveryOrderCard key={o.id} order={o} onUpdated={(upd) => onOrderUpdated(o.id, upd)} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Summary Card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, count, active, onClick, accent }) {
  return (
    <button
      type="button"
      className={`aod-summary-card${active ? ' aod-summary-card--active' : ''}`}
      onClick={onClick}
      style={active && accent ? { borderColor: accent, background: `${accent}18` } : undefined}
    >
      <span
        className="aod-summary-card__count"
        style={active && accent ? { color: accent } : undefined}
      >
        {count}
      </span>
      <span className="aod-summary-card__label">{label}</span>
    </button>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AdminOrdersDashboard({ orders, onOrderUpdated, deliveryMode = false }) {
  const [activeTab, setActiveTab]         = useState('all')
  const [search, setSearch]               = useState('')
  const [detailOrder, setDetailOrder]     = useState(null)
  const [returnRequests, setReturnRequests] = useState([])
  const [returnsLoading, setReturnsLoading] = useState(false)

  useEffect(() => {
    setReturnsLoading(true)
    fetchAllReturnRequests().then(({ data }) => {
      setReturnRequests(data)
      setReturnsLoading(false)
    })
  }, [])

  // Split orders into two pools so archived orders never leak into active views
  const activePool   = useMemo(() => orders.filter((o) => !o.is_archived), [orders])
  const archivedPool = useMemo(() => orders.filter((o) => o.is_archived === true), [orders])

  const matchesSearch = (o, q) =>
    (o.id               ?? '').toLowerCase().includes(q) ||
    (o.customer_name    ?? '').toLowerCase().includes(q) ||
    (o.shipping?.phone  ?? o.customer_phone ?? '').toLowerCase().includes(q) ||
    (o.payment_status   ?? 'pending').toLowerCase().includes(q)

  const filtered = useMemo(() => {
    const pool = activeTab === 'archived' ? archivedPool : activePool
    let list = activeTab === 'archived'
      ? pool
      : pool.filter(TAB_FILTERS[activeTab] ?? (() => true))
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((o) => matchesSearch(o, q))
    return list
  }, [activePool, archivedPool, activeTab, search])

  const tabCount = (id) => {
    if (id === 'archived') return archivedPool.length
    if (id === 'returns')  return returnRequests.length
    return activePool.filter(TAB_FILTERS[id] ?? (() => true)).length
  }

  if (deliveryMode) {
    return <DeliveryView orders={orders} onOrderUpdated={onOrderUpdated} />
  }

  const handleReturnUpdate = (reqId, updated) =>
    setReturnRequests((prev) => prev.map((r) => (r.id === reqId ? updated : r)))

  const handleUpdate = (orderId, update) => {
    if (detailOrder?.id === orderId) {
      setDetailOrder((prev) => ({ ...prev, ...update }))
    }
    onOrderUpdated(orderId, update)
  }

  return (
    <div className="aod">
      {/* Summary cards — counts from active pool only */}
      <div className="aod-summary">
        {SUMMARY_GROUPS.map(({ key, label, tab, accent, filter }) => (
          <SummaryCard
            key={key}
            label={label}
            count={activePool.filter(filter).length}
            active={activeTab === tab}
            onClick={() => { setActiveTab(tab); setSearch('') }}
            accent={accent}
          />
        ))}
      </div>

      {/* Search + tabs — sticky on scroll */}
      <div className="aod-controls">
        <input
          type="search"
          className="aod-search"
          placeholder="Search order ID, customer name, phone, payment status…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActiveTab('all') }}
        />
        <div className="aod-tabs" role="tablist">
          {TABS.map(({ id, label }) => {
            const count = tabCount(id)
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                className={`aod-tab${activeTab === id ? ' aod-tab--active' : ''}`}
                onClick={() => { setActiveTab(id); setSearch('') }}
              >
                {label}
                {count > 0 && <span className="aod-tab__badge">{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Returns panel or order cards */}
      {activeTab === 'returns' ? (
        returnsLoading ? (
          <p className="muted" style={{ padding: '1.5rem 0', textAlign: 'center' }}>Loading…</p>
        ) : (
          <ReturnsPanel
            returnRequests={returnRequests}
            orders={orders}
            onUpdate={handleReturnUpdate}
          />
        )
      ) : filtered.length === 0 ? (
        <p className="muted" style={{ padding: '1.5rem 0', textAlign: 'center' }}>
          {search ? 'No orders match your search.' : 'No orders in this category.'}
        </p>
      ) : (
        <div className="aod-cards">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onView={() => setDetailOrder(order)}
              onUpdated={(update) => handleUpdate(order.id, update)}
              onArchive={async () => {
                const { error } = await archiveOrder(order.id)
                if (!error) handleUpdate(order.id, { is_archived: true })
              }}
              onUnarchive={async () => {
                const { error } = await unarchiveOrder(order.id)
                if (!error) handleUpdate(order.id, { is_archived: false })
              }}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onUpdated={(update) => handleUpdate(detailOrder.id, update)}
        />
      )}
    </div>
  )
}
