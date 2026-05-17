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
]

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

function OrderCard({ order, onView, onUpdated }) {
  const { state } = useStore()
  const { t }     = useTranslation()
  const [advancing, setAdvancing] = useState(false)

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

  const quickAdvance = async () => {
    if (!allowedNext || advancing) return
    setAdvancing(true)
    try {
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
        {allowedNext ? (
          <button
            type="button"
            className="aod-card__advance"
            onClick={quickAdvance}
            disabled={advancing}
          >
            {advancing ? '…' : `→ ${ACTION_LABELS[allowedNext.id] ?? allowedNext.id}`}
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="aod-card__view" onClick={onView}>
          View Details
        </button>
      </div>
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

export function AdminOrdersDashboard({ orders, onOrderUpdated }) {
  const [activeTab, setActiveTab]     = useState('all')
  const [search, setSearch]           = useState('')
  const [detailOrder, setDetailOrder] = useState(null)

  const filtered = useMemo(() => {
    let list = orders.filter(TAB_FILTERS[activeTab] ?? (() => true))
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((o) =>
        (o.id               ?? '').toLowerCase().includes(q) ||
        (o.customer_name    ?? '').toLowerCase().includes(q) ||
        (o.shipping?.phone  ?? o.customer_phone ?? '').toLowerCase().includes(q) ||
        (o.payment_status   ?? 'pending').toLowerCase().includes(q)
      )
    }
    return list
  }, [orders, activeTab, search])

  const handleUpdate = (orderId, update) => {
    if (detailOrder?.id === orderId) {
      setDetailOrder((prev) => ({ ...prev, ...update }))
    }
    onOrderUpdated(orderId, update)
  }

  return (
    <div className="aod">
      {/* Summary cards */}
      <div className="aod-summary">
        {SUMMARY_GROUPS.map(({ key, label, tab, accent, filter }) => (
          <SummaryCard
            key={key}
            label={label}
            count={orders.filter(filter).length}
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
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`aod-tab${activeTab === id ? ' aod-tab--active' : ''}`}
              onClick={() => { setActiveTab(id); setSearch('') }}
            >
              {label}
              {orders.filter(TAB_FILTERS[id]).length > 0 && (
                <span className="aod-tab__badge">
                  {orders.filter(TAB_FILTERS[id]).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
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
