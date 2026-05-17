import { useEffect, useRef, useState } from 'react'
import { useStore } from '../app/store'
import { supabase } from '../lib/supabase'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { birr } from '../utils/format'
import { OrderTracker } from '../components/OrderTracker'

// Normalise a raw Supabase order row to the shape the rest of the UI expects
function normaliseOrder(row) {
  if (!row) return null
  return {
    id:            row.id,
    status:        row.status,
    updatedAt:     row.updated_at,
    createdAt:     row.created_at,
    total:         row.total,
    paymentStatus: row.payment_status,
    shipping:      row.shipping  ?? {},
    payment:       row.payment   ?? {},
  }
}

export function TrackingPage() {
  const { t } = useTranslation()
  const { state } = useStore()
  usePageMeta(t('meta.tracking.title'), t('meta.tracking.desc'))

  const [orderId, setOrderId] = useState('')
  const [phone,   setPhone]   = useState('')
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Supabase realtime channel — resubscribed whenever result.id changes
  const channelRef = useRef(null)

  const subscribeToOrder = (id) => {
    // Tear down any previous subscription
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const handleTrack = async () => {
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

    // Verify phone matches the order's shipping address
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

  // Logged-in user: show their most recent orders for quick access
  const myOrders = state.user
    ? [] // populated by Supabase fetch below
    : []

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
        <button
          className="btn btn-primary"
          onClick={handleTrack}
          disabled={loading || !orderId.trim() || !phone.trim()}
        >
          {loading ? '…' : t('tracker.trackBtn')}
        </button>
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

          <OrderTracker
            status={result.status}
            updatedAt={result.updatedAt ?? result.createdAt}
            orderId={result.id}
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
