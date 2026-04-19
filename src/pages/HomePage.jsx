import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { PROMOTIONS } from '../data/mockData'
import { usePageMeta } from '../hooks/usePageMeta'
import { ProductCard } from '../components/ProductCard'
import { RequestBanner } from '../components/RequestBanner'
import { useTranslation } from '../i18n'

// Emoji fallbacks shown when an image slot has no product photo.
const PLACEHOLDER_ICONS = ['👟', '👗', '✨', '🛍️']

export function HomePage() {
  const { t } = useTranslation()
  const { state } = useStore()
  usePageMeta(t('meta.home.title'), t('meta.home.desc'))

  const bestSellers = state.products.filter((item) => item.isBestSeller).slice(0, 4)
  const newArrivals = state.products.filter((item) => item.isNewArrival).slice(0, 4)

  // Pick up to 4 products with images for the hero collage, preferring best sellers.
  const heroImages = [
    ...state.products.filter((p) => p.isBestSeller && p.images?.[0]),
    ...state.products.filter((p) => !p.isBestSeller && p.images?.[0]),
  ]
    .slice(0, 4)
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
            <p className="hero-v2__title-en">{t('home.heroTitleEn')}</p>
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
        <div className="grid cols-4">
          {bestSellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">{t('home.newArrivals')}</h2>
        <div className="grid cols-4">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

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
