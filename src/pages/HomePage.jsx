import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { PROMOTIONS } from '../data/mockData'
import { usePageMeta } from '../hooks/usePageMeta'
import { ProductCard } from '../components/ProductCard'
import { ProductCardSkeleton } from '../components/ProductCardSkeleton'
import { RequestBanner } from '../components/RequestBanner'
import { useTranslation } from '../i18n'

// Emoji fallbacks shown when an image slot has no product photo.
const PLACEHOLDER_ICONS = ['👟', '👗', '✨', '🛍️']

export function HomePage() {
  const { t } = useTranslation()
  const { state } = useStore()
  usePageMeta(t('meta.home.title'), t('meta.home.desc'))

  const [recentIds, setRecentIds] = useState(() =>
    JSON.parse(localStorage.getItem('recentlyViewed') || '[]')
  )

  const bestSellers = state.products.filter((item) => item.isBestSeller).slice(0, 4)
  const newArrivals = state.products.filter((item) => item.isNewArrival).slice(0, 4)

  const recentProducts = recentIds
    .map((id) => state.products.find((p) => p.id === id))
    .filter(Boolean)
    .slice(0, 6)

  const clearRecentlyViewed = () => {
    localStorage.removeItem('recentlyViewed')
    setRecentIds([])
  }

  // Fill 4 hero image slots: best sellers first, then newest arrivals, then any remaining.
  const withImage = (p) => p.images?.[0]
  const bestSellerImages = state.products.filter((p) => p.isBestSeller && withImage(p))
  const neededAfterBestSellers = 4 - bestSellerImages.length
  const bestSellerIds = new Set(bestSellerImages.map((p) => p.id))
  const fillImages = neededAfterBestSellers > 0
    ? state.products
        .filter((p) => !bestSellerIds.has(p.id) && withImage(p))
        .sort((a, b) => Number(b.isNewArrival) - Number(a.isNewArrival))
        .slice(0, neededAfterBestSellers)
    : []
  const heroImages = [...bestSellerImages, ...fillImages]
    .map((p) => ({ src: p.images[0], name: p.name }))

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="hero-v2" aria-label="Hero">
        <div className="hero-v2__inner">
          {/* Left: copy */}
          <div>
            <div className="hero-v2__badge">{t('home.heroLocationBadge')}</div>
            <h1 className="hero-v2__title-am">{t('home.heroTitleAm')}</h1>
            <p className="hero-v2__sub">{t('home.heroSubtitle')}</p>
            <div className="hero-v2__actions">
              <Link to="/products" className="hero-v2__btn-primary">
                {t('home.shopNow')} →
              </Link>
              <a href="#categories" className="hero-v2__btn-secondary">
                {t('home.heroBrowseCategories')}
              </a>
            </div>
            <p className="hero-v2__trust">{t('home.heroTrust')}</p>
          </div>

          {/* Right: product image collage */}
          <div className="hero-v2__images" aria-hidden="true">
            {PLACEHOLDER_ICONS.map((icon, i) => {
              const img = heroImages[i]
              return (
                <div key={i} className="hero-v2__img-cell">
                  {img ? (
                    <img src={img.src} alt={img.name} loading="lazy" />
                  ) : (
                    <div className="hero-v2__img-placeholder">{icon}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="categories">
        <h2 className="section-title">{t('home.featuredCategories')}</h2>
        <div className="grid cols-3">
          {state.categories.map((category) => (
            <Link className="card card-body" key={category.slug} to={`/category/${category.slug}`}>
              <h3>{t(`category.${category.slug}`)}</h3>
              <p className="muted">{t('home.categoryCardHint')}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">{t('home.bestSellers')}</h2>
        <div className="grid cols-4 product-listing-grid">
          {state.productsLoading
            ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
            : bestSellers.map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}
        </div>
      </section>

      <section>
        <h2 className="section-title">{t('home.newArrivals')}</h2>
        <div className="grid cols-4 product-listing-grid">
          {state.productsLoading
            ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
            : newArrivals.map((product, i) => <ProductCard key={product.id} product={product} index={i} />)}
        </div>
      </section>

      {recentProducts.length >= 2 && (
        <section>
          <div className="section-title-row">
            <h2 className="section-title">{t('home.recentlyViewed')}</h2>
            <button type="button" className="recently-viewed-clear" onClick={clearRecentlyViewed}>
              {t('home.recentlyViewedClear')}
            </button>
          </div>
          <div className="recently-viewed-grid">
            {recentProducts.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        </section>
      )}

      <RequestBanner />

      <section>
        <h2 className="section-title">{t('home.promotions')}</h2>
        <div className="grid cols-2">
          {PROMOTIONS.map((promotion) => (
            <article className="card card-body" key={promotion.id}>
              <span className="badge">{t('home.badgePromotion')}</span>
              <h3>{t(`promotion.${promotion.id}.title`)}</h3>
              <p className="muted">{t(`promotion.${promotion.id}.details`)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
