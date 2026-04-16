import { Link, useParams } from 'react-router-dom'
import { useStore } from '../app/store'
import { birr } from '../utils/format'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'

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

  const statusLabel = t(`orderStatus.${order.status}`)

  return (
    <article className="card card-body">
      <span className="badge">{t('orderConfirm.badge')}</span>
      <h1>{t('orderConfirm.thankYou')}</h1>
      <p>
        {t('orderConfirm.orderId')}: {order.id}
      </p>
      <p>
        {t('orderConfirm.totalPaid')}: {birr(order.total)}
      </p>
      <p>{t('orderConfirm.deliveryTo')}:</p>
      <p className="muted" style={{ margin: '-0.25rem 0 0.25rem' }}>
        {order.shipping.fullName} · {order.shipping.phone}
      </p>
      <p className="muted" style={{ margin: '0 0 0.25rem' }}>
        {order.shipping.city}, {order.shipping.area}
        {order.shipping.landmark ? ` · ${order.shipping.landmark}` : ''}
      </p>
      <p className="muted">{t('orderConfirm.statusLine', { status: statusLabel })}</p>
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
