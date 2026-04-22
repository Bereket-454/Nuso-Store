import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { birr } from '../utils/format'
import { getPaymentIntegrationStatus, initiateTelebirrPayment } from '../services/payment'
import { recalculateBestSellers } from '../services/productsService'
import { useTranslation } from '../i18n'
import { supabase } from '../lib/supabase'

export function CheckoutPage() {
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  usePageMeta(t('meta.checkout.title'), t('meta.checkout.desc'))

  const [shipping, setShipping] = useState({
    fullName: '',
    city: '',
    area: '',
    landmark: '',
    phone: '',
  })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({
    loading: false,
    msgKey: null,
    variant: 'muted',
  })
  const paymentInfo = getPaymentIntegrationStatus()

  const cartItems = state.cart
    .map((item) => {
      const product = state.products.find((value) => value.id === item.productId)
      return { ...item, product }
    })
    .filter((item) => item.product && item.product.price > 0)
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const deliveryFee = subtotal > 12000 ? 0 : state.deliveryFee
  const total = subtotal + deliveryFee

  const shippingValid = useMemo(() => {
    return (
      shipping.fullName.trim() &&
      shipping.city.trim() &&
      shipping.area.trim() &&
      /^(\+251|0)\d{9}$/.test(shipping.phone.trim())
    )
  }, [shipping])

  if (!state.cart.length) {
    return (
      <article className="card card-body">
        <h2>{t('checkout.emptyCart')}</h2>
        <Link to="/products" className="btn btn-primary">
          {t('checkout.shopNow')}
        </Link>
      </article>
    )
  }

  const validateShipping = () => {
    const nextErrors = {}
    if (!shipping.fullName.trim()) nextErrors.fullName = 'checkout.validation.fullName'
    if (!shipping.city.trim()) nextErrors.city = 'checkout.validation.city'
    if (!shipping.area.trim()) nextErrors.area = 'checkout.validation.area'
    if (!/^(\+251|0)\d{9}$/.test(shipping.phone.trim())) {
      nextErrors.phone = 'checkout.validation.phone'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handlePay = async () => {
    if (!validateShipping() || !shippingValid) {
      setStatus({ loading: false, msgKey: 'checkout.msg.fillAddress', variant: 'error' })
      return
    }

    setStatus({ loading: true, msgKey: 'checkout.msg.processingPayment', variant: 'muted' })
    try {
      const paymentResult = await initiateTelebirrPayment({ subtotal, deliveryFee, total })
      if (!paymentResult.paid) {
        setStatus({ loading: false, msgKey: 'checkout.msg.paymentFailed', variant: 'error' })
        return
      }

      // ── Step 1: generate ID and resolve auth identity ────────────
      const orderId = `ORD-${Date.now()}`

      // Resolve user identity from the best available source.
      const { data: { session: activeSession } } = await supabase.auth.getSession()
      let userId, userEmail, idSource
      if (activeSession?.user?.id) {
        userId    = activeSession.user.id
        userEmail = activeSession.user.email || state.user?.email || null
        idSource  = 'supabase.auth.getSession()'
      } else if (state.user?.id) {
        userId    = state.user.id
        userEmail = state.user.email || null
        idSource  = 'state.user'
      } else {
        userId    = null
        userEmail = null
        idSource  = 'none (guest)'
      }
      console.log('[CheckoutPage] identity source:', idSource, '| userId:', userId, '| email:', userEmail)

      const customer = userId
        ? { id: userId, phone: state.user?.phone, name: state.user?.name || shipping.fullName }
        : { name: shipping.fullName, phone: shipping.phone }

      // ── Step 2: Supabase insert — FIRST, before any local state or navigation ──
      console.log('[CheckoutPage] attempting supabase insert, orderId:', orderId)
      const supabasePayload = {
        id: orderId,
        user_id: userId,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        customer_email: userEmail,
        items: cartItems,
        shipping,
        payment: paymentResult,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        payment_status: 'paid',
        status: 'confirmed',
      }
      console.log('[CheckoutPage] supabase payload:', supabasePayload)
      const { error: insertError } = await supabase.from('orders').insert(supabasePayload)
      if (insertError) {
        console.error('[CheckoutPage] Supabase insert FAILED:', insertError.message, '| code:', insertError.code, '| hint:', insertError.hint, '| details:', insertError.details)
      } else {
        console.log('[CheckoutPage] Supabase insert SUCCESS, orderId:', orderId)
      }

      // ── Step 3: update local store ────────────────────────────────
      dispatch({ type: 'SAVE_ADDRESS', payload: shipping })
      const newOrder = {
        id: orderId,
        items: cartItems,
        subtotal,
        deliveryFee,
        total,
        shipping,
        payment: paymentResult,
        paymentStatus: 'paid',
        status: 'confirmed',
        customer,
        createdAt: new Date().toISOString(),
      }
      dispatch({ type: 'ORDER_CREATE', payload: newOrder })

      // ── Step 4: background tasks ──────────────────────────────────
      recalculateBestSellers([newOrder, ...state.orders])

      // ── Step 5: navigate ──────────────────────────────────────────
      navigate(`/order-confirmation/${orderId}`)
    } catch (err) {
      console.error('[CheckoutPage] handlePay caught error:', err)
      setStatus({ loading: false, msgKey: 'checkout.msg.paymentUnavailable', variant: 'error' })
    }
  }

  const statusClass =
    status.variant === 'success' ? 'success-text' : status.variant === 'error' ? 'error-text' : 'muted'

  return (
    <div className="layout-split">
      <section className="card card-body">
        <h1>{t('checkout.title')}</h1>

        {/* Auth status — real Supabase session or guest note */}
        <p className="muted" style={{ marginBottom: '1rem' }}>
          {state.user
            ? t('auth.signedInAs', { email: state.user.email || state.user.id })
            : t('checkout.guestNote')}
        </p>

        <h3>{t('checkout.stepShipping')}</h3>
        {Object.keys(errors).length > 0 ? (
          <p className="error-text">{t('checkout.fillBeforePayment')}</p>
        ) : null}

        <div className="form-group">
          <label htmlFor="fullName">{t('checkout.fullName')}</label>
          <input
            id="fullName"
            value={shipping.fullName}
            onChange={(event) => setShipping((value) => ({ ...value, fullName: event.target.value }))}
          />
          {errors.fullName ? <span className="error-text">{t(errors.fullName)}</span> : null}
        </div>
        <div className="form-group">
          <label htmlFor="city">{t('checkout.city')}</label>
          <input
            id="city"
            value={shipping.city}
            onChange={(event) => setShipping((value) => ({ ...value, city: event.target.value }))}
          />
          {errors.city ? <span className="error-text">{t(errors.city)}</span> : null}
        </div>
        <div className="form-group">
          <label htmlFor="area">{t('checkout.area')}</label>
          <input
            id="area"
            value={shipping.area}
            onChange={(event) => setShipping((value) => ({ ...value, area: event.target.value }))}
          />
          {errors.area ? <span className="error-text">{t(errors.area)}</span> : null}
        </div>
        <div className="form-group">
          <label htmlFor="landmark">{t('checkout.landmark')}</label>
          <input
            id="landmark"
            value={shipping.landmark}
            onChange={(event) => setShipping((value) => ({ ...value, landmark: event.target.value }))}
          />
        </div>
        <div className="form-group">
          <label htmlFor="phone">{t('checkout.phone')}</label>
          <input
            id="phone"
            placeholder={t('checkout.phonePlaceholder')}
            value={shipping.phone}
            onChange={(event) => setShipping((value) => ({ ...value, phone: event.target.value }))}
          />
          {errors.phone ? <span className="error-text">{t(errors.phone)}</span> : null}
        </div>
      </section>

      <aside className="card card-body">
        <h3>{t('checkout.orderSummary')}</h3>
        {cartItems.map((item) => (
          <p key={item.key}>
            {item.product?.name} x {item.quantity}
          </p>
        ))}
        <hr style={{ border: '1px solid var(--border)', width: '100%' }} />
        <p>
          {t('cart.subtotal')}: {birr(subtotal)}
        </p>
        <p>
          {t('cart.deliveryFee')}: {deliveryFee === 0 ? t('cart.free') : birr(deliveryFee)}
        </p>
        <p>
          <strong>
            {t('cart.total')}: {birr(total)}
          </strong>
        </p>
        <p className="muted">{paymentInfo.isLive ? t('payment.live') : t('payment.mock')}</p>
        {status.msgKey ? <p className={statusClass}>{t(status.msgKey)}</p> : null}
        <button className="btn btn-primary" disabled={status.loading} onClick={handlePay}>
          {status.loading ? t('checkout.processing') : t('checkout.payTelebirr')}
        </button>
      </aside>
    </div>
  )
}
