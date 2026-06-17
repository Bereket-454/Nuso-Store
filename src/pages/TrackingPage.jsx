import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../app/store'
import { supabase } from '../lib/supabase'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { birr } from '../utils/format'

// Normalise a raw Supabase order row to the shape the rest of the UI expects
function normaliseOrder(row) {
  if (!row) return null
  return {
    id:                 row.id,
    status:             row.status,
    updatedAt:          row.updated_at,
    createdAt:          row.created_at,
    total:              row.total,
    paymentStatus:      row.payment_status,
    shipping:           row.shipping  ?? {},
    payment:            row.payment   ?? {},
    cancellationReason: row.cancellation_reason ?? null,
    cancelledAt:        row.cancelled_at        ?? null,
  }
}

// ── Walking Tracker helpers ────────────────────────────────────────────────
// The 4 milestones shown on the public tracker (subset of the full order flow)
const WALK_STAGES = ['confirmed', 'preparing', 'out_for_delivery', 'delivered']

function stageIdx(status) {
  return WALK_STAGES.indexOf(status)  // -1 for pre-confirmed statuses
}

// Left% for the figure within .wt
// Dots sit at: 12.5%, 37.5%, 62.5%, 87.5% (centre of each 25%-wide quarter)
function figurePct(status) {
  const i = stageIdx(status)
  return i < 0 ? 4 : 12.5 + i * 25
}

// scaleX fraction for the orange track fill (0 = none, 1 = full)
function fillScale(status) {
  const i = stageIdx(status)
  return i <= 0 ? 0 : i / (WALK_STAGES.length - 1)
}

function isDotFilled(stageId, currentStatus) {
  const si = stageIdx(stageId)
  const ci = stageIdx(currentStatus)
  return ci >= 0 && ci >= si
}

// ── Walking figure SVG (side-profile silhouette, mid-stride) ──────────────
function WalkingFigureSVG() {
  return (
    <svg width="22" height="36" viewBox="0 0 22 36" aria-hidden="true" style={{ display: 'block' }}>
      {/* head */}
      <circle cx="11" cy="4" r="3.5" fill="#FF6B00" />
      {/* body — slight forward lean */}
      <line x1="11"  y1="7.5" x2="10"  y2="19"  stroke="#FF6B00" strokeWidth="2.5" strokeLinecap="round" />
      {/* right arm — swinging forward */}
      <line x1="10.5" y1="11" x2="16"  y2="16"  stroke="#FF6B00" strokeWidth="2"   strokeLinecap="round" />
      {/* left arm — swinging back */}
      <line x1="10.5" y1="11" x2="5"   y2="14"  stroke="#FF6B00" strokeWidth="2"   strokeLinecap="round" />
      {/* right leg — stepping forward, bent knee */}
      <line x1="10"  y1="19"  x2="4"   y2="27"  stroke="#FF6B00" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="4"   y1="27"  x2="7"   y2="35"  stroke="#FF6B00" strokeWidth="2.2" strokeLinecap="round" />
      {/* left leg — pushing off behind */}
      <line x1="10"  y1="19"  x2="16"  y2="26"  stroke="#FF6B00" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="16"  y1="26"  x2="13"  y2="34"  stroke="#FF6B00" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ── WalkingTracker component ───────────────────────────────────────────────
function WalkingTracker({ status, updatedAt, cancellationReason }) {
  const { t }          = useTranslation()
  const prefersReduced = useReducedMotion()

  const cancelled = status === 'cancelled'
  const delivered = status === 'delivered'
  const walking   = !cancelled && !delivered

  const pct   = figurePct(status)
  const scale = fillScale(status)
  const dur   = prefersReduced ? 0 : 1.4

  if (cancelled) {
    return (
      <div className="wt-cancelled">
        <div className="wt-cancelled__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6"  x2="6"  y2="18" />
            <line x1="6"  y1="6"  x2="18" y2="18" />
          </svg>
        </div>
        <p className="wt-cancelled__title">{t('tracker.cancelled')}</p>
        {cancellationReason && <p className="wt-cancelled__reason">{cancellationReason}</p>}
      </div>
    )
  }

  return (
    <div className="wt">
      {/* Pre-confirmed message sits in flow above the track row */}
      {stageIdx(status) < 0 && (
        <p className="wt-pre-msg">⏳ Order received — waiting for confirmation…</p>
      )}

      {/* Track row: own containing block so figure/track/dots don't overlap
          flow siblings (pre-msg above, labels below) */}
      <div className="wt-track-row">
        {/* Walking figure — outer motion div controls horizontal position */}
        <motion.div
          className="wt-figure"
          initial={{ left: `${pct}%` }}
          animate={{ left: `${pct}%` }}
          transition={{ duration: dur, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {/* Inner motion div controls the vertical walking bob */}
          <motion.div
            animate={walking && !prefersReduced
              ? { y: [0, -4, 0, -3, 0] }
              : { y: 0 }
            }
            transition={walking && !prefersReduced
              ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0 }
            }
          >
            <WalkingFigureSVG />
          </motion.div>
        </motion.div>

        {/* Track background line */}
        <div className="wt-track-bg" />

        {/* Orange fill — animates scaleX from left */}
        <motion.div
          className="wt-track-fill"
          initial={{ scaleX: scale }}
          animate={{ scaleX: scale }}
          transition={{ duration: dur, ease: 'easeOut' }}
          style={{ transformOrigin: 'left center' }}
        />

        {/* Stage dots */}
        {WALK_STAGES.map((sid, i) => (
          <div
            key={sid}
            className={`wt-dot${isDotFilled(sid, status) ? ' wt-dot--filled' : ''}`}
            style={{ left: `${12.5 + i * 25}%` }}
          />
        ))}
      </div>

      {/* Stage labels — in flow directly below the track row */}
      <div className="wt-labels">
        {WALK_STAGES.map((sid) => (
          <span
            key={sid}
            className={`wt-label${isDotFilled(sid, status) ? ' wt-label--active' : ''}`}
          >
            {t(`orderStatus.${sid}`)}
          </span>
        ))}
      </div>

      {/* Last updated */}
      {updatedAt && (
        <p className="tracker-updated">
          {t('tracker.lastUpdated')}: {new Date(updatedAt).toLocaleString()}
        </p>
      )}

      {delivered && <p className="wt-delivered-msg">🎉 Your order has been delivered!</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────
export function TrackingPage() {
  const { t }       = useTranslation()
  const { state }   = useStore()
  usePageMeta(t('meta.tracking.title'), t('meta.tracking.desc'))

  const [orderId, setOrderId] = useState('')
  const [phone,   setPhone]   = useState(state.user?.phone ?? '')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Auto-fill phone from profile when user logs in or profile loads
  useEffect(() => {
    console.log('[TrackingPage] user object:', state.user)
    console.log('[TrackingPage] user.phone:', state.user?.phone, '| typeof:', typeof state.user?.phone)
    if (state.user?.phone) {
      setPhone((prev) => prev || state.user.phone)
    }
  }, [state.user?.phone])

  const channelRef = useRef(null)

  const subscribeToOrder = (id) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    channelRef.current = supabase
      .channel(`order-track-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          setResult((prev) =>
            prev ? normaliseOrder({ ...prev, ...payload.new }) : prev
          )
        },
      )
      .subscribe()
  }

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const handleTrack = async () => {
    console.log('[TrackingPage] handleTrack called', { orderId, phone })
    const trimId    = orderId.trim()
    const trimPhone = phone.trim()
    if (!trimId || !trimPhone) return

    setLoading(true)
    setError('')
    setResult(null)

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', trimId)
      .single()

    setLoading(false)

    if (fetchError || !data) {
      setError(t('tracker.notFound'))
      return
    }

    const orderPhone = (data.shipping?.phone ?? '').replace(/\s/g, '')
    const inputPhone = trimPhone.replace(/\s/g, '')
    if (orderPhone !== inputPhone) {
      setError(t('tracker.notFound'))
      return
    }

    const normalised = normaliseOrder(data)
    setResult(normalised)
    subscribeToOrder(normalised.id)
  }

  const btnDisabled = loading || !orderId.trim() || !phone.trim()
  console.log('[TrackingPage] render — btnDisabled:', btnDisabled, { loading, orderId: JSON.stringify(orderId), phone: JSON.stringify(phone) })

  return (
    <div className="tracking-page">
      {/* Search form */}
      <section className="card card-body tracking-form">
        <h1>{t('tracker.title')}</h1>
        <div className="form-group">
          <label htmlFor="track-order-id">{t('tracker.orderIdLabel')}</label>
          <input
            id="track-order-id"
            placeholder={t('tracker.orderIdHint')}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
          />
        </div>
        <div className="form-group">
          <label htmlFor="track-phone">{t('tracker.phoneLabel')}</label>
          <input
            id="track-phone"
            placeholder="+251…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
          />
        </div>
        {/* wrapper catches pointer events even when button is disabled */}
        <div onPointerDown={() => console.log('[TrackingPage] btn area pointer-down — btnDisabled:', btnDisabled, { orderId: JSON.stringify(orderId), phone: JSON.stringify(phone) })}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleTrack}
            disabled={btnDisabled}
          >
            {loading ? '…' : t('tracker.trackBtn')}
          </button>
        </div>
        {error && <p className="error-text" style={{ marginTop: '0.5rem' }}>{error}</p>}
      </section>

      {/* Support */}
      <div className="support-box support-box--compact">
        <p className="support-box__title">{t('support.havingIssue')}</p>
        <div className="support-box__links">
          <a
            href="https://t.me/nusostore"
            target="_blank"
            rel="noopener noreferrer"
            className="support-box__link support-box__link--tg"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.6l-2.94-.918c-.64-.203-.654-.64.135-.954l11.57-4.461c.537-.194 1.006.131.96.954z"/>
            </svg>
            {t('support.chatTelegram')}
          </a>
          <a href="tel:0987312250" className="support-box__link support-box__link--phone">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C9.61 21 3 14.39 3 6.5a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z"/>
            </svg>
            0987312250
          </a>
        </div>
      </div>

      {/* Result */}
      {result && (
        <section className="card card-body tracking-result">
          <div className="tracking-result__header">
            <div>
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Order</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.01em' }}>
                {result.id}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Total</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>
                {birr(result.total)}
              </p>
            </div>
          </div>

          <WalkingTracker
            status={result.status}
            updatedAt={result.updatedAt ?? result.createdAt}
            cancellationReason={result.cancellationReason}
          />

          <div className="tracking-result__details">
            <div className="tracking-detail-row">
              <span className="muted">{t('tracking.payment')}</span>
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                {result.paymentStatus}
              </span>
            </div>
            {result.shipping?.city && (
              <div className="tracking-detail-row">
                <span className="muted">{t('tracking.deliveryAddress')}</span>
                <span>
                  {result.shipping.city}{result.shipping.area ? `, ${result.shipping.area}` : ''}
                  {result.shipping.landmark ? ` · ${result.shipping.landmark}` : ''}
                </span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
