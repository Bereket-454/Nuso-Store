import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { ProductCard } from '../components/ProductCard'
import { ProductCardSkeleton } from '../components/ProductCardSkeleton'
import { RequestBanner } from '../components/RequestBanner'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'

const PAGE_SIZE = 6

export function ProductsPage() {
  const { t } = useTranslation()
  const { state } = useStore()
  usePageMeta(t('meta.products.title'), t('meta.products.desc'))
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [subcategory, setSubcategory] = useState('all')
  const [sort, setSort] = useState('featured')
  const [page, setPage] = useState(1)
  const sentinelRef = useRef(null)

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    let list = state.products.filter((item) => {
      const byCategory = category === 'all' ||
        (Array.isArray(item.categories) ? item.categories.includes(category) : item.category === category)
      const bySubcategory = subcategory === 'all' || item.subcategory === subcategory
      const bySearch =
        text.length === 0 ||
        item.name.toLowerCase().includes(text) ||
        item.description.toLowerCase().includes(text)
      return byCategory && bySubcategory && bySearch
    })

    if (sort === 'price-asc') list = list.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') list = list.sort((a, b) => b.price - a.price)
    if (sort === 'newest') list = list.sort((a, b) => Number(b.isNewArrival) - Number(a.isNewArrival))
    return list
  }, [state.products, search, category, subcategory, sort])

  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice(0, page * PAGE_SIZE)
  const allLoaded = page >= maxPage

  // Infinite scroll — advance page when the sentinel enters the viewport.
  // rootMargin of 400px fires early enough that products appear before the
  // user reaches the exact bottom, keeping the experience seamless.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !allLoaded) {
          setPage((p) => p + 1)
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [allLoaded])

  return (
    <div>
      <h1>{t('products.title')}</h1>
      <div className="shop-filters">
        <input
          id="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          placeholder={t('products.searchPlaceholder')}
          aria-label={t('products.search')}
          className="shop-search"
        />
        <div className="shop-chips" role="group" aria-label={t('products.shopFor')}>
          <button
            type="button"
            className={`shop-chip${category === 'all' ? ' shop-chip--active' : ''}`}
            onClick={() => { setCategory('all'); setPage(1) }}
          >
            {t('products.all')}
          </button>
          {state.categories.map((item) => (
            <button
              key={item.slug}
              type="button"
              className={`shop-chip${category === item.slug ? ' shop-chip--active' : ''}`}
              onClick={() => { setCategory(item.slug); setPage(1) }}
            >
              {t(`category.${item.slug}`)}
            </button>
          ))}
        </div>
        <div className="shop-filter-row">
          <select
            id="subcategory"
            value={subcategory}
            onChange={(event) => {
              setSubcategory(event.target.value)
              setPage(1)
            }}
            aria-label={t('products.type')}
          >
            <option value="all">{t('products.allTypes')}</option>
            {state.subcategories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {t(`subcategory.${item.slug}`)}
              </option>
            ))}
          </select>
          <select
            id="sort"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label={t('products.sortBy')}
          >
            <option value="featured">{t('products.sortFeatured')}</option>
            <option value="price-asc">{t('products.sortPriceAsc')}</option>
            <option value="price-desc">{t('products.sortPriceDesc')}</option>
            <option value="newest">{t('products.sortNewest')}</option>
          </select>
        </div>
      </div>

      {state.productsLoading ? (
        <div className="grid cols-3 product-listing-grid" style={{ marginTop: '1rem' }}>
          {Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <article className="card card-body" style={{ marginTop: '1rem' }}>
          <h3>{t('products.noResults')}</h3>
          <p className="muted">{t('products.noResultsHint')}</p>
          <Link to="/request" className="btn btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
            {t('products.noResultsRequest')}
          </Link>
        </article>
      ) : (
        <>
          <div className="grid cols-3 product-listing-grid" style={{ marginTop: '1rem' }}>
            {visible.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i % PAGE_SIZE} />
            ))}
          </div>
          {/* Sentinel — sits just below the grid; IntersectionObserver loads the next page */}
          <div ref={sentinelRef} aria-hidden="true" style={{ height: '1px' }} />
          {allLoaded && <RequestBanner compact />}
        </>
      )}
    </div>
  )
}
