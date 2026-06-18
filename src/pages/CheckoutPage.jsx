import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { birr, formatDeliveryDate, addCalendarDays } from '../utils/format'
import { fetchCategories, fetchProducts, fetchSubcategories, recalculateBestSellers } from '../services/productsService'
import { completeReferralReward } from '../services/referral'
import { notifyAdmins } from '../services/notificationsService'
import { useWalletCredit } from '../services/wallet'
import { useTranslation } from '../i18n'
import { supabase } from '../lib/supabase'
import { fetchDefaultShipping, saveDefaultShipping } from '../lib/auth'

function IconCod() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="14" fill="#2d9e6b"/>
      <path d="M9 14l3.5 3.5L19 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function IconTelebirr() {
  return <img src="/telebirr-logo.png" alt="Telebirr" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
}

function IconCbe() {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#1565C0"/>
        <text x="16" y="21" textAnchor="middle" fill="white" fontFamily="system-ui,-apple-system,sans-serif" fontSize="11" fontWeight="700" letterSpacing="0.3">CBE</text>
      </svg>
    )
  }
  return <img src="/cbe-logo.png" alt="CBE" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} onError={() => setFailed(true)} />
}

function IconCamera() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

// Referral discount constants
const REFERRAL_DISCOUNT_PCT  = 0.10
const REFERRAL_DISCOUNT_CAP  = 150
const REFERRAL_MIN_ORDER     = 300

// Student discount constants
const STUDENT_DISCOUNT_PCT = 0.05
const STUDENT_DISCOUNT_CAP = 500

// First-order welcome discount (flat amount, all new customers)
const FIRST_ORDER_DISCOUNT_AMOUNT = 500

export function CheckoutPage() {
  const { t, language } = useTranslation()
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
  const [status, setStatus] = useState({ loading: false, msgKey: null, variant: 'muted' })
  const [stockErrors, setStockErrors] = useState([])

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState(null)  // null | 'cod' | 'telebirr' | 'cbe'
  const [paymentShake, setPaymentShake]   = useState(false)
  const [paymentError, setPaymentError]   = useState(false)
  const paymentSectionRef = useRef(null)
  const [payWhen, setPayWhen] = useState('after')           // 'after' | 'now'
  const [screenshot, setScreenshot] = useState(null)
  const [screenshotPreview, setScreenshotPreview] = useState('')
  const [screenshotUploadError, setScreenshotUploadError] = useState(false)
  const screenshotRef = useRef(null)

  // Referral & wallet state
  const [isFirstOrder, setIsFirstOrder]   = useState(false)
  const [walletBalance, setWalletBalance] = useState(state.wallet?.balance ?? 0)
  const [useWallet, setUseWallet]         = useState(false)

  // Pre-fill all shipping fields when user is signed in.
  // Priority: existing form input > Supabase saved > localStorage addresses > user profile.
  useEffect(() => {
    if (!state.user?.id) return
    const local = state.addresses[0] ?? {}
    // Seed immediately from localStorage so the form is never blank on slow connections.
    setShipping((prev) => ({
      fullName: prev.fullName || local.fullName || state.user.name  || '',
      phone:    prev.phone    || local.phone    || state.user.phone || '',
      city:     prev.city     || local.city     || '',
      area:     prev.area     || local.area     || '',
      landmark: prev.landmark || local.landmark || '',
    }))
    // Then try Supabase for cross-device sync — overwrites only still-empty fields.
    // DB stores { name, phone, city, subCity, landmark }; map back to form field names.
    fetchDefaultShipping(state.user.id).then((remote) => {
      if (!remote) return
      setShipping((prev) => ({
        fullName: prev.fullName || remote.name    || '',
        phone:    prev.phone    || remote.phone   || '',
        city:     prev.city     || remote.city    || '',
        area:     prev.area     || remote.subCity || '',
        landmark: prev.landmark || remote.landmark || '',
      }))
    })
  }, [state.user?.id])

  // Check first-order status (all users) and load wallet balance.
  useEffect(() => {
    if (!state.user?.id) return
    // First-order: true when this user has placed zero orders ever.
    // No payment_status filter — any existing order means they're not new.
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', state.user.id)
      .then(({ count }) => setIsFirstOrder(count === 0))
    supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', state.user.id)
      .single()
      .then(({ data }) => {
        const bal = Number(data?.balance ?? 0)
        setWalletBalance(bal)
        dispatch({ type: 'WALLET_LOADED', payload: { balance: bal } })
      })
  }, [state.user?.id])

  // Redirect to /cart only when the customer removes the last item via the mini-cart
  // controls. The orderPlaced ref prevents this from firing when ORDER_CREATE clears
  // the cart on a successful order (which triggers its own navigate to /order-confirmation).
  const prevCartLength = useRef(state.cart.length)
  const orderPlaced = useRef(false)
  useEffect(() => {
    if (prevCartLength.current > 0 && state.cart.length === 0 && !orderPlaced.current) {
      navigate('/cart')
    }
    prevCartLength.current = state.cart.length
  }, [state.cart.length])

  // Cart
  const cartItems = state.cart
    .map((item) => {
      const product = state.products.find((p) => p.id === item.productId)
      return { ...item, product }
    })
    .filter((item) => item.product && item.product.price > 0)

  const subtotal    = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0)
  const deliveryFee = 0

  // Referral discount — only for referred users placing their first order
  const referralDiscount = useMemo(() => {
    if (!isFirstOrder || !state.user?.referred_by || subtotal < REFERRAL_MIN_ORDER) return 0
    return Math.min(Math.floor(subtotal * REFERRAL_DISCOUNT_PCT), REFERRAL_DISCOUNT_CAP)
  }, [isFirstOrder, subtotal, state.user?.referred_by])

  // Student discount
  const studentDiscount = useMemo(() => {
    if (!state.user?.student_discount_enabled) return 0
    return Math.min(Math.floor(subtotal * STUDENT_DISCOUNT_PCT), STUDENT_DISCOUNT_CAP)
  }, [state.user?.student_discount_enabled, subtotal])

  // First-order flat discount — all new customers, regardless of referral status
  const firstOrderDiscount = isFirstOrder ? FIRST_ORDER_DISCOUNT_AMOUNT : 0

  // Estimated delivery: 3 calendar days from today, computed once per checkout session
  const estimatedDeliveryDate = useMemo(() => addCalendarDays(3), [])

  // Sequential discount chain — each step clamps to 0 so total never goes negative.
  // Order: subtotal → student → first-order → referral → delivery → wallet
  const afterStudent    = Math.max(0, subtotal - studentDiscount)
  const afterFirstOrder = Math.max(0, afterStudent - firstOrderDiscount)
  const afterReferral   = Math.max(0, afterFirstOrder - referralDiscount)
  const afterDelivery   = afterReferral + deliveryFee
  const maxWalletApplicable = Math.min(walletBalance, afterDelivery)
  const walletCreditApplied = useWallet && maxWalletApplicable > 0 ? maxWalletApplicable : 0
  const finalTotal          = afterDelivery - walletCreditApplied

  if (!state.cart.length) {
    return (
      <article className="card card-body">
        <h2>{t('checkout.emptyCart')}</h2>
        <Link to="/products" className="btn btn-primary">{t('checkout.shopNow')}</Link>
      </article>
    )
  }

  if (!state.user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: '1rem' }}>
        <article className="card card-body" style={{ maxWidth: '420px', width: '100%', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ margin: '0 auto 1rem' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.2rem', fontWeight: 700 }}>
            {t('checkout.signInRequired')}
          </h2>
          <p className="muted" style={{ margin: '0 0 1.5rem', fontSize: '0.93rem', lineHeight: 1.5 }}>
            {t('checkout.signInRequiredHint')}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/account?returnTo=/checkout" className="btn btn-primary" style={{ minWidth: '130px' }}>
              {t('auth.signInButton')}
            </Link>
            <Link to="/account?returnTo=/checkout&tab=signup" className="btn btn-secondary" style={{ minWidth: '130px' }}>
              {t('auth.createAccount')}
            </Link>
          </div>
        </article>
      </div>
    )
  }

  const validateShipping = () => {
    const nextErrors = {}
    if (!shipping.fullName.trim()) nextErrors.fullName = 'checkout.validation.fullName'
    if (!shipping.city.trim())     nextErrors.city     = 'checkout.validation.city'
    if (!shipping.area.trim())     nextErrors.area     = 'checkout.validation.area'
    if (!/^(\+251|0)\d{9}$/.test(shipping.phone.trim())) {
      nextErrors.phone = 'checkout.validation.phone'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handlePlaceOrder = async () => {
    console.log('[Checkout] handlePlaceOrder started — paymentMethod:', paymentMethod)
    // Auth guard — must be signed in; cart is preserved during redirect
    if (!state.user) {
      navigate('/account?returnTo=/checkout')
      return
    }
    if (!validateShipping()) {
      setStatus({ loading: false, msgKey: 'checkout.msg.fillAddress', variant: 'error' })
      return
    }
    if (!paymentMethod) {
      setPaymentError(true)
      setPaymentShake(true)
      setTimeout(() => setPaymentShake(false), 600)
      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setStatus({ loading: true, msgKey: 'checkout.msg.placingOrder', variant: 'muted' })

    try {
      // ── Stock validation ───────────────────────────────────────────────────
      const productIds = [...new Set(cartItems.map((i) => i.productId))]
      const { data: stockRows, error: stockFetchErr } = await supabase
        .from('products')
        .select('id, name, stock')
        .in('id', productIds)

      if (stockFetchErr) {
        console.error('[Checkout] stock fetch error:', stockFetchErr.message)
        setStatus({ loading: false, msgKey: 'checkout.msg.orderFailed', variant: 'error' })
        return
      }

      const stockMap = Object.fromEntries((stockRows || []).map((p) => [p.id, p]))
      const newStockErrors = []
      for (const item of cartItems) {
        const live = stockMap[item.productId]
        if (!live || live.stock <= 0) {
          newStockErrors.push(t('checkout.stock.outOfStock', { name: item.product?.name ?? item.productId }))
        } else if (item.quantity > live.stock) {
          newStockErrors.push(t('checkout.stock.insufficient', { name: item.product?.name ?? item.productId, n: live.stock }))
        }
      }
      if (newStockErrors.length > 0) {
        setStockErrors(newStockErrors)
        setStatus({ loading: false, msgKey: null, variant: 'muted' })
        return
      }
      setStockErrors([])

      // Upload screenshot if user chose "pay now"
      let screenshotUrl = null
      if (paymentMethod !== 'cod' && payWhen === 'now' && screenshot) {
        const ext = screenshot.name.split('.').pop().toLowerCase()
        const fileName = `pay-${Date.now()}.${ext}`
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('payments')
          .upload(fileName, screenshot, { cacheControl: '3600', upsert: false })
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('payments').getPublicUrl(uploadData.path)
          screenshotUrl = urlData.publicUrl
        } else {
          console.warn('[Checkout] screenshot upload failed (non-blocking):', uploadErr.message)
          setScreenshotUploadError(true)
        }
      }

      // Resolve user identity — auth guard above ensures a signed-in user exists
      const orderId = `ORD-${Date.now()}`
      const { data: { session: activeSession } } = await supabase.auth.getSession()
      const userId    = activeSession?.user?.id    ?? state.user.id
      const userEmail = activeSession?.user?.email ?? state.user.email ?? null

      // Second-layer defence: if somehow we reach here without a valid session, abort
      if (!userId) {
        navigate('/account?returnTo=/checkout')
        return
      }

      const customer = { id: userId, phone: state.user.phone, name: state.user.name || shipping.fullName }

      const payment = {
        method: paymentMethod,
        when: paymentMethod === 'cod' ? 'on_delivery' : payWhen,
        screenshotUrl,
      }

      // Attach stock snapshot to each order item so fulfilment has a clear record
      const itemsWithStock = cartItems.map((item) => ({
        ...item,
        stockAtOrder: stockMap[item.productId]?.stock ?? null,
      }))

      // Insert order — payment_status is 'pending'; admin confirms before delivery
      const orderPayload = {
        id:                 orderId,
        user_id:            userId,
        customer_name:      customer.name,
        customer_phone:     customer.phone || null,
        customer_email:     userEmail,
        items:              itemsWithStock,
        shipping,
        payment,
        subtotal,
        delivery_fee:       deliveryFee,
        total:              finalTotal,
        payment_status:     'pending',
        status:             'order_received',
        referral_discount:    referralDiscount,
        student_discount:     studentDiscount,
        first_order_discount:     firstOrderDiscount,
        wallet_credit_used:       walletCreditApplied,
        estimated_delivery_date:  estimatedDeliveryDate,
      }
      console.log('[Checkout] inserting order — payload:', orderPayload)
      const { error: insertError } = await supabase.from('orders').insert(orderPayload)
      console.log('[Checkout] insert result — error:', insertError ?? 'none')

      if (insertError) {
        console.error('[Checkout] insert error:', insertError.message)
        setStatus({ loading: false, msgKey: 'checkout.msg.orderFailed', variant: 'error' })
        return
      }

      // Decrement stock for each ordered item — awaited so UI reflects new levels
      const stockDecrements = await Promise.all(
        cartItems.map((item) =>
          supabase
            .from('products')
            .update({ stock: Math.max(0, (stockMap[item.productId]?.stock ?? 0) - item.quantity) })
            .eq('id', item.productId)
            .select('id, stock'),
        ),
      )
      let anyDecrementFailed = false
      for (const { data, error } of stockDecrements) {
        if (error) {
          anyDecrementFailed = true
          console.error(
            '[Checkout] stock decrement failed — check Supabase RLS:',
            error.message,
            error,
            '\nRequired policy: authenticated users must be able to UPDATE the products table (or use a service-role edge function).',
          )
        } else {
          console.log('[Checkout] stock decremented:', data)
        }
      }

      // Refetch full catalogue so the store and all UI reflect the new stock levels
      if (!anyDecrementFailed) {
        Promise.all([fetchProducts(), fetchCategories(), fetchSubcategories()]).then(
          ([products, categories, subcategories]) => {
            dispatch({ type: 'CATALOGUE_LOADED', payload: { products, categories, subcategories } })
          },
        )
      }

      // Post-order rewards (fire-and-forget)
      if (userId) {
        if (state.user?.referred_by) {
          completeReferralReward(orderId, userId).catch(console.error)
        }
        if (walletCreditApplied > 0) {
          useWalletCredit(userId, walletCreditApplied, orderId).then(({ success, newBalance }) => {
            if (success) dispatch({ type: 'WALLET_LOADED', payload: { balance: newBalance } })
          })
        }
      }

      dispatch({ type: 'SAVE_ADDRESS', payload: shipping })
      // Persist delivery details for future checkouts (fire-and-forget).
      if (userId) saveDefaultShipping(userId, shipping)
      const newOrder = {
        id: orderId,
        items: cartItems,
        subtotal,
        deliveryFee,
        total: finalTotal,
        referralDiscount,
        firstOrderDiscount,
        walletCreditUsed: walletCreditApplied,
        estimatedDeliveryDate,
        shipping,
        payment,
        paymentStatus: 'pending',
        status: 'order_received',
        customer,
        createdAt: new Date().toISOString(),
      }
      // Notify admin users about the new order (fire-and-forget)
      notifyAdmins({ orderId, customerName: customer.name, total: finalTotal }).catch(() => {})

      console.log('[Checkout] dispatching ORDER_CREATE — this will clear the cart. orderId:', orderId)
      orderPlaced.current = true
      dispatch({ type: 'ORDER_CREATE', payload: newOrder })
      recalculateBestSellers([newOrder, ...state.orders])

      console.log('[Checkout] navigating to /order-confirmation/', orderId)
      navigate(`/order-confirmation/${orderId}`)
    } catch (err) {
      console.error('[Checkout] handlePlaceOrder error:', err)
      setStatus({ loading: false, msgKey: 'checkout.msg.orderFailed', variant: 'error' })
    }
  }

  const statusClass =
    status.variant === 'error'   ? 'error-text'
    : status.variant === 'success' ? 'success-text'
    : 'muted'

  return (
    <div className="layout-split">

      {/* ── Left column: delivery + payment ─────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Delivery Details */}
        <section className="card card-body">
          <h1 style={{ marginBottom: '0.25rem' }}>{t('checkout.title')}</h1>
          <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.88rem' }}>
            {state.user
              ? t('auth.signedInAs', { email: state.user.email || state.user.id })
              : t('checkout.guestNote')}
          </p>

          <h3>{t('checkout.stepShipping')}</h3>
          {Object.keys(errors).length > 0 && (
            <p className="error-text">{t('checkout.fillBeforePayment')}</p>
          )}

          {[
            { id: 'fullName', label: t('checkout.fullName'),  autoComplete: 'name' },
            { id: 'city',     label: t('checkout.city'),      autoComplete: 'address-level2' },
            { id: 'area',     label: t('checkout.area'),      autoComplete: 'address-level3' },
            { id: 'landmark', label: t('checkout.landmark'),  autoComplete: 'off', optional: true },
          ].map(({ id, label, autoComplete, optional }) => (
            <div className="form-group" key={id}>
              <label htmlFor={`shipping-${id}`}>{label}</label>
              <input
                id={`shipping-${id}`}
                autoComplete={autoComplete}
                value={shipping[id]}
                onChange={(e) => setShipping((v) => ({ ...v, [id]: e.target.value }))}
              />
              {!optional && errors[id] && (
                <span className="error-text">{t(errors[id])}</span>
              )}
            </div>
          ))}

          <div className="form-group">
            <label htmlFor="shipping-phone">{t('checkout.phone')}</label>
            <input
              id="shipping-phone"
              type="tel"
              autoComplete="tel"
              placeholder={t('checkout.phonePlaceholder')}
              value={shipping.phone}
              onChange={(e) => setShipping((v) => ({ ...v, phone: e.target.value }))}
            />
            {errors.phone && <span className="error-text">{t(errors.phone)}</span>}
          </div>
        </section>

        {/* Payment Method */}
        <section ref={paymentSectionRef} className={`card card-body${paymentShake ? ' chk-payment--shake' : ''}`}>
          <h3 style={{ marginBottom: '0.6rem' }}>{t('checkout.paymentMethod')}</h3>

          {/* Trust signals */}
          <div className="chk-trust-strip">
            <span>✓ {t('checkout.trustNoUpfront')}</span>
            <span>✓ {t('checkout.trustConfirm')}</span>
          </div>

          {/* Payment option cards */}
          <div className="chk-payment">
            <button
              type="button"
              className={`chk-payment__option${paymentMethod === 'cod' ? ' chk-payment__option--active' : ''}`}
              onClick={() => { setPaymentMethod('cod'); setPaymentError(false) }}
            >
              <span className="chk-payment__icon"><IconCod /></span>
              <span className="chk-payment__info">
                <span className="chk-payment__label">
                  {t('checkout.paymentCod')}
                  <span className="chk-payment__badge">{t('checkout.paymentRecommended')}</span>
                </span>
                <span className="chk-payment__hint">{t('checkout.paymentCodHint')}</span>
              </span>
            </button>

            <button
              type="button"
              className={`chk-payment__option${paymentMethod === 'telebirr' ? ' chk-payment__option--active' : ''}`}
              onClick={() => { setPaymentMethod('telebirr'); setPaymentError(false) }}
            >
              <span className="chk-payment__icon"><IconTelebirr /></span>
              <span className="chk-payment__info">
                <span className="chk-payment__label">{t('checkout.paymentTelebirr')}</span>
              </span>
            </button>

            <button
              type="button"
              className={`chk-payment__option${paymentMethod === 'cbe' ? ' chk-payment__option--active' : ''}`}
              onClick={() => { setPaymentMethod('cbe'); setPaymentError(false) }}
            >
              <span className="chk-payment__icon"><IconCbe /></span>
              <span className="chk-payment__info">
                <span className="chk-payment__label">{t('checkout.paymentCbe')}</span>
              </span>
            </button>
          </div>

          {paymentError && (
            <p className="error-text" style={{ margin: '0.4rem 0 0', fontSize: '0.88rem' }}>
              {t('checkout.validation.paymentMethod')}
            </p>
          )}

          {/* Pay timing — only for Telebirr / CBE */}
          {paymentMethod && paymentMethod !== 'cod' && (
            <div className="chk-pay-when">
              <p className="chk-pay-when__title">{t('checkout.payWhenTitle')}</p>
              <div className="chk-pay-when__options">
                <label className={`chk-pay-when__opt${payWhen === 'after' ? ' chk-pay-when__opt--active' : ''}`}>
                  <input
                    type="radio"
                    name="payWhen"
                    value="after"
                    checked={payWhen === 'after'}
                    onChange={() => setPayWhen('after')}
                  />
                  <span className="chk-pay-when__opt-body">
                    <span className="chk-pay-when__opt-label">{t('checkout.payWhenAfter')}</span>
                    <span className="chk-pay-when__opt-hint">{t('checkout.payWhenAfterHint')}</span>
                  </span>
                </label>
                <label className={`chk-pay-when__opt${payWhen === 'now' ? ' chk-pay-when__opt--active' : ''}`}>
                  <input
                    type="radio"
                    name="payWhen"
                    value="now"
                    checked={payWhen === 'now'}
                    onChange={() => setPayWhen('now')}
                  />
                  <span className="chk-pay-when__opt-body">
                    <span className="chk-pay-when__opt-label">{t('checkout.payWhenNow')}</span>
                    <span className="chk-pay-when__opt-hint">{t('checkout.payWhenNowHint')}</span>
                  </span>
                </label>
              </div>

              {/* Pay now — account details + screenshot */}
              {payWhen === 'now' && (
                <>
                <div className="chk-pay-now">
                  <div className="chk-pay-now__account">
                    <span className="chk-pay-now__account-label">
                      {paymentMethod === 'telebirr' ? 'Telebirr' : 'CBE Account'}
                    </span>
                    <span className="chk-pay-now__account-value">
                      {paymentMethod === 'telebirr'
                        ? t('checkout.telebirrNumber')
                        : t('checkout.cbeAccount')}
                    </span>
                  </div>
                  <p className="chk-pay-now__amount">
                    Amount: <strong>{birr(finalTotal)}</strong>
                  </p>

                  {/* Screenshot upload */}
                  <div
                    className={`chk-screenshot${screenshotPreview ? ' chk-screenshot--has-image' : ''}`}
                    onClick={() => screenshotRef.current?.click()}
                    onKeyDown={(e) => e.key === 'Enter' && screenshotRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    aria-label={screenshot ? t('checkout.changeScreenshot') : t('checkout.uploadScreenshot')}
                  >
                    {screenshotPreview ? (
                      <>
                        <img src={screenshotPreview} alt="Payment receipt" className="chk-screenshot__preview" />
                        <span className="chk-screenshot__change">{t('checkout.changeScreenshot')}</span>
                      </>
                    ) : (
                      <>
                        <span className="chk-screenshot__icon"><IconCamera /></span>
                        <span className="chk-screenshot__label">{t('checkout.uploadScreenshot')}</span>
                        <span className="chk-screenshot__hint">{t('checkout.uploadScreenshotHint')}</span>
                      </>
                    )}
                  </div>
                  <input
                    ref={screenshotRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setScreenshot(file)
                      setScreenshotPreview(URL.createObjectURL(file))
                      setScreenshotUploadError(false)
                    }}
                    style={{ display: 'none' }}
                  />
                </div>
                {screenshotUploadError && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {t('checkout.uploadFailed')}
                  </p>
                )}
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {t('checkout.uploadOptionalHint')}
                </p>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Right column: order summary ──────────────────────────────────────── */}
      <aside className="card card-body">
        {isFirstOrder && (
          <div className="chk-first-order-banner">
            {t('checkout.firstOrderBanner')}
          </div>
        )}

        <h3>{t('checkout.orderSummary')}</h3>

        {cartItems.map((item) => (
          <div
            key={item.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              padding: '0.65rem 0',
              gap: '0.6rem',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: '0.88rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.product.name}
              </strong>
              {(item.size || item.color) && (
                <p className="muted" style={{ margin: '0.1rem 0 0', fontSize: '0.78rem' }}>
                  {item.size} / {item.color}
                </p>
              )}
              <p style={{ margin: '0.1rem 0 0', fontSize: '0.82rem' }}>
                {birr(item.product.price)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexShrink: 0 }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.1rem 0.45rem', fontSize: '1rem', lineHeight: 1.2 }}
                onClick={() =>
                  dispatch({ type: 'CART_UPDATE', payload: { key: item.key, quantity: item.quantity - 1 } })
                }
              >
                -
              </button>
              <span style={{ minWidth: '1.4rem', textAlign: 'center', fontSize: '0.9rem' }}>
                {item.quantity}
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.1rem 0.45rem', fontSize: '1rem', lineHeight: 1.2 }}
                onClick={() =>
                  dispatch({ type: 'CART_UPDATE', payload: { key: item.key, quantity: item.quantity + 1 } })
                }
              >
                +
              </button>
              <button
                className="btn btn-danger"
                style={{ padding: '0.1rem 0.45rem', fontSize: '0.9rem', lineHeight: 1.2 }}
                aria-label={`Remove ${item.product.name}`}
                onClick={() =>
                  dispatch({ type: 'CART_REMOVE', payload: { key: item.key } })
                }
              >
                ×
              </button>
            </div>
          </div>
        ))}

        <hr style={{ border: '1px solid var(--border)', width: '100%', margin: '0.75rem 0' }} />

        <div className="chk-line">
          <span>{t('cart.subtotal')}</span>
          <span>{birr(subtotal)}</span>
        </div>

        {studentDiscount > 0 && (
          <div className="chk-line chk-line--discount">
            <span>🎓 {t('studentDiscount.discountLine')}</span>
            <span>−{birr(studentDiscount)}</span>
          </div>
        )}

        {firstOrderDiscount > 0 && (
          <div className="chk-line chk-line--first-order">
            <span>{t('checkout.firstOrderDiscount')}</span>
            <span>−{birr(firstOrderDiscount)}</span>
          </div>
        )}

        {referralDiscount > 0 && (
          <div className="chk-line chk-line--discount">
            <span>🎁 {t('checkout.referralDiscount')}</span>
            <span>−{birr(referralDiscount)}</span>
          </div>
        )}
        {isFirstOrder && subtotal > 0 && subtotal < REFERRAL_MIN_ORDER && state.user?.referred_by && (
          <p className="chk-note">{t('checkout.referralMinNote', { min: birr(REFERRAL_MIN_ORDER) })}</p>
        )}

        <div className="chk-line">
          <span>{t('cart.deliveryFee')}</span>
          <span>{deliveryFee === 0 ? t('cart.free') : birr(deliveryFee)}</span>
        </div>

        {walletBalance > 0 && (
          <div className="chk-wallet">
            <label className="chk-wallet__label">
              <input
                type="checkbox"
                checked={useWallet}
                onChange={(e) => setUseWallet(e.target.checked)}
                className="chk-wallet__checkbox"
              />
              <span>{t('checkout.applyWallet', { amount: birr(walletBalance) })}</span>
            </label>
            {useWallet && walletCreditApplied > 0 && (
              <div className="chk-line chk-line--wallet">
                <span>{t('checkout.walletCredit')}</span>
                <span>−{birr(walletCreditApplied)}</span>
              </div>
            )}
          </div>
        )}

        <hr style={{ border: '1px solid var(--border)', width: '100%', margin: '0.75rem 0' }} />

        <div className="chk-line chk-line--total">
          <span>{t('cart.total')}</span>
          <span>{birr(finalTotal)}</span>
        </div>

        <div className="chk-delivery-promise">
          <svg className="chk-delivery-promise__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1" y="3" width="15" height="13" rx="1"/>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          <div>
            <p className="chk-delivery-promise__label">{t('checkout.estimatedDelivery')}</p>
            <p className="chk-delivery-promise__date">{formatDeliveryDate(estimatedDeliveryDate, language)}</p>
          </div>
        </div>

        {firstOrderDiscount > 0 && (
          <p className="chk-note chk-note--first-order">
            ✓ {t('checkout.firstOrderApplied')}
          </p>
        )}
        {referralDiscount > 0 && (
          <p className="chk-note chk-note--success">
            ✓ {t('checkout.referralApplied', { amount: birr(referralDiscount) })}
          </p>
        )}
        {studentDiscount > 0 && (
          <p className="chk-note chk-note--success">
            ✓ {t('studentDiscount.discountApplied', { amount: birr(studentDiscount) })}
          </p>
        )}

        {status.msgKey && (
          <p className={statusClass} style={{ margin: '0.5rem 0 0.75rem' }}>{t(status.msgKey)}</p>
        )}

        {stockErrors.length > 0 && (
          <ul style={{ margin: '0.5rem 0 0.75rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {stockErrors.map((msg, i) => (
              <li key={i} className="error-text" style={{ margin: 0, fontSize: '0.9rem' }}>{msg}</li>
            ))}
          </ul>
        )}

        <button
          className="btn btn-primary"
          disabled={status.loading}
          onClick={handlePlaceOrder}
          style={{ width: '100%', marginTop: '0.5rem' }}
        >
          {status.loading ? t('checkout.processing') : t('checkout.placeOrder')}
        </button>

        <p className="muted" style={{ fontSize: '0.78rem', textAlign: 'center', marginTop: '0.6rem' }}>
          ✓ {t('checkout.trustNoUpfront')} · ✓ {t('checkout.trustConfirm')}
        </p>
      </aside>

    </div>
  )
}
