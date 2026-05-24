import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { ProductCard } from '../components/ProductCard'
import { ProductCardSkeleton } from '../components/ProductCardSkeleton'
import { RequestBanner } from '../components/RequestBanner'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { EmptyState } from '../components/EmptyState'

const PAGE_SIZE = 6

// Seeded PRNG (mulberry32) — deterministic shuffle from an integer seed.
function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle(arr, seed) {
  const rand = mulberry32(seed)
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Same seed for the whole browser session; new tab/refresh-after-close gets a new order.
const SHUFFLE_SEED = (() => {
  const key = 'productsSeed'
  const stored = sessionStorage.getItem(key)
  if (stored !== null) return Number(stored)
  const seed = Math.floor(Math.random() * 2 ** 32)
  sessionStorage.setItem(key, String(seed))
  return seed
})()

export function ProductsPage() {
  const { t } = useTranslation()
  const { state, loadCatalog, loadMoreProducts } = useStore()
  usePageMeta(t('meta.products.title'), t('meta.products.desc'))
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [subcategory, setSubcategory] = useState('all')
  const [sort, setSort] = useState('random')
  const [page, setPage] = useState(1)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const sentinelRef = useRef(null)

  useEffect(() => {
    loadCatalog()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

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

    if (sort === 'random') list = seededShuffle(list, SHUFFLE_SEED)
    if (sort === 'featured') list = list.sort((a, b) => {
      const score = (p) => (p.isBestSeller ? 2 : p.isNewArrival ? 1 : 0)
      return score(b) - score(a)
    })
    if (sort === 'price-asc') list = list.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') list = list.sort((a, b) => b.price - a.price)
    if (sort === 'newest') list = list.sort((a, b) => Number(b.isNewArrival) - Number(a.isNewArrival))
    return list
  }, [state.products, search, category, subcategory, sort])

  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice(0, page * PAGE_SIZE)
  const allLoaded = page >= maxPage

  // Infinite scroll — advance local page, or fetch the next server page when exhausted.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return
        if (!allLoaded) {
          setPage((p) => p + 1)
        } else if (state.catalogHasMore && !state.productsLoading) {
          loadMoreProducts()
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [allLoaded, state.catalogHasMore, state.productsLoading, loadMoreProducts])

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
      ) : !state.productsLoading && state.products.length === 0 ? (
        // Catalogue failed to load — distinguish offline vs generic error
        <article className="card card-body" style={{ marginTop: '1rem' }}>
          {isOnline ? (
            <EmptyState
              icon="alert-circle"
              title={t('error.fetchFailed')}
              hint={t('error.fetchFailedHint')}
              ctaLabel={t('error.tryAgain')}
              ctaOnClick={() => window.location.reload()}
              danger
            />
          ) : (
            <EmptyState
              icon="wifi-off"
              title={t('error.noInternet')}
              hint={t('error.noInternetHint')}
              ctaLabel={t('error.checkConnection')}
              ctaOnClick={() => window.location.reload()}
              danger
            />
          )}
        </article>
      ) : filtered.length === 0 ? (
        <article className="card card-body" style={{ marginTop: '1rem' }}>
          <EmptyState
            icon="search-x"
            title={t('products.noResults')}
            hint={t('products.noResultsHint')}
            ctaLabel={t('products.noResultsRequest')}
            ctaTo="/request"
          />
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
