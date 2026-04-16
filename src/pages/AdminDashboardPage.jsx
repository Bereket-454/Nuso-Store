import { useState } from 'react'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { birr } from '../utils/format'
import { useTranslation } from '../i18n'

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
}

export function AdminDashboardPage() {
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  const [productForm, setProductForm] = useState(defaultProduct)
  usePageMeta(t('meta.admin.title'), t('meta.admin.desc'))

  const saveProduct = () => {
    if (!productForm.name.trim() || Number(productForm.price) <= 0) return
    dispatch({
      type: 'ADMIN_PRODUCT_UPSERT',
      payload: {
        ...productForm,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
      },
    })
    setProductForm(defaultProduct)
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
              onChange={(event) => setProductForm((value) => ({ ...value, price: event.target.value }))}
            />
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
          <button className="btn btn-primary" onClick={saveProduct}>
            {t('admin.saveProduct')}
          </button>
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
        <h3>{t('admin.inventory')}</h3>
        {state.products.map((product) => (
          <article key={product.id} style={{ borderBottom: '1px solid var(--border)', padding: '0.7rem 0' }}>
            <p>
              <strong>{product.name}</strong> ({t(`category.${product.category}`)} ·{' '}
              {t(`subcategory.${product.subcategory || 'apparel'}`)})
            </p>
            <p className="muted">
              {t('admin.stock')}: {product.stock} | {t('common.price')}: {birr(product.price)}
            </p>
            <div className="actions">
              <button className="btn btn-secondary" onClick={() => setProductForm(product)}>
                {t('admin.edit')}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => dispatch({ type: 'ADMIN_PRODUCT_DELETE', payload: { id: product.id } })}
              >
                {t('admin.delete')}
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
