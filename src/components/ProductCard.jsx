import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { birr } from '../utils/format'
import { useTranslation } from '../i18n'
import { COLOR_MAP } from '../utils/colors'
import { AddToCartButton } from './AddToCartButton'

export function ProductCard({ product, activeCategory }) {
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  const isInCart = state.cart.some((item) => item.productId === product.id)
  const outOfStock = product.stock <= 0
  // If viewing a specific category page, show that category label.
  // Otherwise join all categories so multi-category products show e.g. 'Men, Women · Shoes'.
  const categories = product.categories ?? [product.category]
  const categoryLabel = activeCategory
    ? t(`category.${activeCategory}`)
    : categories.map((c) => t(`category.${c}`)).join(', ')
  const line = `${categoryLabel} · ${t(`subcategory.${product.subcategory || 'apparel'}`)}`
  const defaultSize = product.sizes[0] ?? ''
  const defaultColor = product.colors[0] ?? ''
  const priceStr = birr(product.price)

  return (
    <article className="card product-card">
      <Link
        className="product-card__link"
        to={`/products/${product.id}`}
        aria-label={t('productCard.viewA11y', { name: product.name, price: priceStr })}
      >
        <span className="visually-hidden">
          {t('productCard.viewHidden', { name: product.name })}
        </span>
      </Link>
      <div className="product-card__content">
        <div style={{ position: 'relative' }}>
          {product.images?.[0] ? (
            <img src={product.images[0]} alt="" loading="lazy" />
          ) : (
            <div className="product-card__placeholder" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/>
              </svg>
            </div>
          )}
          {outOfStock && (
            <span style={{
              position: 'absolute',
              top: '0.5rem',
              left: '0.5rem',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              pointerEvents: 'none',
              letterSpacing: '0.02em',
            }}>
              {t('productCard.outOfStock')}
            </span>
          )}
        </div>
        <div className="card-body">
          <div className="muted">{line}</div>
          <h3 style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>{product.name}</h3>
          <p className="price">{priceStr}</p>
          {product.colors?.length > 0 && (
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.25rem', marginBottom: '0.1rem' }}>
              {product.colors.slice(0, 5).map((c) => (
                <span
                  key={c}
                  title={c}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: COLOR_MAP[c] ?? '#ccc',
                    display: 'inline-block',
                    flexShrink: 0,
                    border: c === 'White' ? '1px solid #ddd' : '1px solid rgba(0,0,0,0.12)',
                  }}
                />
              ))}
              {product.colors.length > 5 && (
                <span style={{ fontSize: '0.68rem', color: 'var(--muted)', lineHeight: 1 }}>
                  +{product.colors.length - 5}
                </span>
              )}
            </div>
          )}
          <p className="muted">
            {product.stock > 0
              ? t('productCard.inStock', { count: product.stock })
              : t('productCard.outOfStock')}
          </p>
        </div>
      </div>
      <div className="product-card__actions">
        {isInCart ? (
          <p
            role="status"
            aria-live="polite"
            style={{
              fontSize: '0.78rem',
              lineHeight: 1.3,
              color: 'var(--success)',
              margin: '0 0 0.45rem',
              padding: 0,
              fontWeight: 500,
            }}
          >
            {t('productCard.addedToCart')}
          </p>
        ) : null}
        <AddToCartButton
          label={outOfStock ? t('productCard.outOfStock') : isInCart ? t('productCard.addAgain') : t('productCard.addToCart')}
          disabled={outOfStock}
          style={outOfStock ? { background: 'var(--muted)', cursor: 'not-allowed' } : undefined}
          aria-label={
            outOfStock
              ? t('productCard.outOfStock')
              : isInCart
                ? t('productCard.addAgainA11y', { name: product.name })
                : t('productCard.addA11y', { name: product.name })
          }
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            dispatch({
              type: 'CART_ADD',
              payload: { productId: product.id, quantity: 1, size: defaultSize, color: defaultColor },
            })
          }}
        />
      </div>
    </article>
  )
}
