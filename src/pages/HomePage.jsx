import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { PROMOTIONS } from '../data/mockData'
import { usePageMeta } from '../hooks/usePageMeta'
import { ProductCard } from '../components/ProductCard'
import { RequestBanner } from '../components/RequestBanner'
import { useTranslation } from '../i18n'

export function HomePage() {
  const { t } = useTranslation()
  const { state } = useStore()
  usePageMeta(t('meta.home.title'), t('meta.home.desc'))

  const bestSellers = state.products.filter((item) => item.isBestSeller).slice(0, 4)
  const newArrivals = state.products.filter((item) => item.isNewArrival).slice(0, 4)

  return (
    <div>
      <section className="hero">
        <h1>{t('home.heroTitle')}</h1>
        <p>{t('home.heroSubtitle')}</p>
        <Link to="/products" className="btn btn-primary">
          {t('home.shopNow')}
        </Link>
      </section>

      <section>
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
