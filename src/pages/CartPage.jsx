import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { birr } from '../utils/format'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { EmptyState } from '../components/EmptyState'

function PurgeNotice({ onDismiss, t }) {
  return (
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
        style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', flexShrink: 0 }}
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  )
}

export function CartPage() {
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  usePageMeta(t('meta.cart.title'), t('meta.cart.desc'))

  // Map cart items to their products. Defensive filter: drop items with no matching
  // product or zero price. The store already cleans the cart in CATALOGUE_LOADED;
  // this guards the brief window before the catalogue has loaded.
  const items = state.cart
    .map((item) => ({
      ...item,
      product: state.products.find((p) => p.id === item.productId),
    }))
    .filter((item) => item.product && item.product.price > 0)

  // Only derive the purge notice from the explicit store flag — NOT from
  // items.length comparisons. Comparing lengths also fires when products haven't
  // loaded yet (all lookups return undefined), which makes the X button appear to
  // do nothing because after dismissing cartPurged the length check stays true.
  const showPurgeNotice = state.cartPurged

  const dismiss = () => dispatch({ type: 'CART_PURGE_DISMISS' })

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const deliveryFee = 0
  const total = subtotal + deliveryFee

  // Truly empty cart — no purge involved.
  if (items.length === 0 && !showPurgeNotice) {
    return (
      <article className="card card-body">
        <EmptyState
          icon="cart"
          title={t('cart.emptyTitle')}
          hint={t('cart.emptyHint')}
          ctaLabel={t('cart.browse')}
          ctaTo="/products"
        />
      </article>
    )
  }

  // All items were purged — notice with X, empty state below, no checkout button.
  if (items.length === 0) {
    return (
      <article className="card card-body">
        <PurgeNotice onDismiss={dismiss} t={t} />
        <EmptyState
          icon="cart"
          title={t('cart.emptyTitle')}
          hint={t('cart.emptyHint')}
          ctaLabel={t('cart.browse')}
          ctaTo="/products"
        />
      </article>
    )
  }

  // Cart has valid items — notice at top if some items were purged.
  return (
    <div className="layout-split">
      <section className="card card-body">
        <h1>{t('cart.title')}</h1>
        {showPurgeNotice && <PurgeNotice onDismiss={dismiss} t={t} />}
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
              <strong>{item.product.name}</strong>
              <p className="muted">
                {item.size} / {item.color}
              </p>
              <p>{birr(item.product.price * item.quantity)}</p>
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
