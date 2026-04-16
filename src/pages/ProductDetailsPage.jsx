import { useMemo, useState } from 'react'
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
      .filter((item) => item.category === product.category && item.id !== product.id)
      .slice(0, 4)
  }, [state.products, product])

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
          <img src={product.images[selectedImage]} alt={product.name} />
          <div className="card-body" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {product.images.map((image, index) => (
              <button
                className="btn btn-secondary"
                key={image}
                onClick={() => setSelectedImage(index)}
              >
                {t('productDetail.photo', { n: index + 1 })}
              </button>
            ))}
          </div>
        </article>
        <article className="card card-body">
          <h1>{product.name}</h1>
          <p className="price">{birr(product.price)}</p>
          <p>{product.description}</p>
          <p className="muted">
            {product.stock > 0 ? t('productDetail.inStock') : t('productDetail.outOfStock')}
          </p>
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
            onClick={() => {
              dispatch({
                type: 'CART_ADD',
                payload: { productId: product.id, quantity: 1, size, color },
              })
              setFeedback(t('productDetail.addedFeedback'))
            }}
          >
            {t('productDetail.addToCart')}
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
