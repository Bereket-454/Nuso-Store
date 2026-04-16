import { useState } from 'react'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'

export function TrackingPage() {
  const { t } = useTranslation()
  const { state } = useStore()
  const [orderId, setOrderId] = useState('')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  usePageMeta(t('meta.tracking.title'), t('meta.tracking.desc'))

  const handleTrack = () => {
    const target = state.orders.find(
      (item) => item.id === orderId.trim() && item.shipping.phone === phone.trim(),
    )
    if (!target) {
      setError(t('tracking.error'))
      setResult(null)
      return
    }
    setError('')
    setResult(target)
  }

  return (
    <div className="layout-split">
      <section className="card card-body">
        <h1>{t('tracking.title')}</h1>
        <div className="form-group">
          <label htmlFor="tracking-order-id">{t('tracking.orderId')}</label>
          <input
            id="tracking-order-id"
            placeholder={t('tracking.orderPlaceholder')}
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="tracking-phone">{t('tracking.phone')}</label>
          <input
            id="tracking-phone"
            placeholder={t('checkout.phonePlaceholder')}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={handleTrack}>
          {t('tracking.track')}
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
      <aside className="card card-body">
        <h3>{t('tracking.statusTitle')}</h3>
        {!result ? (
          <p className="muted">{t('tracking.noDetails')}</p>
        ) : (
          <>
            <p>
              <strong>{result.id}</strong>
            </p>
            <p>
              {t('tracking.currentStatus')}: {t(`orderStatus.${result.status}`)}
            </p>
            <p>
              {t('tracking.payment')}: {result.paymentStatus}
            </p>
            <p className="muted">
              {t('tracking.deliveryAddress')}: {result.shipping.city}, {result.shipping.area}
              {result.shipping.landmark ? `, ${result.shipping.landmark}` : ''}
            </p>
          </>
        )}
      </aside>
    </div>
  )
}
