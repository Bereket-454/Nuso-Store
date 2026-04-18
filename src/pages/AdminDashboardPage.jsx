import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { birr } from '../utils/format'
import { useTranslation } from '../i18n'
import { supabase } from '../lib/supabase'
import { upsertProduct, deleteProduct, fetchProducts } from '../services/productsService'

const defaultProduct = {
  id: '',
  name: '',
  category: 'men',
  subcategory: 'apparel',
  price: 0,
  stock: 0,
  colors: ['Black'],
  sizes: ['M'],
  description: '',
  images: ['https://picsum.photos/seed/dire-admin/640/640'],
  isBestSeller: false,
  isNewArrival: true,
  // Private business fields — stored in product_business_info, never shown to customers.
  costPrice: '',
  supplierName: '',
  supplierContact: '',
  restockThreshold: '',
}

export function AdminDashboardPage() {
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  const [productForm, setProductForm] = useState(defaultProduct)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [priceError, setPriceError] = useState('')
  const [toast, setToast] = useState('')        // green success message
  const toastTimer = useRef(null)
  const fileInputRef = useRef(null)
  const [requests, setRequests] = useState([])
  // Map of product_id -> business info row; keyed for O(1) lookup in inventory list.
  const [businessInfo, setBusinessInfo] = useState({})
  usePageMeta(t('meta.admin.title'), t('meta.admin.desc'))

  // Load product requests and business info on mount.
  useEffect(() => {
    supabase
      .from('product_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setRequests(data)
      })

    supabase
      .from('product_business_info')
      .select('*')
      .then(({ data }) => {
        if (data) {
          const map = {}
          data.forEach((row) => { map[row.product_id] = row })
          setBusinessInfo(map)
        }
      })
  }, [])

  const updateRequestStatus = async (id, status) => {
    const { error } = await supabase
      .from('product_requests')
      .update({ status })
      .eq('id', id)
    if (!error) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      )
    }
  }

  // Show a green toast for 3 seconds then clear it.
  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }, [])

  // Reload the full product list from Supabase and update the store.
  const reloadProducts = async () => {
    const products = await fetchProducts()
    dispatch({ type: 'CATALOGUE_LOADED', payload: { products, categories: state.categories, subcategories: state.subcategories } })
  }

  const saveProduct = async () => {
    if (!productForm.name.trim()) return
    if (Number(productForm.price) <= 0) {
      setPriceError('Price must be greater than 0')
      return
    }
    setPriceError('')
    setSaveLoading(true)
    try {
      const { id: savedId, error } = await upsertProduct({
        ...productForm,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
      })
      if (error) {
        console.error('[AdminDashboard] upsertProduct error:', error.message)
      } else {
        // Save private business info linked to the product id.
        const bizRow = {
          product_id: savedId,
          cost_price: Number(productForm.costPrice) || null,
          supplier_name: productForm.supplierName.trim() || null,
          supplier_contact: productForm.supplierContact.trim() || null,
          restock_threshold: Number(productForm.restockThreshold) || null,
        }
        const { error: bizError } = await supabase
          .from('product_business_info')
          .upsert(bizRow, { onConflict: 'product_id' })
        if (bizError) {
          console.error('[AdminDashboard] business info save error:', bizError.message)
        } else {
          setBusinessInfo((prev) => ({ ...prev, [savedId]: bizRow }))
        }

        setProductForm(defaultProduct)
        setUploadError('')
        await reloadProducts()
        showToast('Product saved successfully')
      }
    } finally {
      setSaveLoading(false)
    }
  }

  // Upload a selected image file to the Supabase Storage 'products' bucket.
  // Requires the bucket to exist and be set to public in the Supabase dashboard.
  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadLoading(true)
    setUploadError('')

    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { data, error } = await supabase.storage
        .from('Products')
        .upload(fileName, file, { cacheControl: '3600', upsert: false })

      if (error) {
        setUploadError(error.message || t('admin.uploadImageError'))
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('Products')
          .getPublicUrl(data.path)
        setProductForm((prev) => ({ ...prev, images: [...prev.images, publicUrl] }))
      }
    } catch (err) {
      setUploadError(err.message || t('admin.uploadImageError'))
    } finally {
      setUploadLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <h1>{t('admin.title')}</h1>
      <section className="grid cols-2">
        <article className="card card-body">
          <h3>{t('admin.addEditProduct')}</h3>
          <div className="form-group">
            <label htmlFor="admin-id">{t('admin.productId')}</label>
            <input
              id="admin-id"
              value={productForm.id}
              onChange={(event) => setProductForm((value) => ({ ...value, id: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-name">{t('admin.name')}</label>
            <input
              id="admin-name"
              value={productForm.name}
              onChange={(event) => setProductForm((value) => ({ ...value, name: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-category">{t('admin.shopFor')}</label>
            <select
              id="admin-category"
              value={productForm.category}
              onChange={(event) =>
                setProductForm((value) => ({ ...value, category: event.target.value }))
              }
            >
              {state.categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {t(`category.${item.slug}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="admin-subcategory">{t('admin.type')}</label>
            <select
              id="admin-subcategory"
              value={productForm.subcategory || 'apparel'}
              onChange={(event) =>
                setProductForm((value) => ({ ...value, subcategory: event.target.value }))
              }
            >
              {state.subcategories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {t(`subcategory.${item.slug}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="admin-price">{t('admin.price')}</label>
            <input
              id="admin-price"
              type="number"
              min="0"
              value={productForm.price}
              onChange={(event) => {
                setProductForm((value) => ({ ...value, price: event.target.value }))
                if (Number(event.target.value) > 0) setPriceError('')
              }}
            />
            {priceError && <p className="error-text">{priceError}</p>}
          </div>
          <div className="form-group">
            <label htmlFor="admin-stock">{t('admin.stock')}</label>
            <input
              id="admin-stock"
              type="number"
              min="0"
              value={productForm.stock}
              onChange={(event) => setProductForm((value) => ({ ...value, stock: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-description">{t('admin.description')}</label>
            <textarea
              id="admin-description"
              value={productForm.description}
              onChange={(event) =>
                setProductForm((value) => ({ ...value, description: event.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label>{t('admin.productImage')}</label>
            {/* Thumbnail strip — first image is the cover */}
            {productForm.images?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                {productForm.images.map((url, idx) => (
                  <div key={url} style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={url}
                      alt={`Product image ${idx + 1}`}
                      style={{
                        width: '72px',
                        height: '72px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        border: idx === 0
                          ? '2px solid var(--accent)'
                          : '1px solid var(--border)',
                        display: 'block',
                      }}
                    />
                    {idx === 0 && (
                      <span style={{
                        position: 'absolute',
                        bottom: '2px',
                        left: '2px',
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: '3px',
                        lineHeight: 1.4,
                      }}>
                        COVER
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() =>
                        setProductForm((prev) => ({
                          ...prev,
                          images: prev.images.filter((_, i) => i !== idx),
                        }))
                      }
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--danger)',
                        color: '#fff',
                        border: 'none',
                        padding: 0,
                        fontSize: '0.7rem',
                        lineHeight: '18px',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Hidden file input — triggered by the button below */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadLoading}
            >
              {uploadLoading ? t('admin.uploading') : t('admin.uploadImage')}
            </button>
            {uploadError && (
              <p className="error-text" style={{ marginTop: '0.4rem' }}>{uploadError}</p>
            )}
          </div>

          {/* ── Private business fields ─────────────────────────────────────── */}
          <div style={{
            borderTop: '1px dashed var(--border)',
            marginTop: '1rem',
            paddingTop: '0.9rem',
          }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
              {t('admin.businessInfoTitle')}
            </p>

            <div className="form-group">
              <label htmlFor="admin-cost-price">{t('admin.costPrice')}</label>
              <input
                id="admin-cost-price"
                type="number"
                min="0"
                value={productForm.costPrice}
                onChange={(e) => setProductForm((v) => ({ ...v, costPrice: e.target.value }))}
                placeholder="0"
              />
              {/* Live profit margin — only shown when both prices are valid */}
              {Number(productForm.price) > 0 && Number(productForm.costPrice) > 0 && (() => {
                const sell = Number(productForm.price)
                const cost = Number(productForm.costPrice)
                const profit = sell - cost
                const pct = ((profit / sell) * 100).toFixed(1)
                const color = profit >= 0 ? 'var(--success)' : 'var(--danger)'
                return (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color }}>
                    {t('admin.profitMargin')}: {birr(profit)} ({pct}%)
                  </p>
                )
              })()}
            </div>

            <div className="form-group">
              <label htmlFor="admin-supplier-name">{t('admin.supplierName')}</label>
              <input
                id="admin-supplier-name"
                value={productForm.supplierName}
                onChange={(e) => setProductForm((v) => ({ ...v, supplierName: e.target.value }))}
                placeholder={t('admin.supplierNamePlaceholder')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-supplier-contact">{t('admin.supplierContact')}</label>
              <input
                id="admin-supplier-contact"
                value={productForm.supplierContact}
                onChange={(e) => setProductForm((v) => ({ ...v, supplierContact: e.target.value }))}
                placeholder={t('admin.supplierContactPlaceholder')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-restock">{t('admin.restockThreshold')}</label>
              <input
                id="admin-restock"
                type="number"
                min="0"
                value={productForm.restockThreshold}
                onChange={(e) => setProductForm((v) => ({ ...v, restockThreshold: e.target.value }))}
                placeholder="5"
              />
            </div>
          </div>

          <button className="btn btn-primary" onClick={saveProduct} disabled={saveLoading}>
            {saveLoading ? '...' : t('admin.saveProduct')}
          </button>
          {toast && <p className="success-text" style={{ marginTop: '0.5rem' }}>{toast}</p>}
        </article>

        <article className="card card-body">
          <h3>{t('admin.ordersTitle')}</h3>
          {state.orders.length === 0 ? (
            <p className="muted">{t('admin.noOrders')}</p>
          ) : (
            state.orders.map((order) => (
              <div key={order.id} style={{ borderBottom: '1px solid var(--border)', padding: '0.7rem 0' }}>
                <p>
                  <strong>{order.id}</strong> - {t(`orderStatus.${order.status}`)}
                </p>
                <p className="muted">
                  {t('admin.payment')}: {order.paymentStatus}
                </p>
                <p>
                  {t('admin.total')}: {birr(order.total)}
                </p>
                <div className="actions">
                  {['confirmed', 'packed', 'out-for-delivery', 'delivered'].map((statusValue) => (
                    <button
                      className="btn btn-secondary"
                      key={statusValue}
                      onClick={() =>
                        dispatch({
                          type: 'ORDER_UPDATE_STATUS',
                          payload: { id: order.id, status: statusValue },
                        })
                      }
                    >
                      {t(`orderStatus.${statusValue}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </article>
      </section>

      <section className="card card-body" style={{ marginTop: '1rem' }}>
        <h3>{t('admin.requestsTitle')}</h3>
        {requests.length === 0 ? (
          <p className="muted">{t('admin.requestsEmpty')}</p>
        ) : (
          requests.map((req) => (
            <article key={req.id} style={{ borderBottom: '1px solid var(--border)', padding: '0.9rem 0', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {req.photo_url && (
                <img
                  src={req.photo_url}
                  alt={req.product_name}
                  style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: '1px solid var(--border)' }}
                />
              )}
              <div style={{ flex: 1, minWidth: '180px' }}>
                <p style={{ margin: '0 0 0.25rem' }}><strong>{req.product_name}</strong></p>
                <p className="muted" style={{ margin: '0 0 0.2rem', fontSize: '0.85rem' }}>{req.description}</p>
                <p style={{ margin: '0 0 0.2rem', fontSize: '0.85rem' }}>
                  <strong>{t('admin.requestCustomer')}:</strong> {req.customer_name}
                </p>
                <p style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
                  <strong>{t('admin.requestTelegram')}:</strong> {req.telegram_phone}
                </p>
                {req.extra_details && (
                  <p className="muted" style={{ margin: '0 0 0.4rem', fontSize: '0.82rem' }}>{req.extra_details}</p>
                )}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor={`req-status-${req.id}`} style={{ fontSize: '0.8rem' }}>{t('admin.requestStatus')}</label>
                  <select
                    id={`req-status-${req.id}`}
                    value={req.status}
                    onChange={(e) => updateRequestStatus(req.id, e.target.value)}
                    style={{ width: 'auto', fontSize: '0.85rem' }}
                  >
                    {['pending', 'contacted', 'fulfilled', 'rejected'].map((s) => (
                      <option key={s} value={s}>{t(`requestStatus.${s}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="card card-body" style={{ marginTop: '1rem' }}>
        <h3>{t('admin.inventory')}</h3>
        {state.products.map((product) => {
          const biz = businessInfo[product.id]
          const hasCost = biz?.cost_price > 0
          const profit = hasCost ? product.price - biz.cost_price : null
          const profitPct = profit !== null && product.price > 0
            ? ((profit / product.price) * 100).toFixed(1)
            : null
          const restockAlert = biz?.restock_threshold != null && product.stock <= biz.restock_threshold

          return (
            <article key={product.id} style={{ borderBottom: '1px solid var(--border)', padding: '0.7rem 0' }}>
              <p>
                <strong>{product.name}</strong> ({t(`category.${product.category}`)} ·{' '}
                {t(`subcategory.${product.subcategory || 'apparel'}`)})
              </p>
              <p className="muted" style={{ margin: '0.15rem 0' }}>
                {t('admin.stock')}: {product.stock}
                {restockAlert && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--danger)', fontWeight: 600 }}>
                    ⚠ {t('admin.restockAlert')}
                  </span>
                )}
                {' | '}{t('common.price')}: {birr(product.price)}
                {hasCost && (
                  <>
                    {' | '}{t('admin.costPrice')}: {birr(biz.cost_price)}
                    {' | '}<span style={{ color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                      {t('admin.profitMargin')}: {birr(profit)} ({profitPct}%)
                    </span>
                  </>
                )}
              </p>
              {biz?.supplier_name && (
                <p className="muted" style={{ margin: '0.1rem 0', fontSize: '0.82rem' }}>
                  {t('admin.supplierName')}: {biz.supplier_name}
                  {biz.supplier_contact ? ` · ${biz.supplier_contact}` : ''}
                </p>
              )}
              <div className="actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const b = businessInfo[product.id] || {}
                    setProductForm({
                      ...product,
                      costPrice: b.cost_price ?? '',
                      supplierName: b.supplier_name ?? '',
                      supplierContact: b.supplier_contact ?? '',
                      restockThreshold: b.restock_threshold ?? '',
                    })
                  }}
                >
                  {t('admin.edit')}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    const { error } = await deleteProduct(product.id)
                    if (error) {
                      console.error('[AdminDashboard] deleteProduct error:', error.message)
                    } else {
                      await reloadProducts()
                      showToast('Product deleted')
                    }
                  }}
                >
                  {t('admin.delete')}
                </button>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
