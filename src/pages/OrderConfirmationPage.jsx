import { Link, useParams } from 'react-router-dom'
import { useStore } from '../app/store'
import { birr } from '../utils/format'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'

const paymentMethodLabel = (payment, t) => {
  if (!payment?.method || payment.method === 'cod') return t('orderConfirm.paymentCod')
  if (payment.method === 'telebirr') {
    return payment.when === 'now' ? t('orderConfirm.paymentNow') : t('orderConfirm.paymentAfter')
  }
  if (payment.method === 'cbe') {
    return payment.when === 'now' ? t('orderConfirm.paymentNow') : t('orderConfirm.paymentAfter')
  }
  return payment.method
}

export function OrderConfirmationPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { state } = useStore()
  const order = state.orders.find((item) => item.id === id)
  usePageMeta(t('meta.orderConfirmation.title'), t('meta.orderConfirmation.desc'))

  if (!order) {
    return (
      <article className="card card-body">
        <h2>{t('orderConfirm.notFound')}</h2>
        <Link className="btn btn-primary" to="/">
          {t('orderConfirm.backHome')}
        </Link>
      </article>
    )
  }

  return (
    <article className="card card-body" style={{ maxWidth: 560, margin: '2rem auto' }}>
      {/* Success icon */}
      <div className="ord-confirm__icon" aria-hidden="true">✓</div>

      <span className="badge" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
        {t('orderConfirm.badge')}
      </span>

      <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>{t('orderConfirm.thankYou')}</h1>

      {/* Primary message */}
      <p className="ord-confirm__msg">{t('orderConfirm.received')}</p>

      <hr style={{ border: '1px solid var(--border)', margin: '1.25rem 0' }} />

      {/* Order details */}
      <div className="ord-confirm__details">
        <div className="ord-confirm__row">
          <span className="muted">{t('orderConfirm.orderId')}</span>
          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{order.id}</span>
        </div>
        <div className="ord-confirm__row">
          <span className="muted">{t('orderConfirm.orderTotal')}</span>
          <span style={{ fontWeight: 700 }}>{birr(order.total)}</span>
        </div>
        <div className="ord-confirm__row">
          <span className="muted">{t('orderConfirm.paymentMethod')}</span>
          <span style={{ fontWeight: 600 }}>{paymentMethodLabel(order.payment, t)}</span>
        </div>
      </div>

      {/* Delivery address */}
      <div className="ord-confirm__address">
        <p className="muted" style={{ fontSize: '0.82rem', marginBottom: '0.2rem' }}>
          {t('orderConfirm.deliveryTo')}
        </p>
        <p style={{ margin: 0, fontWeight: 600 }}>{order.shipping.fullName}</p>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
          {order.shipping.city}, {order.shipping.area}
          {order.shipping.landmark ? ` · ${order.shipping.landmark}` : ''}
        </p>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
          {order.shipping.phone}
        </p>
      </div>

      <hr style={{ border: '1px solid var(--border)', margin: '1.25rem 0' }} />

      <div className="actions">
        <Link className="btn btn-secondary" to="/tracking">
          {t('orderConfirm.trackOrder')}
        </Link>
        <Link className="btn btn-primary" to="/products">
          {t('orderConfirm.continueShopping')}
        </Link>
      </div>
    </article>
  )
}
