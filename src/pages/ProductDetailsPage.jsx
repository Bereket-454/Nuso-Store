import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { useStore } from '../app/store'
import { ProductCard } from '../components/ProductCard'
import { AddToCartButton } from '../components/AddToCartButton'
import { birr } from '../utils/format'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { COLOR_MAP } from '../utils/colors'

export function ProductDetailsPage() {
  const { t } = useTranslation()
  const prefersReduced = useReducedMotion()
  const { id } = useParams()
  const { state, dispatch } = useStore()
  const product = state.products.find((item) => item.id === id)
  const [selectedImage, setSelectedImage] = useState(0)
  const [size, setSize] = useState(product?.sizes[0] || '')
  const [color, setColor] = useState('')
  const [colorError, setColorError] = useState('')
  const [colorShake, setColorShake] = useState(false)
  const [feedback, setFeedback] = useState('')
  const touchStartX = useRef(null)
  const colorPickerRef = useRef(null)

  const related = useMemo(() => {
    if (!product) return []
    return state.products
      .filter((item) => item.category === product.category && item.subcategory === product.subcategory && item.id !== product.id)
      .slice(0, 4)
  }, [state.products, product])

  useEffect(() => {
    setSelectedImage(0)
    setSize(product?.sizes[0] || '')
    setColor(product?.colors?.length === 1 ? product.colors[0] : '')
    setColorError('')
    setFeedback('')
    window.scrollTo({ top: 0 })
    if (!id) return
    const stored = JSON.parse(localStorage.getItem('recentlyViewed') || '[]')
    const updated = [id, ...stored.filter((v) => v !== id)].slice(0, 10)
    localStorage.setItem('recentlyViewed', JSON.stringify(updated))
  }, [id])

  useEffect(() => {
    const total = product?.images?.length ?? 0
    if (total <= 1) return
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  setSelectedImage(i => (i - 1 + total) % total)
      if (e.key === 'ArrowRight') setSelectedImage(i => (i + 1) % total)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [product?.images?.length])


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

  const total = product.images.length
  const goPrev = () => setSelectedImage(i => (i - 1 + total) % total)
  const goNext = () => setSelectedImage(i => (i + 1) % total)
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) dx < 0 ? goNext() : goPrev()
    touchStartX.current = null
  }

  const handleAddToCart = () => {
    if (product.colors?.length > 0 && !color) {
      setColorError(t('productDetail.selectColor'))
      setColorShake(true)
      setTimeout(() => setColorShake(false), 600)
      colorPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return false  // tells AddToCartButton not to play the success animation
    }
    dispatch({ type: 'CART_ADD', payload: { productId: product.id, quantity: 1, size, color } })
    setFeedback(t('productDetail.addedFeedback'))
  }

  return (
    <div className="product-detail-page">
      <section className="layout-split">
        <article className="card">
          {/* Main image with arrow navigation */}
          <div
            className="gallery-wrap"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {total > 1 && (
              <button type="button" className="gallery-arrow gallery-arrow--prev" onClick={goPrev} aria-label="Previous image">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={selectedImage}
                src={product.images[selectedImage]}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReduced ? 0 : 0.2 }}
              />
            </AnimatePresence>
            {total > 1 && (
              <button type="button" className="gallery-arrow gallery-arrow--next" onClick={goNext} aria-label="Next image">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            )}
          </div>
          {/* Thumbnail strip — only shown when there are multiple images */}
          {product.images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem 0.5rem 0' }}>
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

          {/* Structured product copy — short description + feature bullets */}
          {product.shortDescription && (
            <p style={{ margin: '0 0 0.6rem', fontSize: '1rem', color: 'var(--text)' }}>
              {product.shortDescription}
            </p>
          )}
          {product.features?.length > 0 ? (
            <ul className="product-features">
              {product.features.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          ) : product.description ? (
            <p style={{ margin: '0 0 0.6rem' }}>{product.description}</p>
          ) : null}
          {product.extraInfo && (
            <p className="muted" style={{ fontSize: '0.85rem', margin: '0 0 0.5rem' }}>{product.extraInfo}</p>
          )}

          {product.stock > 0 && product.stock <= 10 ? (
            <p className="stock-urgency">Only {product.stock} left!</p>
          ) : product.stock > 0 ? (
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
          {product.colors?.length > 0 && (
            <div ref={colorPickerRef} className={`form-group${colorShake ? ' color-picker--shake' : ''}`}>
              <label>{t('productDetail.color')}{color ? <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: '0.4rem' }}>— {color}</span> : null}</label>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', paddingTop: '0.3rem' }}>
                {product.colors.map((c) => {
                  const selected = color === c
                  return (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      aria-label={c}
                      aria-pressed={selected}
                      onClick={() => { setColor(c); setColorError('') }}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: COLOR_MAP[c] ?? '#ccc',
                        border: selected ? '2.5px solid var(--accent)' : '2px solid var(--border)',
                        boxShadow: selected
                          ? 'inset 0 0 0 3px #fff'
                          : c === 'White' ? 'inset 0 0 0 1px #ccc' : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                      }}
                    />
                  )
                })}
              </div>
              {colorError && <p className="error-text" style={{ marginTop: '0.4rem' }}>{colorError}</p>}
            </div>
          )}
          {/* Inline CTA — hidden on mobile; sticky bar handles it there */}
          <div className="product-detail-inline-cta">
            <AddToCartButton
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              label={product.stock <= 0 ? t('productDetail.outOfStock') : t('productDetail.addToCart')}
              style={product.stock <= 0 ? { background: 'var(--muted)', cursor: 'not-allowed' } : undefined}
            />
            {feedback ? <p className="success-text">{feedback}</p> : null}
          </div>
        </article>
      </section>

      <section>
        <h2 className="section-title">{t('productDetail.relatedTitle')}</h2>
        <div className="grid cols-4">
          {related.map((item, i) => (
            <ProductCard key={item.id} product={item} index={i} />
          ))}
        </div>
      </section>


    </div>
  )
}
