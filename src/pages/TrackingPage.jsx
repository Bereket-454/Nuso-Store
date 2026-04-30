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
