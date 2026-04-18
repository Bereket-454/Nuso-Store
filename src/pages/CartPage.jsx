import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { birr } from '../utils/format'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'

export function CartPage() {
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  usePageMeta(t('meta.cart.title'), t('meta.cart.desc'))

  const allItems = state.cart.map((item) => {
    const product = state.products.find((value) => value.id === item.productId)
    return { ...item, product }
  })
  // Defensive filter: drop any item whose product no longer exists or has no valid price.
  // The store already cleans the cart on CATALOGUE_LOADED, but this guards the edge case
  // where CartPage renders before the catalogue has loaded.
  const items = allItems.filter((item) => item.product && item.product.price > 0)
  const hasStale = state.cartPurged || allItems.length > items.length

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const deliveryFee = subtotal > 12000 ? 0 : state.deliveryFee
  const total = subtotal + deliveryFee

  if (items.length === 0 && !hasStale) {
    return (
      <article className="card card-body">
        <h2>{t('cart.emptyTitle')}</h2>
        <p className="muted">{t('cart.emptyHint')}</p>
        <Link className="btn btn-primary" to="/products">
          {t('cart.browse')}
        </Link>
      </article>
    )
  }

  if (items.length === 0) {
    // Cart had items but all were stale — show the notice then empty state.
    return (
      <article className="card card-body">
        {hasStale && (
          <p style={{ color: 'var(--danger)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
            {t('cart.stalePurged')}
          </p>
        )}
        <h2>{t('cart.emptyTitle')}</h2>
        <p className="muted">{t('cart.emptyHint')}</p>
        <Link className="btn btn-primary" to="/products">
          {t('cart.browse')}
        </Link>
      </article>
    )
  }

  return (
    <div className="layout-split">
      <section className="card card-body">
        <h1>{t('cart.title')}</h1>
        {hasStale && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            background: '#fff8e1',
            border: '1px solid #f0c040',
            borderRadius: '8px',
            padding: '0.6rem 0.9rem',
            marginBottom: '0.75rem',
            fontSize: '0.88rem',
          }}>
            <span>{t('cart.stalePurged')}</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
              onClick={() => dispatch({ type: 'CART_PURGE_DISMISS' })}
            >
              ✕
            </button>
          </div>
        )}
        {items.map((item) => (
          <article
            key={item.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              padding: '0.8rem 0',
              gap: '0.8rem',
            }}
          >
            <div>
              <strong>{item.product?.name}</strong>
              <p className="muted">
                {item.size} / {item.color}
              </p>
              <p>{birr((item.product?.price || 0) * item.quantity)}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  dispatch({
                    type: 'CART_UPDATE',
                    payload: { key: item.key, quantity: item.quantity - 1 },
                  })
                }
              >
                -
              </button>
              <span>{item.quantity}</span>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  dispatch({
                    type: 'CART_UPDATE',
                    payload: { key: item.key, quantity: item.quantity + 1 },
                  })
                }
              >
                +
              </button>
              <button
                className="btn btn-danger"
                onClick={() => dispatch({ type: 'CART_REMOVE', payload: { key: item.key } })}
              >
                {t('cart.remove')}
              </button>
            </div>
          </article>
        ))}
      </section>
      <aside className="card card-body">
        <h3>{t('cart.summary')}</h3>
        <p>
          {t('cart.subtotal')}: {birr(subtotal)}
        </p>
        <p>
          {t('cart.deliveryFee')}: {deliveryFee === 0 ? t('cart.free') : birr(deliveryFee)}
        </p>
        <p>
          <strong>
            {t('cart.total')}: {birr(total)}
          </strong>
        </p>
        <p className="muted">{t('cart.deliveryOnly')}</p>
        <Link className="btn btn-primary" to="/checkout">
          {t('cart.checkout')}
        </Link>
      </aside>
    </div>
  )
}
