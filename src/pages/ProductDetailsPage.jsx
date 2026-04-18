import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../app/store'
import { ProductCard } from '../components/ProductCard'
import { birr } from '../utils/format'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'

export function ProductDetailsPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { state, dispatch } = useStore()
  const product = state.products.find((item) => item.id === id)
  const [selectedImage, setSelectedImage] = useState(0)
  const [size, setSize] = useState(product?.sizes[0] || '')
  const [color, setColor] = useState(product?.colors[0] || '')
  const [feedback, setFeedback] = useState('')

  const related = useMemo(() => {
    if (!product) return []
    return state.products
      .filter((item) => item.category === product.category && item.subcategory === product.subcategory && item.id !== product.id)
      .slice(0, 4)
  }, [state.products, product])

  useEffect(() => {
    setSelectedImage(0)
    setSize(product?.sizes[0] || '')
    setColor(product?.colors[0] || '')
    setFeedback('')
    window.scrollTo({ top: 0 })
  }, [id])

  usePageMeta(product?.name || t('meta.product.title'), product?.description || t('meta.product.desc'))

  if (!product) {
    return (
      <article className="card card-body">
        <h2>{t('productDetail.notFound')}</h2>
        <Link className="btn btn-secondary" to="/products">
          {t('productDetail.backToProducts')}
        </Link>
      </article>
    )
  }

  return (
    <div>
      <section className="layout-split">
        <article className="card">
          {/* Main image — contain so the full product is always visible */}
          <div style={{
            background: '#f9f9f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxHeight: '420px',
            overflow: 'hidden',
          }}>
            <img
              src={product.images[selectedImage]}
              alt={product.name}
              style={{
                width: '100%',
                maxHeight: '420px',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
          {/* Thumbnail strip — only shown when there are multiple images */}
          {product.images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.75rem' }}>
              {product.images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(index)}
                  style={{
                    padding: 0,
                    border: index === selectedImage
                      ? '2px solid var(--accent)'
                      : '2px solid transparent',
                    borderRadius: '6px',
                    background: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    style={{
                      width: '64px',
                      height: '64px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      display: 'block',
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </article>
        <article className="card card-body">
          <h1>{product.name}</h1>
          <p className="price">{birr(product.price)}</p>
          <p>{product.description}</p>
          {product.stock > 0 ? (
            <p className="muted">{t('productDetail.inStock')}</p>
          ) : (
            <p style={{ color: 'var(--danger)', fontWeight: 600, margin: '0.4rem 0' }}>
              {t('productDetail.outOfStockMessage')}
            </p>
          )}
          <div className="form-group">
            <label htmlFor="size">{t('productDetail.size')}</label>
            <select id="size" value={size} onChange={(event) => setSize(event.target.value)}>
              {product.sizes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="color">{t('productDetail.color')}</label>
            <select id="color" value={color} onChange={(event) => setColor(event.target.value)}>
              {product.colors.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            disabled={product.stock <= 0}
            style={product.stock <= 0 ? { background: 'var(--muted)', cursor: 'not-allowed' } : undefined}
            onClick={() => {
              dispatch({
                type: 'CART_ADD',
                payload: { productId: product.id, quantity: 1, size, color },
              })
              setFeedback(t('productDetail.addedFeedback'))
            }}
          >
            {product.stock <= 0 ? t('productDetail.outOfStock') : t('productDetail.addToCart')}
          </button>
          {feedback ? <p className="success-text">{feedback}</p> : null}
        </article>
      </section>

      <section>
        <h2 className="section-title">{t('productDetail.relatedTitle')}</h2>
        <div className="grid cols-4">
          {related.map((item) => (
            <ProductCard key={item.id} product={item} />
          ))}
        </div>
      </section>
    </div>
  )
}
