import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { birr } from '../utils/format'
import { getPaymentIntegrationStatus, initiateTelebirrPayment } from '../services/payment'
import { recalculateBestSellers } from '../services/productsService'
import { completeReferralReward } from '../services/referral'
import { useWalletCredit } from '../services/wallet'
import { useTranslation } from '../i18n'
import { supabase } from '../lib/supabase'

// Referral discount constants
const REFERRAL_DISCOUNT_PCT  = 0.10   // 10%
const REFERRAL_DISCOUNT_CAP  = 150    // ETB
const REFERRAL_MIN_ORDER     = 300    // ETB minimum subtotal

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

  // ── Referral & wallet state ──────────────────────────────────────────────
  const [isFirstOrder, setIsFirstOrder]   = useState(false)
  const [walletBalance, setWalletBalance] = useState(state.wallet?.balance ?? 0)
  const [useWallet, setUseWallet]         = useState(false)

  const paymentInfo = getPaymentIntegrationStatus()

  // Pre-fill shipping name/phone when user is signed in.
  useEffect(() => {
    if (!state.user) return
    setShipping((prev) => ({
      ...prev,
      fullName: prev.fullName || state.user.name || '',
      phone:    prev.phone    || state.user.phone || '',
    }))
  }, [state.user?.id])

  // Load referral eligibility and wallet balance when signed-in user loads the page.
  useEffect(() => {
    if (!state.user?.id) return

    // Check if this is the user's first paid order (discount applies only once).
    if (state.user.referred_by) {
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', state.user.id)
        .eq('payment_status', 'paid')
        .then(({ count }) => {
          setIsFirstOrder(count === 0)
        })
    }

    // Wallet balance — prefer fresh Supabase value over cached store.
    supabase
      .from('wallets')
      .select('balance_etb')
      .eq('user_id', state.user.id)
      .single()
      .then(({ data }) => {
        const bal = Number(data?.balance_etb ?? 0)
        setWalletBalance(bal)
        dispatch({ type: 'WALLET_LOADED', payload: { balance: bal } })
      })
  }, [state.user?.id])

  // ── Cart ────────────────────────────────────────────────────────────────
  const cartItems = state.cart
    .map((item) => {
      const product = state.products.find((p) => p.id === item.productId)
      return { ...item, product }
    })
    .filter((item) => item.product && item.product.price > 0)

  const subtotal    = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0)
  const deliveryFee = subtotal > 12000 ? 0 : state.deliveryFee

  // ── Referral discount ────────────────────────────────────────────────────
  const referralDiscount = useMemo(() => {
    if (!isFirstOrder || subtotal < REFERRAL_MIN_ORDER) return 0
    return Math.min(Math.floor(subtotal * REFERRAL_DISCOUNT_PCT), REFERRAL_DISCOUNT_CAP)
  }, [isFirstOrder, subtotal])

  // ── Wallet credit ────────────────────────────────────────────────────────
  const afterDiscount       = subtotal - referralDiscount + deliveryFee
  const maxWalletApplicable = Math.min(walletBalance, afterDiscount)
  const walletCreditApplied = useWallet && maxWalletApplicable > 0 ? maxWalletApplicable : 0
  const finalTotal          = afterDiscount - walletCreditApplied

  const shippingValid = useMemo(() => (
    shipping.fullName.trim() &&
    shipping.city.trim() &&
    shipping.area.trim() &&
    /^(\+251|0)\d{9}$/.test(shipping.phone.trim())
  ), [shipping])

  if (!state.cart.length) {
    return (
      <article className="card card-body">
        <h2>{t('checkout.emptyCart')}</h2>
        <Link to="/products" className="btn btn-primary">{t('checkout.shopNow')}</Link>
      </article>
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

  const handlePay = async () => {
    if (!validateShipping() || !shippingValid) {
      setStatus({ loading: false, msgKey: 'checkout.msg.fillAddress', variant: 'error' })
      return
    }

    setStatus({ loading: true, msgKey: 'checkout.msg.processingPayment', variant: 'muted' })
    try {
      // ── Step 1: Telebirr payment (charge the final amount after discounts) ──
      const paymentResult = await initiateTelebirrPayment({
        subtotal:    finalTotal,
        deliveryFee: 0,
        total:       finalTotal,
      })
      if (!paymentResult.paid) {
        setStatus({ loading: false, msgKey: 'checkout.msg.paymentFailed', variant: 'error' })
        return
      }

      // ── Step 2: Resolve user identity ────────────────────────────────────
      const orderId = `ORD-${Date.now()}`
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
      console.log('[CheckoutPage] identity source:', idSource, '| userId:', userId)

      const customer = userId
        ? { id: userId, phone: state.user?.phone, name: state.user?.name || shipping.fullName }
        : { name: shipping.fullName, phone: shipping.phone }

      // ── Step 3: Insert order (Supabase) ──────────────────────────────────
      const supabasePayload = {
        id:                  orderId,
        user_id:             userId,
        customer_name:       customer.name,
        customer_phone:      customer.phone || null,
        customer_email:      userEmail,
        items:               cartItems,
        shipping,
        payment:             paymentResult,
        subtotal,
        delivery_fee:        deliveryFee,
        total:               finalTotal,
        payment_status:      'paid',
        status:              'confirmed',
        referral_discount:   referralDiscount,
        wallet_credit_used:  walletCreditApplied,
      }
      console.log('[CheckoutPage] inserting order:', orderId)
      const { error: insertError } = await supabase.from('orders').insert(supabasePayload)
      if (insertError) {
        console.error('[CheckoutPage] Supabase insert FAILED:', insertError.message)
      } else {
        console.log('[CheckoutPage] Supabase insert SUCCESS')
      }

      // ── Step 4: Post-payment rewards (fire-and-forget after DB write) ────
      if (userId) {
        // Award referral reward to referrer (idempotent — safe if already done).
        // isFirstOrder is a client-side hint only; the server RPC enforces the rule.
        console.log('[CheckoutPage] referral check — referred_by:', state.user?.referred_by, '| isFirstOrder (hint):', isFirstOrder)
        if (state.user?.referred_by) {
          console.log('attempting referral reward', { orderId, userId, referred_by: state.user.referred_by })
          completeReferralReward(orderId, userId).then((result) => {
            console.log('referral reward result:', result)
            if (result.error) console.log('referral reward error:', result.error)
          }).catch((err) => {
            console.log('referral reward error:', err)
          })
        } else {
          console.log('[CheckoutPage] skipping referral reward — user has no referred_by')
        }
        // Deduct wallet credit.
        if (walletCreditApplied > 0) {
          useWalletCredit(userId, walletCreditApplied, orderId).then(({ success, newBalance }) => {
            console.log('[CheckoutPage] wallet credit deducted:', success, 'new balance:', newBalance)
            if (success) {
              dispatch({ type: 'WALLET_LOADED', payload: { balance: newBalance } })
            }
          })
        }
      }

      // ── Step 5: Update local store ────────────────────────────────────────
      dispatch({ type: 'SAVE_ADDRESS', payload: shipping })
      const newOrder = {
        id:              orderId,
        items:           cartItems,
        subtotal,
        deliveryFee,
        total:           finalTotal,
        referralDiscount,
        walletCreditUsed: walletCreditApplied,
        shipping,
        payment:         paymentResult,
        paymentStatus:   'paid',
        status:          'confirmed',
        customer,
        createdAt:       new Date().toISOString(),
      }
      dispatch({ type: 'ORDER_CREATE', payload: newOrder })

      // ── Step 6: Background tasks ──────────────────────────────────────────
      recalculateBestSellers([newOrder, ...state.orders])

      navigate(`/order-confirmation/${orderId}`)
    } catch (err) {
      console.error('[CheckoutPage] handlePay error:', err)
      setStatus({ loading: false, msgKey: 'checkout.msg.paymentUnavailable', variant: 'error' })
    }
  }

  const statusClass =
    status.variant === 'success' ? 'success-text'
    : status.variant === 'error' ? 'error-text'
    : 'muted'

  return (
    <div className="layout-split">
      {/* ── Shipping form ─────────────────────────────────────────────────── */}
      <section className="card card-body">
        <h1>{t('checkout.title')}</h1>
        <p className="muted" style={{ marginBottom: '1rem' }}>
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

      {/* ── Order summary ─────────────────────────────────────────────────── */}
      <aside className="card card-body">
        <h3>{t('checkout.orderSummary')}</h3>

        {cartItems.map((item) => (
          <p key={item.key} style={{ margin: '0 0 0.3rem', fontSize: '0.9rem' }}>
            {item.product?.name} × {item.quantity}
          </p>
        ))}

        <hr style={{ border: '1px solid var(--border)', width: '100%', margin: '0.75rem 0' }} />

        {/* Subtotal */}
        <div className="chk-line">
          <span>{t('cart.subtotal')}</span>
          <span>{birr(subtotal)}</span>
        </div>

        {/* Referral discount */}
        {referralDiscount > 0 && (
          <div className="chk-line chk-line--discount">
            <span>🎁 {t('checkout.referralDiscount')}</span>
            <span>−{birr(referralDiscount)}</span>
          </div>
        )}
        {isFirstOrder && subtotal > 0 && subtotal < REFERRAL_MIN_ORDER && state.user?.referred_by && (
          <p className="chk-note">{t('checkout.referralMinNote', { min: birr(REFERRAL_MIN_ORDER) })}</p>
        )}

        {/* Delivery fee */}
        <div className="chk-line">
          <span>{t('cart.deliveryFee')}</span>
          <span>{deliveryFee === 0 ? t('cart.free') : birr(deliveryFee)}</span>
        </div>

        {/* Wallet credit toggle */}
        {walletBalance > 0 && (
          <div className="chk-wallet">
            <label className="chk-wallet__label">
              <input
                type="checkbox"
                checked={useWallet}
                onChange={(e) => setUseWallet(e.target.checked)}
                className="chk-wallet__checkbox"
              />
              <span>
                {t('checkout.applyWallet', { amount: birr(walletBalance) })}
              </span>
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

        {/* Total */}
        <div className="chk-line chk-line--total">
          <span>{t('cart.total')}</span>
          <span>{birr(finalTotal)}</span>
        </div>

        {referralDiscount > 0 && (
          <p className="chk-note chk-note--success">
            ✓ {t('checkout.referralApplied', { amount: birr(referralDiscount) })}
          </p>
        )}

        <p className="muted" style={{ fontSize: '0.82rem', margin: '0.5rem 0 1rem' }}>
          {paymentInfo.isLive ? t('payment.live') : t('payment.mock')}
        </p>

        {status.msgKey && (
          <p className={statusClass} style={{ marginBottom: '0.75rem' }}>{t(status.msgKey)}</p>
        )}

        <button className="btn btn-primary" disabled={status.loading} onClick={handlePay} style={{ width: '100%' }}>
          {status.loading ? t('checkout.processing') : t('checkout.payTelebirr')}
        </button>
      </aside>
    </div>
  )
}
