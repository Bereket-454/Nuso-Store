import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { birr } from '../utils/format'
import { useTranslation } from '../i18n'
import { supabase } from '../lib/supabase'
import { upsertProduct, deleteProduct, fetchProducts } from '../services/productsService'
import { insertAuditLog, fetchAuditLogs } from '../services/auditService'
import { insertNotification, sendOrderEmail } from '../services/notificationsService'
import { PRODUCT_COLORS, COLOR_MAP } from '../utils/colors'
import { AdminOrdersDashboard } from '../components/AdminOrdersDashboard'
import { isSuperAdmin, isProductOperator, isOrderManager, isDeliveryManager, isAnyAdmin } from '../utils/auth'

const SUBCATEGORY_ICONS = {
  apparel:    '👕',
  shoes:      '👟',
  perfumes:   '🌸',
  appliances: '⚡',
}

function getStockStatus(stock, threshold) {
  if (stock === 0) return 'out'
  if (stock <= (threshold ?? 5)) return 'low'
  return 'in'
}

const defaultProduct = {
  id: '',
  name: '',
  categories: ['men'],
  subcategory: 'apparel',
  price: 0,
  stock: 0,
  colors: ['Black'],
  sizes: ['M'],
  description: '',
  shortDescription: '',
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
  const { state, dispatch, loadAllProducts } = useStore()
  const [productForm, setProductForm] = useState(defaultProduct)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [priceError, setPriceError] = useState('')
  const [toast, setToast] = useState('')        // fixed bottom-center toast
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef(null)
  const toastFadeTimer = useRef(null)
  const fileInputRef = useRef(null)
  const formRef = useRef(null)
  const requestsRef = useRef(null)
  const [editingName, setEditingName] = useState('')  // non-empty = edit mode
  const [adminOrders, setAdminOrders] = useState([])
  const [requests, setRequests] = useState([])
  const [archivedRequests, setArchivedRequests] = useState([])
  const [showArchived, setShowArchived] = useState(false)
  const [archivedLoading, setArchivedLoading] = useState(false)
  // Map of product_id -> business info row; keyed for O(1) lookup in inventory list.
  const [businessInfo, setBusinessInfo] = useState({})
  // Products that have an added_by_email — used for the Staff Activity section.
  const [staffProducts, setStaffProducts] = useState([])
  const [myProductCount, setMyProductCount] = useState(null)
  const [myCountToday, setMyCountToday]     = useState(null)
  const [myCountWeek, setMyCountWeek]       = useState(null)
  // Inventory dashboard navigation state.
  const [invCategory, setInvCategory] = useState(null) // null=overview, slug=drill-in
  const [invSearch, setInvSearch] = useState('')
  const [invSort, setInvSort] = useState('newest')
  const [invStatusFilter, setInvStatusFilter] = useState('all')
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditLogsVisible, setAuditLogsVisible] = useState(10)
  const [expandedStaff, setExpandedStaff] = useState(new Set())
  usePageMeta(t('meta.admin.title'), t('meta.admin.desc'))

  useEffect(() => {
    loadAllProducts()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!state.user?.id) return
    const uid = state.user.id
    const todayISO = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() })()
    const weekISO  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('added_by_id', uid),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('added_by_id', uid).gte('created_at', todayISO),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('added_by_id', uid).gte('created_at', weekISO),
    ]).then(([all, today, week]) => {
      if (all.count   !== null) setMyProductCount(all.count)
      if (today.count !== null) setMyCountToday(today.count)
      if (week.count  !== null) setMyCountWeek(week.count)
    })
  }, [state.user?.id])

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true)
    const logs = await fetchAuditLogs({ limit: 100 })
    setAuditLogs(logs)
    setAuditLoading(false)
  }, [])

  // Load orders, product requests, and business info on mount.
  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[AdminDashboard] orders fetch error:', error.message)
        if (data) setAdminOrders(data)
      })

    supabase
      .from('product_requests')
      .select('*')
      .eq('archived', false)
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

    supabase
      .from('products')
      .select('id, name, added_by_id, added_by_email, created_at, category, categories, subcategory')
      .not('added_by_email', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setStaffProducts(data) })

    loadAuditLogs()
  }, [loadAuditLogs])

  const updateRequestStatus = async (id, status) => {
    const { error } = await supabase
      .from('product_requests')
      .update({ status })
      .eq('id', id)
    if (!error) {
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))

      if (status === 'fulfilled') {
        const req = requests.find((r) => r.id === id)
        if (req?.user_id) {
          insertNotification({
            userId: req.user_id,
            type: 'request_fulfilled',
            message: `🛍️ We found your requested product! Check it out.`,
            messageAm: `🛍️ የጠየቁትን ምርት አግኝተናል! ይመልከቱ።`,
            link: `/products`,
          })
        }
      }
    }
  }

  const deleteRequest = async (id) => {
    const { error } = await supabase
      .from('product_requests')
      .update({
        archived: true,
        archived_by: state.user?.email || 'admin',
        archived_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== id))
      // Invalidate the cached archived list so it reloads fresh next time.
      setArchivedRequests([])
    }
  }

  const loadArchivedRequests = async () => {
    setArchivedLoading(true)
    const { data, error } = await supabase
      .from('product_requests')
      .select('*')
      .eq('archived', true)
      .order('archived_at', { ascending: false })
    if (!error && data) setArchivedRequests(data)
    setArchivedLoading(false)
  }

  const toggleArchived = () => {
    const next = !showArchived
    setShowArchived(next)
    if (next && archivedRequests.length === 0) loadArchivedRequests()
  }

  const formatRequestDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const REQUEST_STATUS_BADGE = {
    pending:   { background: '#fff8e1', color: '#92600a', border: '1px solid #f0c040' },
    contacted: { background: '#e6f4ff', color: '#0055b3', border: '1px solid #99ccff' },
    fulfilled: { background: '#e6f9ed', color: '#1a7a3c', border: '1px solid #6fcf97' },
    rejected:  { background: '#fdecea', color: '#b91c1c', border: '1px solid #f5a9a9' },
  }

  const formatTelegramHref = (phone) => {
    const stripped = (phone || '').trim().replace(/^\+/, '')
    return `https://t.me/+${stripped}`
  }

  // Show a fixed bottom-center toast for 3 seconds, then fade it out.
  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (toastFadeTimer.current) clearTimeout(toastFadeTimer.current)
    setToast(message)
    setToastVisible(true)
    // Start fade-out 400ms before removal so the CSS transition completes cleanly.
    toastTimer.current = setTimeout(() => setToastVisible(false), 2600)
    toastFadeTimer.current = setTimeout(() => setToast(''), 3000)
  }, [])

  // Reload the full product list from Supabase and update the store.
  const reloadProducts = async () => {
    console.log('[Admin reloadProducts] store has', state.products.length, 'products BEFORE fetch')
    const products = await fetchProducts()
    console.log('[Admin reloadProducts] fetchProducts returned', products.length, 'products AFTER fetch (was', state.products.length, 'in store)')
    dispatch({ type: 'CATALOGUE_LOADED', payload: { products, categories: state.categories, subcategories: state.subcategories } })
  }

  const reloadStaffActivity = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, added_by_id, added_by_email, created_at, category, categories, subcategory')
      .not('added_by_email', 'is', null)
      .order('created_at', { ascending: false })
    if (data) setStaffProducts(data)
  }

  const refreshMyCount = async () => {
    if (!state.user?.id) return
    const uid = state.user.id
    const todayISO = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() })()
    const weekISO  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [all, today, week] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('added_by_id', uid),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('added_by_id', uid).gte('created_at', todayISO),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('added_by_id', uid).gte('created_at', weekISO),
    ])
    if (all.count   !== null) setMyProductCount(all.count)
    if (today.count !== null) setMyCountToday(today.count)
    if (week.count  !== null) setMyCountWeek(week.count)
  }

  const saveProduct = async () => {
    const role = state.user?.role
    console.log('[Admin saveProduct] role:', role, '| product id:', productForm.id || '(new)', '| name:', productForm.name)

    if (!productForm.name.trim()) return
    if (Number(productForm.price) <= 0) {
      setPriceError('Price must be greater than 0')
      return
    }
    setPriceError('')
    setSaveLoading(true)
    console.log('[Admin saveProduct] calling upsertProduct — store has', state.products.length, 'products BEFORE save')
    try {
      const { id: savedId, error } = await upsertProduct(
        {
          ...productForm,
          // Staff must always INSERT — strip any id so upsertProduct auto-generates one.
          id: role === 'staff' ? '' : productForm.id,
          price: Number(productForm.price),
          stock: Number(productForm.stock),
        },
        // Pass author on new products (no editingName) or whenever staff saves (always an INSERT).
        role === 'staff' || !editingName ? { addedById: state.user?.id, addedByEmail: state.user?.email } : {},
      )
      if (error) {
        console.error('[AdminDashboard] upsertProduct error:', error.message, error)
        showToast(`Save failed: ${error.message}`)
        return
      }

      console.log('[Admin saveProduct] upsertProduct succeeded, savedId:', savedId)

      if (canEditBusinessInfo) {
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
      }

      const isEdit = Boolean(editingName)
      insertAuditLog({
        adminUserId: state.user?.id,
        adminEmail:  state.user?.email,
        action:      isEdit ? 'product_edited' : 'product_added',
        targetType:  'product',
        targetId:    savedId,
        oldValue:    isEdit ? { name: editingName } : null,
        newValue:    { name: productForm.name, price: Number(productForm.price), stock: Number(productForm.stock) },
      })
      setProductForm(defaultProduct)
      setEditingName('')
      setUploadError('')
      await reloadProducts()
      await reloadStaffActivity()
      await refreshMyCount()
      loadAuditLogs()
      showToast('Product saved successfully')
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

  const canManageProducts    = isAnyAdmin(state.user)
  const canEditProducts      = isSuperAdmin(state.user)
  const canDeleteProducts    = isSuperAdmin(state.user)
  const canViewOrders        = isSuperAdmin(state.user) || isOrderManager(state.user) || isDeliveryManager(state.user)
  const canViewRequests      = isSuperAdmin(state.user)
  const canViewInventory     = isSuperAdmin(state.user) || isProductOperator(state.user)
  const canEditBusinessInfo  = isSuperAdmin(state.user)
  const canViewStaffActivity = isSuperAdmin(state.user)

  const overdueCount = requests.filter((r) => {
    if (r.status !== 'pending') return false
    const ageMs = Date.now() - new Date(r.created_at).getTime()
    return ageMs > 30 * 60 * 1000
  }).length

  // ── Inventory computed data ────────────────────────────────────────────────
  const invGroups = state.products.reduce((acc, p) => {
    const key = p.subcategory || 'apparel'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})
  const invTotalStock = state.products.reduce((s, p) => s + (p.stock || 0), 0)
  const invLowCount   = state.products.filter(p =>
    getStockStatus(p.stock, businessInfo[p.id]?.restock_threshold) === 'low'
  ).length
  const invOutCount   = state.products.filter(p => p.stock === 0).length
  const invCatProducts = invCategory ? (invGroups[invCategory] ?? []) : []
  const invFiltered = invCatProducts
    .filter(p => {
      if (invSearch && !p.name.toLowerCase().includes(invSearch.toLowerCase())) return false
      if (invStatusFilter === 'all') return true
      return getStockStatus(p.stock, businessInfo[p.id]?.restock_threshold) === invStatusFilter
    })
    .sort((a, b) => {
      if (invSort === 'price-asc')   return a.price - b.price
      if (invSort === 'price-desc')  return b.price - a.price
      if (invSort === 'stock-asc')   return a.stock - b.stock
      if (invSort === 'stock-desc')  return b.stock - a.stock
      return 0 // newest: Supabase already returns created_at DESC
    })

  // ── Staff activity computed data ───────────────────────────────────────────
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000
  const staffTodayCount = staffProducts.filter(p => new Date(p.created_at) >= todayStart).length
  const staffWeekCount  = staffProducts.filter(p => new Date(p.created_at).getTime() >= weekAgoMs).length
  const staffAllCount   = staffProducts.length
  const staffGroups = staffProducts.reduce((acc, p) => {
    const key = p.added_by_email
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  if (!isAnyAdmin(state.user)) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--danger)' }}>
          You do not have permission to access this.
        </p>
      </div>
    )
  }

  const showMyBar    = isAnyAdmin(state.user) && !isSuperAdmin(state.user)
  const adminFirstName = (state.user?.name ?? '').split(' ')[0] || state.user?.email?.split('@')[0] || 'Admin'
  const ROLE_LABELS  = {
    order_manager:    'Order Manager',
    delivery_manager: 'Delivery Manager',
    product_operator: 'Product Operator',
    staff:            'Staff',
  }
  const roleLabel = ROLE_LABELS[state.user?.role] ?? state.user?.role ?? 'Admin'

  return (
    <div>
      <h1>{t('admin.title')}</h1>

      {/* Personal activity bar — all non-super_admin roles */}
      {showMyBar && (
        <div className="admin-my-bar">
          <div className="admin-my-greeting">
            <span className="admin-my-greeting__name">Hello, {adminFirstName}</span>
            <span className="admin-my-greeting__role">{roleLabel}</span>
          </div>
          <div className="admin-my-stats">
            <div className="admin-my-stat">
              <span className="admin-my-stat__num">{myCountToday ?? '—'}</span>
              <span className="admin-my-stat__label">Today</span>
            </div>
            <div className="admin-my-stat">
              <span className="admin-my-stat__num">{myCountWeek ?? '—'}</span>
              <span className="admin-my-stat__label">This Week</span>
            </div>
            <div className="admin-my-stat">
              <span className="admin-my-stat__num">{myProductCount ?? '—'}</span>
              <span className="admin-my-stat__label">All Time</span>
            </div>
          </div>
        </div>
      )}

      {/* Overdue requests alert — super_admin only */}
      {canViewRequests && overdueCount > 0 && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            background: '#fff3e0',
            border: '1px solid #e65100',
            borderLeft: '4px solid #e65100',
            borderRadius: 'var(--radius)',
            padding: '0.85rem 1.2rem',
            marginBottom: '1.25rem',
            color: '#7f3000',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>
            ⚠️ {overdueCount} product request{overdueCount !== 1 ? 's' : ''} waiting — please contact customer{overdueCount !== 1 ? 's' : ''} within 30 minutes!
          </p>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', flexShrink: 0, borderColor: '#e65100', color: '#7f3000' }}
            onClick={() => requestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            View Requests ↓
          </button>
        </div>
      )}

      {/* Fixed bottom-center toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1a1a1a',
            color: '#fff',
            padding: '0.75rem 1.4rem',
            borderRadius: '999px',
            fontSize: '0.92rem',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            opacity: toastVisible ? 1 : 0,
            transition: 'opacity 0.4s ease',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}


      <section className="grid cols-2" style={!(canManageProducts && canViewOrders) ? { gridTemplateColumns: '1fr' } : undefined}>
        {canManageProducts && (
        <article
          id="admin-section-products"
          ref={formRef}
          className="card card-body"
          style={editingName ? { outline: '2px solid var(--accent)', outlineOffset: '2px' } : undefined}
        >
          <h3 style={editingName ? { color: 'var(--accent)' } : undefined}>
            {editingName ? `${t('admin.editing')}: ${editingName}` : t('admin.addEditProduct')}
          </h3>
          {canEditBusinessInfo && (
            <div className="form-group">
              <label htmlFor="admin-id">{t('admin.productId')}</label>
              <input
                id="admin-id"
                value={productForm.id}
                onChange={(event) => setProductForm((value) => ({ ...value, id: event.target.value }))}
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="admin-name">{t('admin.name')}</label>
            <input
              id="admin-name"
              value={productForm.name}
              onChange={(event) => setProductForm((value) => ({ ...value, name: event.target.value }))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-short-desc">Short description</label>
            <textarea
              id="admin-short-desc"
              rows={3}
              value={productForm.shortDescription}
              onChange={(e) => setProductForm((v) => ({ ...v, shortDescription: e.target.value }))}
              placeholder="One-line summary shown on the product page"
            />
          </div>
          <div className="form-group">
            <label>{t('admin.categories')}</label>
            <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', paddingTop: '0.2rem' }}>
              {state.categories.map((item) => {
                const checked = (productForm.categories ?? []).includes(item.slug)
                return (
                  <label key={item.slug} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      style={{ width: 'auto' }}
                      onChange={() => {
                        // Derive toggle from current state — never read e.target.checked
                        // inside a functional updater (synthetic event may be nullified).
                        setProductForm((prev) => {
                          const current = prev.categories ?? []
                          const alreadySelected = current.includes(item.slug)
                          const next = alreadySelected
                            ? current.filter((c) => c !== item.slug)
                            : [...current, item.slug]
                          // Require at least one category to remain selected.
                          return { ...prev, categories: next.length > 0 ? next : current }
                        })
                      }}
                    />
                    {t(`category.${item.slug}`)}
                  </label>
                )
              })}
            </div>
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
            <label htmlFor="admin-description">
              {t('admin.description')}
              <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: '0.4rem', fontSize: '0.8em' }}>(optional)</span>
            </label>
            <textarea
              id="admin-description"
              value={productForm.description}
              onChange={(event) =>
                setProductForm((value) => ({ ...value, description: event.target.value }))
              }
            />
          </div>
          <div className="form-group">
            <label>{t('productDetail.color')}</label>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', paddingTop: '0.3rem' }}>
              {PRODUCT_COLORS.map(({ name, hex }) => {
                const selected = (productForm.colors ?? []).includes(name)
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={name}
                    aria-pressed={selected}
                    onClick={() =>
                      setProductForm((prev) => {
                        const current = prev.colors ?? []
                        return {
                          ...prev,
                          colors: current.includes(name)
                            ? current.filter((c) => c !== name)
                            : [...current, name],
                        }
                      })
                    }
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: hex,
                      border: selected ? '2px solid var(--accent)' : '2px solid var(--border)',
                      boxShadow: selected
                        ? 'inset 0 0 0 2px #fff'
                        : name === 'White' ? 'inset 0 0 0 1px #ccc' : 'none',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>
            {(productForm.colors ?? []).length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', flexShrink: 0 }}>Selected:</span>
                {(productForm.colors ?? []).map((name) => (
                  <span
                    key={name}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.78rem',
                      background: 'var(--surface)',
                      borderRadius: '999px',
                      padding: '0.15rem 0.55rem 0.15rem 0.3rem',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: COLOR_MAP[name] ?? '#ccc',
                      display: 'inline-block',
                      flexShrink: 0,
                      border: name === 'White' ? '1px solid #ccc' : 'none',
                    }} />
                    {name}
                  </span>
                ))}
              </div>
            )}
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

          {/* ── Product tags ──────────────────────────────────────────────── */}
          <div className="form-group">
            <label>{t('admin.productTags')}</label>
            <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '0.2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={!!productForm.isBestSeller}
                  style={{ width: 'auto' }}
                  onChange={() => setProductForm((prev) => ({ ...prev, isBestSeller: !prev.isBestSeller }))}
                />
                {t('admin.tagBestSeller')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.95rem' }}>
                <input
                  type="checkbox"
                  checked={!!productForm.isNewArrival}
                  style={{ width: 'auto' }}
                  onChange={() => setProductForm((prev) => ({ ...prev, isNewArrival: !prev.isNewArrival }))}
                />
                {t('admin.tagNewArrival')}
              </label>
            </div>
          </div>

          {/* ── Private business fields — admin only ──────────────────────── */}
          <div style={{
            borderTop: '1px dashed var(--border)',
            marginTop: '1rem',
            paddingTop: '0.9rem',
          }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
              {t('admin.businessInfoTitle')}
            </p>

            {canEditBusinessInfo ? (
              <>
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
              </>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.7rem 0.9rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--muted)',
                fontSize: '0.85rem',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                This information is private — admin only
              </div>
            )}
          </div>

          <button className="btn btn-primary" onClick={saveProduct} disabled={saveLoading}>
            {saveLoading ? '...' : t('admin.saveProduct')}
          </button>
        </article>
        )}

        {canViewOrders && <article id="admin-section-orders" className="card card-body">
          <h3>{t('admin.ordersTitle')}</h3>
          {adminOrders.length === 0 ? (
            <p className="muted">{t('admin.noOrders')}</p>
          ) : (
            <AdminOrdersDashboard
              orders={adminOrders}
              onOrderUpdated={(id, update) =>
                setAdminOrders((prev) =>
                  prev.map((o) =>
                    o.id === id ? { ...o, ...update, updated_at: new Date().toISOString() } : o,
                  ),
                )
              }
            />
          )}
        </article>}
      </section>

      {canViewRequests && <section id="admin-section-requests" ref={requestsRef} className="card card-body" style={{ marginTop: '1rem' }}>
        <h3>{t('admin.requestsTitle')}</h3>
        {requests.length === 0 ? (
          <p className="muted">{t('admin.requestsEmpty')}</p>
        ) : (
          requests.map((req) => {
            const badgeStyle = REQUEST_STATUS_BADGE[req.status] || REQUEST_STATUS_BADGE.pending
            return (
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
                  <p style={{ margin: '0 0 0.1rem', fontSize: '0.85rem' }}>
                    <strong>{t('admin.requestCustomer')}:</strong> {req.customer_name}
                  </p>
                  {req.created_at && (
                    <p className="muted" style={{ margin: '0 0 0.2rem', fontSize: '0.78rem' }}>
                      {formatRequestDate(req.created_at)}
                    </p>
                  )}
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
                    <strong>{t('admin.requestTelegram')}:</strong>{' '}
                    <a
                      href={formatTelegramHref(req.telegram_phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)' }}
                    >
                      {req.telegram_phone}
                    </a>
                  </p>
                  {req.extra_details && (
                    <p className="muted" style={{ margin: '0 0 0.4rem', fontSize: '0.82rem' }}>{req.extra_details}</p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '999px',
                      ...badgeStyle,
                    }}>
                      {t(`requestStatus.${req.status}`)}
                    </span>
                    <select
                      id={`req-status-${req.id}`}
                      value={req.status}
                      onChange={(e) => updateRequestStatus(req.id, e.target.value)}
                      style={{ width: 'auto', maxWidth: '180px', fontSize: '0.85rem' }}
                    >
                      {['pending', 'contacted', 'fulfilled', 'rejected'].map((s) => (
                        <option key={s} value={s}>{t(`requestStatus.${s}`)}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                      onClick={() => deleteRequest(req.id)}
                    >
                      {t('admin.delete')}
                    </button>
                  </div>
                </div>
              </article>
            )
          })
        )}

        {/* Archived requests toggle */}
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
            onClick={toggleArchived}
          >
            {showArchived ? '▲ Hide archived requests' : '▼ Show archived requests'}
          </button>

          {showArchived && (
            <div style={{ marginTop: '0.9rem' }}>
              {archivedLoading ? (
                <p className="muted" style={{ fontSize: '0.85rem' }}>Loading…</p>
              ) : archivedRequests.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.85rem' }}>No archived requests.</p>
              ) : (
                archivedRequests.map((req) => {
                  const badgeStyle = REQUEST_STATUS_BADGE[req.status] || REQUEST_STATUS_BADGE.pending
                  return (
                    <article key={req.id} style={{ borderBottom: '1px solid var(--border)', padding: '0.75rem 0', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', opacity: 0.7 }}>
                      {req.photo_url && (
                        <img
                          src={req.photo_url}
                          alt={req.product_name}
                          style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, border: '1px solid var(--border)', filter: 'grayscale(40%)' }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: '180px' }}>
                        <p style={{ margin: '0 0 0.2rem', fontSize: '0.9rem' }}><strong>{req.product_name}</strong></p>
                        <p style={{ margin: '0 0 0.15rem', fontSize: '0.82rem' }}>
                          <strong>{t('admin.requestCustomer')}:</strong> {req.customer_name}
                          {req.telegram_phone && (
                            <> · <a href={formatTelegramHref(req.telegram_phone)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{req.telegram_phone}</a></>
                          )}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: '999px', ...badgeStyle }}>
                            {t(`requestStatus.${req.status}`)}
                          </span>
                          <span className="muted" style={{ fontSize: '0.78rem' }}>status when archived</span>
                        </div>
                        <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                          Archived by <strong>{req.archived_by || 'admin'}</strong> on {formatRequestDate(req.archived_at)}
                        </p>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          )}
        </div>
      </section>}

      {/* ── Inventory Dashboard ──────────────────────────────────────────── */}
      {canViewInventory && <section id="admin-section-inventory" className="card inv-dashboard" style={{ marginTop: '1rem' }}>

        {/* Section header */}
        <div className="inv-dashboard__header">
          {invCategory !== null && (
            <button
              type="button"
              className="inv-back-btn"
              onClick={() => { setInvCategory(null); setInvSearch(''); setInvStatusFilter('all'); setInvSort('newest') }}
            >
              ← {t('admin.inventory')}
            </button>
          )}
          <h3 className="inv-dashboard__title">
            {invCategory === null
              ? t('admin.inventory')
              : `${t(`subcategory.${invCategory}`)} Inventory`}
            <span className="inv-count-badge">
              {invCategory === null ? state.products.length : invCatProducts.length}
            </span>
          </h3>
        </div>

        {/* Summary metric cards — always visible */}
        <div className="inv-summary-grid">
          <div className="inv-summary-card">
            <span className="inv-summary-card__value">{state.products.length}</span>
            <span className="inv-summary-card__label">Total Products</span>
          </div>
          <div className="inv-summary-card">
            <span className="inv-summary-card__value">{invTotalStock}</span>
            <span className="inv-summary-card__label">Total Stock</span>
          </div>
          <div className={`inv-summary-card${invLowCount > 0 ? ' inv-summary-card--warn' : ''}`}>
            <span className="inv-summary-card__value">{invLowCount}</span>
            <span className="inv-summary-card__label">Low Stock</span>
          </div>
          <div className={`inv-summary-card${invOutCount > 0 ? ' inv-summary-card--danger' : ''}`}>
            <span className="inv-summary-card__value">{invOutCount}</span>
            <span className="inv-summary-card__label">Out of Stock</span>
          </div>
        </div>

        {invCategory === null ? (
          /* ── Category overview ─────────────────────────────────────────── */
          Object.keys(invGroups).length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              No products yet. Add your first product above.
            </p>
          ) : (
            <div className="inv-category-grid">
              {Object.entries(invGroups).map(([slug, products]) => {
                const catTotalStock = products.reduce((s, p) => s + (p.stock || 0), 0)
                const catLow = products.filter(p =>
                  getStockStatus(p.stock, businessInfo[p.id]?.restock_threshold) === 'low'
                ).length
                const catOut = products.filter(p => p.stock === 0).length
                return (
                  <button
                    key={slug}
                    type="button"
                    className="inv-category-card"
                    onClick={() => setInvCategory(slug)}
                  >
                    <div className="inv-category-card__icon">{SUBCATEGORY_ICONS[slug] ?? '📦'}</div>
                    <div className="inv-category-card__body">
                      <p className="inv-category-card__name">{t(`subcategory.${slug}`)}</p>
                      <p className="inv-category-card__stat">{products.length} product{products.length !== 1 ? 's' : ''}</p>
                      <p className="inv-category-card__stat">{catTotalStock} items in stock</p>
                      {catLow > 0 && <p className="inv-category-card__stat inv-category-card__stat--warn">⚠ {catLow} low stock</p>}
                      {catOut > 0 && <p className="inv-category-card__stat inv-category-card__stat--danger">{catOut} out of stock</p>}
                    </div>
                    <span className="inv-category-card__arrow" aria-hidden="true">→</span>
                  </button>
                )
              })}
            </div>
          )
        ) : (
          /* ── Drill-in: products in selected category ───────────────────── */
          <>
            <div className="inv-toolbar">
              <input
                type="search"
                className="inv-toolbar__search"
                placeholder="Search products…"
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
              />
              <select
                className="inv-toolbar__select"
                value={invStatusFilter}
                onChange={(e) => setInvStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="in">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
              <select
                className="inv-toolbar__select"
                value={invSort}
                onChange={(e) => setInvSort(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="price-desc">Price ↓</option>
                <option value="price-asc">Price ↑</option>
                <option value="stock-desc">Stock ↓</option>
                <option value="stock-asc">Stock ↑</option>
              </select>
            </div>

            {invFiltered.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                No products match your filters.
              </p>
            ) : (
              <div className="inv-product-list">
                {invFiltered.map((product) => {
                  const biz = businessInfo[product.id]
                  const hasCost = biz?.cost_price > 0
                  const profit = hasCost ? product.price - biz.cost_price : null
                  const profitPct = profit !== null && product.price > 0
                    ? ((profit / product.price) * 100).toFixed(1)
                    : null
                  const status = getStockStatus(product.stock, biz?.restock_threshold)
                  return (
                    <article key={product.id} className="inv-product-card">
                      <div className="inv-product-card__main">
                        <div className="inv-product-card__top">
                          <strong className="inv-product-card__name">{product.name}</strong>
                          <div className="inv-product-card__tags">
                            {product.isBestSeller && (
                              <span className="inv-tag inv-tag--gold">★ {t('admin.tagBestSeller')}</span>
                            )}
                            {product.isNewArrival && (
                              <span className="inv-tag inv-tag--blue">✦ {t('admin.tagNewArrival')}</span>
                            )}
                            <span className={`stock-badge stock-badge--${status}`}>
                              {status === 'in' ? 'In Stock' : status === 'low' ? 'Low Stock' : 'Out of Stock'}
                            </span>
                          </div>
                        </div>
                        <p className="inv-product-card__sub">
                          {(product.categories ?? [product.category]).map((c) => t(`category.${c}`)).join(', ')}
                          {' · '}{t(`subcategory.${product.subcategory || 'apparel'}`)}
                        </p>
                        <div className="inv-product-card__meta">
                          <span><span className="inv-meta-label">Price</span> {birr(product.price)}</span>
                          <span><span className="inv-meta-label">Stock</span> {product.stock}</span>
                          {hasCost && <span><span className="inv-meta-label">Cost</span> {birr(biz.cost_price)}</span>}
                          {profit !== null && (
                            <span className={profit >= 0 ? 'margin-positive' : 'margin-negative'}>
                              <span className="inv-meta-label">Margin</span> {birr(profit)} ({profitPct}%)
                            </span>
                          )}
                        </div>
                        {biz?.supplier_name && (
                          <p className="inv-product-card__supplier">
                            {biz.supplier_name}{biz.supplier_contact ? ` · ${biz.supplier_contact}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="inv-product-card__actions">
                        {canEditProducts && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              console.log('[Admin] Edit clicked — product:', product.id, product.name, '| canEditProducts:', canEditProducts)
                              const b = businessInfo[product.id] || {}
                              setProductForm({
                                ...product,
                                categories: product.categories ?? [product.category],
                                shortDescription: product.shortDescription ?? '',
                                costPrice: b.cost_price ?? '',
                                supplierName: b.supplier_name ?? '',
                                supplierContact: b.supplier_contact ?? '',
                                restockThreshold: b.restock_threshold ?? '',
                              })
                              setEditingName(product.name)
                              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                            }}
                          >
                            {t('admin.edit')}
                          </button>
                        )}
                        {canDeleteProducts && (
                          <button
                            className="btn btn-danger"
                            onClick={async () => {
                              console.log('[AdminDashboard] Delete clicked — product.id:', product.id, 'user.id:', state.user?.id, 'role:', state.user?.role)
                              const { error } = await deleteProduct(product.id)
                              if (error) {
                                console.error('[AdminDashboard] deleteProduct error:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint)
                              } else {
                                insertAuditLog({
                                  adminUserId: state.user?.id,
                                  adminEmail:  state.user?.email,
                                  action:      'product_deleted',
                                  targetType:  'product',
                                  targetId:    product.id,
                                  oldValue:    { name: product.name, price: product.price },
                                  newValue:    null,
                                })
                                await reloadProducts()
                                loadAuditLogs()
                                showToast('Product deleted')
                              }
                            }}
                          >
                            {t('admin.delete')}
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>}

      {/* ── Admin Audit Log — super_admin only ───────────────────────────────── */}
      {isSuperAdmin(state.user) && (
        <section className="card card-body" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Admin Activity Log</h3>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem' }}
              onClick={loadAuditLogs}
              disabled={auditLoading}
            >
              {auditLoading ? '…' : 'Refresh'}
            </button>
          </div>

          {auditLoading && auditLogs.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.9rem' }}>Loading…</p>
          ) : auditLogs.length === 0 ? (
            <p className="muted" style={{ fontSize: '0.9rem' }}>No admin actions recorded yet.</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {auditLogs.slice(0, auditLogsVisible).map((log) => {
                  const actionLabel = {
                    product_added:   '+ Product added',
                    product_edited:  '✎ Product edited',
                    product_deleted: '✕ Product deleted',
                    order_cancelled: '✕ Order cancelled',
                  }[log.action] ?? log.action.replace(/_/g, ' ')

                  const newVal = log.new_value ? (() => { try { return JSON.parse(log.new_value) } catch { return null } })() : null
                  const oldVal = log.old_value ? (() => { try { return JSON.parse(log.old_value) } catch { return null } })() : null

                  let detail = ''
                  if (log.target_type === 'product') {
                    detail = newVal?.name || oldVal?.name || log.target_id
                  } else if (log.target_type === 'order') {
                    const newStatus = newVal?.status ?? ''
                    const oldStatus = oldVal?.status ?? ''
                    detail = `Order ${log.target_id.slice(0, 8)}…${oldStatus && newStatus ? ` (${oldStatus} → ${newStatus})` : ''}`
                  } else {
                    detail = log.target_id
                  }

                  return (
                    <div key={log.id} className="audit-log-card">
                      <div className="audit-log-card__action">
                        <span className="audit-log-card__label">{actionLabel}</span>
                        {detail && (
                          <span className="audit-log-card__detail muted">— {detail}</span>
                        )}
                      </div>
                      <span className="audit-log-card__meta muted">{log.admin_email}</span>
                      <span className="audit-log-card__meta muted">
                        {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    </div>
                  )
                })}
              </div>
              {auditLogs.length > 10 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: '0.65rem', fontSize: '0.8rem', padding: '0.3rem 0.85rem' }}
                  onClick={() => setAuditLogsVisible((v) => v === 10 ? auditLogs.length : 10)}
                >
                  {auditLogsVisible === 10
                    ? `Show ${auditLogs.length - 10} more`
                    : 'Show less'}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Staff Activity — admin only ──────────────────────────────────────── */}
      {canViewStaffActivity && (
        <section className="card card-body" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Staff Activity</h3>

          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Today',     count: staffTodayCount },
              { label: 'This Week', count: staffWeekCount },
              { label: 'All Time',  count: staffAllCount },
            ].map(({ label, count }) => (
              <div key={label} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '0.85rem 1rem',
                textAlign: 'center',
              }}>
                <p style={{ margin: '0 0 0.2rem', fontSize: '1.65rem', fontWeight: 700, color: 'var(--accent)' }}>{count}</p>
                <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Per-staff collapsible groups */}
          {Object.keys(staffGroups).length === 0 ? (
            <p className="muted" style={{ fontSize: '0.9rem' }}>No products tracked yet — products added going forward will appear here.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.entries(staffGroups).map(([email, products]) => {
                const isOpen = expandedStaff.has(email)
                const toggle = () => setExpandedStaff((prev) => {
                  const next = new Set(prev)
                  if (next.has(email)) next.delete(email); else next.add(email)
                  return next
                })
                return (
                  <div key={email} className="staff-group">
                    <button type="button" className="staff-group__toggle" onClick={toggle} aria-expanded={isOpen}>
                      <span className="staff-group__email">{email}</span>
                      <span className="staff-group__badge">{products.length}</span>
                      <svg
                        className={`staff-group__chevron${isOpen ? ' staff-group__chevron--open' : ''}`}
                        width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="staff-group__list">
                        {products.map((p) => (
                          <div key={p.id} className="staff-product-row">
                            <span className="staff-product-row__name">{p.name}</span>
                            <span className="staff-product-row__meta muted">
                              {(p.categories ?? [p.category]).map((c) => t(`category.${c}`)).join(', ')}
                              {' · '}{t(`subcategory.${p.subcategory || 'apparel'}`)}
                            </span>
                            <span className="staff-product-row__date muted">
                              {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
