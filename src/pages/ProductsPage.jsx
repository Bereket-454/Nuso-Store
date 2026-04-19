import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { ProductCard } from '../components/ProductCard'
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

  return (
    <div>
      <h1>{t('products.title')}</h1>
      <section className="card card-body">
        <div className="filter-grid">
          <div className="form-group">
            <label htmlFor="search">{t('products.search')}</label>
            <input
              id="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder={t('products.searchPlaceholder')}
            />
          </div>
          <div className="form-group">
            <label htmlFor="category">{t('products.shopFor')}</label>
            <select
              id="category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">{t('products.all')}</option>
              {state.categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {t(`category.${item.slug}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="subcategory">{t('products.type')}</label>
            <select
              id="subcategory"
              value={subcategory}
              onChange={(event) => {
                setSubcategory(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">{t('products.allTypes')}</option>
              {state.subcategories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {t(`subcategory.${item.slug}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="sort">{t('products.sortBy')}</label>
            <select id="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="featured">{t('products.sortFeatured')}</option>
              <option value="price-asc">{t('products.sortPriceAsc')}</option>
              <option value="price-desc">{t('products.sortPriceDesc')}</option>
              <option value="newest">{t('products.sortNewest')}</option>
            </select>
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <article className="card card-body" style={{ marginTop: '1rem' }}>
          <h3>{t('products.noResults')}</h3>
          <p className="muted">{t('products.noResultsHint')}</p>
          <Link to="/request" className="btn btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
            {t('products.noResultsRequest')}
          </Link>
        </article>
      ) : (
        <>
          <div className="grid cols-3" style={{ marginTop: '1rem' }}>
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {page < maxPage && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '1.2rem 0' }}>
              <button className="btn btn-secondary" onClick={() => setPage((value) => value + 1)}>
                {t('products.loadMore')}
              </button>
            </div>
          )}
          <RequestBanner compact />
        </>
      )}
    </div>
  )
}
