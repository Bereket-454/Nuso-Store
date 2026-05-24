import { useEffect, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../app/store'
import { ProductCard } from '../components/ProductCard'
import { ProductCardSkeleton } from '../components/ProductCardSkeleton'
import { RequestBanner } from '../components/RequestBanner'
import { usePageMeta } from '../hooks/usePageMeta'
import { isPrimaryCategorySlug } from '../data/categoryModel'
import { useTranslation } from '../i18n'

export function CategoryPage() {
  const { t } = useTranslation()
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { state, loadCatalog } = useStore()

  useEffect(() => {
    loadCatalog()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const subcategoryFilter = searchParams.get('subcategory') || 'all'
  const isPrimary = isPrimaryCategorySlug(slug)

  const matchesCategory = (item, catSlug) =>
    Array.isArray(item.categories) ? item.categories.includes(catSlug) : item.category === catSlug

  const featuredSort = (a, b) => {
    const score = (p) => (p.isBestSeller ? 2 : p.isNewArrival ? 1 : 0)
    return score(b) - score(a)
  }

  const products = useMemo(() => {
    if (isPrimary) {
      let list = state.products.filter((item) => matchesCategory(item, slug))
      if (subcategoryFilter !== 'all') {
        list = list.filter((item) => item.subcategory === subcategoryFilter)
      }
      return list.sort(featuredSort)
    }
    return state.products
      .filter((item) => item.subcategory === slug || matchesCategory(item, slug))
      .sort(featuredSort)
  }, [state.products, slug, isPrimary, subcategoryFilter])

  const pageTitle = isPrimary ? t(`category.${slug}`) : t(`subcategory.${slug}`)
  usePageMeta(pageTitle, `${pageTitle} — Nuso Store`)

  const setSubcategory = (value) => {
    if (!isPrimary) return
    if (value === 'all') {
      searchParams.delete('subcategory')
      setSearchParams(searchParams, { replace: true })
      return
    }
    searchParams.set('subcategory', value)
    setSearchParams(searchParams, { replace: true })
  }

  return (
    <div>
      <h1>{pageTitle}</h1>
      {isPrimary ? (
        <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
          {t('categoryPage.filterHint')}
        </p>
      ) : (
        <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
          {t('categoryPage.legacyHintBefore')}{' '}
          <Link to="/category/men">{t('category.men')}</Link>,{' '}
          <Link to="/category/women">{t('category.women')}</Link>
          {` ${t('categoryPage.or')} `}
          <Link to="/category/children">{t('category.children')}</Link>{' '}
          {t('categoryPage.legacyHintAfter')}
        </p>
      )}

      {isPrimary ? (
        <div className="subcategory-filters" role="group" aria-label={t('categoryPage.filterGroup')}>
          <button
            type="button"
            className={`pill ${subcategoryFilter === 'all' ? 'pill-active' : ''}`}
            onClick={() => setSubcategory('all')}
          >
            {t('categoryPage.allTypes')}
          </button>
          {state.subcategories.map((sub) => (
            <button
              type="button"
              key={sub.slug}
              className={`pill ${subcategoryFilter === sub.slug ? 'pill-active' : ''}`}
              onClick={() => setSubcategory(sub.slug)}
            >
              {t(`subcategory.${sub.slug}`)}
            </button>
          ))}
        </div>
      ) : null}

      {state.productsLoading ? (
        <div className="grid cols-3 product-listing-grid" style={{ marginTop: '1rem' }}>
          {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <article className="card card-body">
          <h3>{t('categoryPage.emptyTitle')}</h3>
          <p className="muted">{t('categoryPage.emptyHint')}</p>
          <Link to="/products" className="btn btn-secondary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
            {t('categoryPage.browseAll')}
          </Link>
        </article>
      ) : (
        <>
          <div className="grid cols-3 product-listing-grid" style={{ marginTop: '1rem' }}>
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} activeCategory={isPrimary ? slug : undefined} index={i} />
            ))}
          </div>
          <RequestBanner compact />
        </>
      )}
    </div>
  )
}
