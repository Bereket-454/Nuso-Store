import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../app/store'
import { birr, formatDeliveryDate } from '../utils/format'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { checkEmailExists, checkPhoneExists, deleteAccount, isValidEthiopianPhone, signIn, signOut, signUp, updateProfile } from '../lib/auth'
import { cancelOrder, CUSTOMER_CANCEL_STATUSES } from '../services/ordersService'
import { RETURN_REASONS, fetchReturnRequestsForUser, submitReturnRequest } from '../services/returnsService'
import { getMyVerification } from '../services/studentVerificationService'
import { PaymentStatusBadge } from '../components/PaymentStatusBadge'
import { supabase } from '../lib/supabase'
import { EmptyState } from '../components/EmptyState'

export function getFirstName(fullName) {
  if (!fullName || !fullName.trim()) return 'User'
  return fullName.trim().split(/\s+/)[0]
}

function getInitials(fullName) {
  if (!fullName || !fullName.trim()) return 'U'
  return fullName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function daysAgo(isoString, t) {
  if (!isoString) return null
  const days = Math.floor((Date.now() - new Date(isoString)) / 86400000)
  if (days === 0) return t('account.today')
  if (days === 1) return t('account.yesterday')
  return t('account.daysAgo', { n: days })
}

function orderStatusClass(status) {
  const map = {
    'Confirmed': 'dash-status--confirmed',
    'Packed': 'dash-status--packed',
    'Out for Delivery': 'dash-status--on-the-way',
    'Delivered': 'dash-status--delivered',
    'confirmed': 'dash-status--confirmed',
    'packed': 'dash-status--packed',
    'out-for-delivery': 'dash-status--on-the-way',
    'delivered': 'dash-status--delivered',
    'cancelled': 'dash-status--cancelled',
  }
  return map[status] || 'dash-status--confirmed'
}

// Orders that are still in-flight (not yet delivered or cancelled)
const ACTIVE_ORDER_STATUSES = new Set([
  'order_received', 'confirming', 'confirmed', 'preparing', 'out_for_delivery',
])
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// ─── Icons ────────────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconPackage() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

function IconPin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  )
}

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function IconSpark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

function IconGift() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  )
}


function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

// ─── Password input with show/hide toggle ────────────────────────────────────

function PasswordInput({ id, value, onChange, onBlur, disabled, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        style={{ paddingRight: '2.5rem' }}
      />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((s) => !s)}
        disabled={disabled}
        style={{
          position: 'absolute',
          right: '0.6rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          padding: '0.25rem',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1,
        }}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

// ─── Edit profile form ────────────────────────────────────────────────────────

function EditProfileForm({ user, t, dispatch, onClose }) {
  const [name, setName] = useState(user.name || '')
  const [phone, setPhone] = useState(user.phone || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    if (!name.trim()) { setError(t('auth.fullNameRequired')); return }
    if (phone.trim() && !isValidEthiopianPhone(phone)) { setError(t('auth.invalidPhone')); return }

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) { setError(t('account.currentPasswordRequired')); return }
      if (newPassword.length < 6) { setError(t('auth.passwordTooShort')); return }
      if (newPassword !== confirmPassword) { setError(t('account.passwordMismatch')); return }

      const { error: reAuthErr } = await signIn(user.email, currentPassword)
      if (reAuthErr) { setError(t('account.wrongCurrentPassword')); return }
    }

    setLoading(true)
    setError('')

    const { error: updateErr } = await updateProfile({
      userId: user.id,
      name: name.trim(),
      phone: phone.trim() || undefined,
      newPassword: newPassword || null,
    })

    setLoading(false)

    if (updateErr) { setError(t('account.updateError')); return }

    dispatch({
      type: 'UPDATE_USER',
      payload: {
        name: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      },
    })
    setSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>
        {t('account.editProfile')}
      </h3>

      {success ? <p className="success-text" style={{ marginBottom: '0.75rem' }}>{t('account.profileUpdated')}</p> : null}

      <div className="form-group">
        <label htmlFor="edit-name">{t('auth.fullNameLabel')}</label>
        <input id="edit-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
      </div>

      <div className="form-group">
        <label htmlFor="edit-phone">{t('auth.phoneLabel')}</label>
        <input id="edit-phone" type="tel" autoComplete="tel" placeholder="+2519XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
      </div>

      <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
        {t('account.changePassword')} <span style={{ fontWeight: 400 }}>({t('account.optional')})</span>
      </p>

      <div className="form-group">
        <label htmlFor="edit-current-pw">{t('account.currentPassword')}</label>
        <PasswordInput id="edit-current-pw" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={loading} />
      </div>
      <div className="form-group">
        <label htmlFor="edit-new-pw">{t('account.newPassword')}</label>
        <PasswordInput id="edit-new-pw" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={loading} />
      </div>
      <div className="form-group">
        <label htmlFor="edit-confirm-pw">{t('account.confirmPassword')}</label>
        <PasswordInput id="edit-confirm-pw" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} />
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? '...' : t('account.saveChanges')}
        </button>
        <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
          {t('account.cancelEdit')}
        </button>
      </div>
    </div>
  )
}

// ─── Sign-in form ─────────────────────────────────────────────────────────────

function SignInForm({ t, onSwitchToSignUp }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorType, setErrorType] = useState(null)

  async function handleSignIn() {
    if (!email.trim()) { setErrorType('emailRequired'); return }
    setLoading(true)
    setErrorType(null)
    try {
      const { data, error: err } = await signIn(email.trim(), password)
      if (err) {
        const msg = (err.message || '').toLowerCase()
        if (msg.includes('email not confirmed')) {
          setErrorType('notConfirmed')
        } else if (
          msg.includes('invalid login credentials') ||
          msg.includes('invalid_credentials') ||
          msg.includes('user not found') ||
          msg.includes('no user found')
        ) {
          setErrorType('invalidCredentials')
        } else {
          console.error('[AccountPage] signIn unexpected error:', err)
          setErrorType('generic')
        }
      }
    } catch (err) {
      console.error('[AccountPage] signIn exception:', err)
      setErrorType('generic')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1a2340', letterSpacing: '0.05em' }}>
            NUSO <span style={{ color: '#FF6B00' }}>STORE</span>
          </span>
        </div>

        <div className="card card-body" style={{ padding: '2rem' }}>
          <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.15rem', fontWeight: 700 }}>
            {t('auth.signInTitle')}
          </h2>
          <div className="form-group">
            <label htmlFor="signin-email">{t('auth.emailLabel')}</label>
            <input id="signin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
              <label htmlFor="signin-password" style={{ margin: 0 }}>{t('auth.passwordLabel')}</label>
              <Link to="/forgot-password" style={{ fontSize: '0.82rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <PasswordInput id="signin-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
          </div>
          {errorType === 'emailRequired' && (
            <p className="error-text">{t('auth.emailRequired')}</p>
          )}
          {(errorType === 'invalidCredentials' || errorType === 'wrongPassword' || errorType === 'notFound' || errorType === 'notConfirmed' || errorType === 'generic') && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--danger)' }}>
              {errorType === 'invalidCredentials' && t('auth.signInErrorInvalidCredentials')}
              {errorType === 'wrongPassword' && t('auth.signInErrorWrongPassword')}
              {errorType === 'notFound' && (
                <>{t('auth.signInErrorNotFound')}{' '}
                  <button type="button" onClick={onSwitchToSignUp} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--danger)', cursor: 'pointer', fontSize: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
                    {t('auth.createAccount')}
                  </button>
                </>
              )}
              {errorType === 'notConfirmed' && t('auth.signInErrorNotConfirmed')}
              {errorType === 'generic' && t('auth.signInError')}
            </div>
          )}
          <button className="btn btn-primary" onClick={handleSignIn} disabled={loading} style={{ width: '100%', marginTop: '0.25rem' }}>
            {loading ? '...' : t('auth.signInButton')}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
          {t('auth.newToDire')}{' '}
          <button type="button" onClick={onSwitchToSignUp} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 'inherit', fontWeight: 600 }}>
            {t('auth.createAccount')}
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Sign-up form ─────────────────────────────────────────────────────────────

function SignUpForm({ t, onVerificationSent, onSwitchToSignIn, prefillReferralCode }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [referralCode, setReferralCode] = useState(prefillReferralCode || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dupType, setDupType] = useState(null)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const emailRef = useRef(null)
  const phoneRef = useRef(null)

  useEffect(() => {
    if (dupType === 'duplicateEmail') emailRef.current?.focus()
    else if (dupType === 'duplicatePhone') phoneRef.current?.focus()
  }, [dupType])

  function setFieldError(msg) { setError(msg); setDupType(null) }
  function setDuplicateError(type) { setError(''); setDupType(type) }

  const showPasswordLengthErr = (passwordTouched || submitted) && password.length > 0 && password.length < 8
  const showConfirmErr = (confirmTouched || submitted) && confirmPassword !== password

  async function handleSignUp() {
    setSubmitted(true)
    if (!fullName.trim()) { setFieldError(t('auth.fullNameRequired')); return }
    if (!email.trim()) { setFieldError(t('auth.emailRequired')); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFieldError(t('auth.invalidEmail')); return }
    if (!password) { setFieldError(t('auth.passwordRequired')); return }
    if (password.length < 8) return
    if (confirmPassword !== password) return
    if (!isValidEthiopianPhone(phone)) { setFieldError(t('auth.invalidPhone')); return }

    setLoading(true)
    setError('')
    setDupType(null)

    try {
      const { exists: phoneExists, error: phoneCheckErr } = await checkPhoneExists(phone)
      if (!phoneCheckErr && phoneExists) {
        setDuplicateError('duplicatePhone')
      } else {
        const { data, error: err } = await signUp(email.trim(), password, phone, fullName.trim(), referralCode.trim() || null)

        if (err) {
          const msg = (err.message || '').toLowerCase()
          if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
            setDuplicateError('duplicateEmail')
          } else {
            setFieldError(t('auth.signUpError'))
          }
        } else if (data.user && data.user.identities?.length === 0) {
          setDuplicateError('duplicateEmail')
        } else if (!data.session) {
          onVerificationSent()
        }
      }
    } catch {
      setFieldError(t('auth.signUpError'))
    } finally {
      setLoading(false)
    }
  }

  const dupBoxStyle = { background: '#c0392b', color: '#ffffff', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '0.75rem', fontSize: '0.92rem', fontWeight: 500, lineHeight: 1.45 }

  return (
    <article className="card card-body">
      <h2>{t('auth.signUpTab')}</h2>
      <div className="form-group">
        <label htmlFor="signup-name">{t('auth.fullNameLabel')}</label>
        <input id="signup-name" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={loading} />
      </div>
      <div className="form-group">
        <label htmlFor="signup-email">{t('auth.emailLabel')}</label>
        <input id="signup-email" ref={emailRef} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
      </div>
      <div className="form-group">
        <label htmlFor="signup-password">{t('auth.passwordLabel')}</label>
        <PasswordInput id="signup-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setPasswordTouched(true)} disabled={loading} />
        {showPasswordLengthErr && <p className="error-text" style={{ margin: '0.25rem 0 0' }}>{t('auth.passwordMinLength')}</p>}
      </div>
      <div className="form-group">
        <label htmlFor="signup-confirm-password">{t('auth.confirmPasswordLabel')}</label>
        <PasswordInput id="signup-confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onBlur={() => setConfirmTouched(true)} disabled={loading} />
        {showConfirmErr && <p className="error-text" style={{ margin: '0.25rem 0 0' }}>{t('auth.passwordsMismatch')}</p>}
      </div>
      <div className="form-group">
        <label htmlFor="signup-phone">{t('auth.phoneLabel')}</label>
        <input id="signup-phone" ref={phoneRef} type="tel" autoComplete="tel" placeholder="+2519XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
      </div>
      <div className="form-group">
        <label htmlFor="signup-ref-code">
          {t('auth.referralCodeLabel')}{' '}
          <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: '0.85em' }}>({t('account.optional')})</span>
        </label>
        <input
          id="signup-ref-code"
          type="text"
          autoComplete="off"
          placeholder={t('auth.referralCodePlaceholder')}
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          disabled={loading}
          style={{ fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}
        />
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {dupType === 'duplicateEmail' && (
        <div style={dupBoxStyle}>
          {t('auth.duplicateEmail')}{' '}
          <button type="button" onClick={onSwitchToSignIn} style={{ background: 'none', border: 'none', padding: 0, color: '#ffffff', cursor: 'pointer', fontSize: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
            {t('auth.signInButton')}
          </button>
        </div>
      )}
      {dupType === 'duplicatePhone' && <div style={dupBoxStyle}>{t('auth.duplicatePhone')}</div>}

      <button className="btn btn-primary" onClick={handleSignUp} disabled={loading}>
        {loading ? '...' : t('auth.signUpButton')}
      </button>
      <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
        {t('auth.alreadyHaveAccount')}{' '}
        <button type="button" onClick={onSwitchToSignIn} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent)', cursor: 'pointer', fontSize: 'inherit', fontWeight: 600 }}>
          {t('auth.signInButton')}
        </button>
      </p>
    </article>
  )
}

// ─── Verify email notice ──────────────────────────────────────────────────────

function VerifyEmailNotice({ t }) {
  return (
    <article className="card card-body">
      <h2>{t('auth.signUpTab')}</h2>
      <p>{t('auth.verifyEmailNotice')}</p>
    </article>
  )
}

// ─── Auth card — manages tab / verification state ─────────────────────────────

function AuthCard({ t }) {
  const [searchParams] = useSearchParams()
  const prefillRef = searchParams.get('ref') || ''
  const tabParam = searchParams.get('tab')
  // Open signup tab if explicitly requested via ?tab=signup or when a referral code is present.
  const [tab, setTab] = useState(tabParam === 'signup' || prefillRef ? 'signup' : 'signin')
  const [verificationSent, setVerificationSent] = useState(false)

  if (verificationSent) return <VerifyEmailNotice t={t} />

  if (tab === 'signin') {
    return <SignInForm t={t} onSwitchToSignUp={() => setTab('signup')} />
  }
  return (
    <SignUpForm
      t={t}
      onVerificationSent={() => setVerificationSent(true)}
      onSwitchToSignIn={() => setTab('signin')}
      prefillReferralCode={prefillRef}
    />
  )
}

// ─── Logged-in dashboard ──────────────────────────────────────────────────────

function ProfileCard({ user, t, state, dispatch }) {
  const firstName = getFirstName(user.name)
  const initials = getInitials(user.name)
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()
  const { language, setLanguage } = useTranslation()

  function handleSignOut() {
    dispatch({ type: 'AUTH_CHANGED', payload: null })
    navigate('/')
    signOut()
  }

  const [dbOrders, setDbOrders] = useState(null)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState(false)
  const [cancellingId, setCancellingId]   = useState(null)
  const [cancelReason, setCancelReason]   = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError]     = useState('')
  const [ordersFilter, setOrdersFilter]   = useState('active')

  // Student verification status — seeded from profile flag, then confirmed via DB
  const [studentStatus, setStudentStatus] = useState(
    user.student_verified ? 'approved' : null,
  )
  useEffect(() => {
    if (user.student_verified) return
    getMyVerification(user.id).then(({ data }) => {
      setStudentStatus(data?.status ?? 'none')
    })
  }, [user.id, user.student_verified])

  async function handleCancelOrder(order) {
    setCancelLoading(true)
    setCancelError('')
    const { error } = await cancelOrder({ orderId: order.id, reason: cancelReason, items: order.items, payment: order.payment })
    if (error) {
      setCancelError(t('cancel.error'))
      setCancelLoading(false)
      return
    }
    const paidOnline = order.payment?.method !== 'cod' && order.payment?.when === 'now'
    setDbOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status:             'cancelled',
              cancelledAt:        new Date().toISOString(),
              cancellationReason: cancelReason,
              ...(paidOnline ? { paymentStatus: 'refund_needed' } : {}),
            }
          : o,
      ),
    )
    setCancellingId(null)
    setCancelReason('')
    setCancelLoading(false)
  }

  async function fetchOrders() {
    setOrdersLoading(true)
    setOrdersError(false)
    const [ordersRes, returnsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, total, status, payment_status, refund_reason, refund_reference, refunded_at, created_at, updated_at, payment, shipping, items, cancelled_at, cancellation_reason, estimated_delivery_date')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      fetchReturnRequestsForUser(user.id),
    ])
    if (ordersRes.error) {
      setOrdersError(true)
      setOrdersLoading(false)
      return
    }
    setDbOrders(
      (ordersRes.data ?? []).map((row) => ({
        id:                 row.id,
        total:              row.total,
        status:             row.status,
        paymentStatus:      row.payment_status,
        refundReason:       row.refund_reason ?? null,
        refundReference:    row.refund_reference ?? null,
        refundedAt:         row.refunded_at ?? null,
        createdAt:          row.created_at,
        updatedAt:          row.updated_at,
        payment:            row.payment,
        shipping:           row.shipping,
        items:              row.items ?? [],
        cancelledAt:           row.cancelled_at             ?? null,
        cancellationReason:    row.cancellation_reason      ?? '',
        estimatedDeliveryDate: row.estimated_delivery_date  ?? null,
      })),
    )
    if (!returnsRes.error && returnsRes.data.length > 0) {
      const map = {}
      returnsRes.data.forEach((r) => { map[r.order_id] = r })
      setReturnRequests(map)
    }
    setOrdersLoading(false)
  }

  useEffect(() => { fetchOrders() }, [user.id])

  // Realtime: pick up payment_status / status changes pushed by admins
  // without requiring the customer to refresh or re-open the Orders tab.
  useEffect(() => {
    const channel = supabase
      .channel(`customer-orders-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new
          setDbOrders((prev) =>
            prev
              ? prev.map((o) =>
                  o.id === row.id
                    ? {
                        ...o,
                        status:             row.status,
                        paymentStatus:      row.payment_status,
                        updatedAt:          row.updated_at,
                        cancelledAt:        row.cancelled_at  ?? null,
                        cancellationReason: row.cancellation_reason ?? '',
                      }
                    : o,
                )
              : prev,
          )
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user.id])

  const [openTab, setOpenTab] = useState(null)
  const ordersTabRef    = useRef(null)
  const addressesTabRef = useRef(null)

  function toggleTab(tab) {
    const next = openTab === tab ? null : tab
    setOpenTab(next)
    if (tab === 'orders' && next === 'orders') fetchOrders()
    if (next) {
      const ref = tab === 'orders' ? ordersTabRef : addressesTabRef
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }

  const orders       = dbOrders ?? []
  const orderCount   = orders.length
  const addressCount = state.addresses.length
  const lastOrderAgo = orders[0]?.createdAt ? daysAgo(orders[0].createdAt, t) : null

  const cutoff = Date.now() - THIRTY_DAYS_MS
  const isRecentDelivered = (o) => o.status === 'delivered' && new Date(o.createdAt).getTime() > cutoff

  const filterCounts = {
    active:    orders.filter((o) => ACTIVE_ORDER_STATUSES.has(o.status) || isRecentDelivered(o)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled' || o.paymentStatus === 'refunded').length,
    all:       orders.length,
  }

  const filteredOrders = (() => {
    switch (ordersFilter) {
      case 'active':    return orders.filter((o) => ACTIVE_ORDER_STATUSES.has(o.status) || isRecentDelivered(o))
      case 'delivered': return orders.filter((o) => o.status === 'delivered')
      case 'cancelled': return orders.filter((o) => o.status === 'cancelled' || o.paymentStatus === 'refunded')
      default:          return orders
    }
  })()
  const walletBal    = state.wallet?.balance ?? 0

  const [returnRequests, setReturnRequests]       = useState({})
  const [returningOrderId, setReturningOrderId]   = useState(null)
  const [returnReason, setReturnReason]           = useState('')
  const [returnDescription, setReturnDescription] = useState('')
  const [returnLoading, setReturnLoading]         = useState(false)
  const [returnError, setReturnError]             = useState('')

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const prefersReduced = useReducedMotion()

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return

    // Block deletion if the user has any in-flight orders
    const hasActiveOrders = orders.some((o) => ACTIVE_ORDER_STATUSES.has(o.status))
    if (hasActiveOrders) {
      setDeleteError(t('account.deleteBlockedByOrders'))
      return
    }

    setDeleting(true)
    setDeleteError('')
    const { error } = await deleteAccount(user.id)
    if (error) {
      setDeleting(false)
      setDeleteError(t('account.deleteError'))
      return
    }
    dispatch({ type: 'AUTH_CHANGED', payload: null })
    navigate('/')
  }

  async function handleSubmitReturn(order) {
    if (!returnReason) { setReturnError(t('returns.selectReason')); return }
    setReturnLoading(true)
    setReturnError('')
    const { data, error } = await submitReturnRequest(order.id, user.id, returnReason, returnDescription)
    setReturnLoading(false)
    if (error) { setReturnError(t('returns.submitError')); return }
    setReturnRequests((prev) => ({ ...prev, [order.id]: data }))
    setReturningOrderId(null)
    setReturnReason('')
    setReturnDescription('')
  }

  return (
    <>
    <div className="dash-page">

      {/* ── Welcome card ────────────────────────────────────────────── */}
      <div className="dash-welcome">
        <div className="dash-avatar" aria-hidden="true">{initials}</div>
        <div className="dash-welcome__body">
          <h1 className="dash-welcome__name">
            {orderCount > 0
              ? t('account.welcomeBack', { name: firstName })
              : t('account.welcomeNew',  { name: firstName })}
          </h1>
          <p className="dash-welcome__sub">{t('account.dashSubtitle')}</p>
          <p className="dash-welcome__email">{user.email || user.id}</p>
          {user.role === 'admin' ? (
            <span className="dash-welcome__role">{t('nav.admin')}</span>
          ) : null}
          {user.student_verified && (
            <span className="dash-welcome__role" style={{ background: 'var(--success)', marginLeft: '0.35rem' }}>
              {t('account.studentVerified')}
            </span>
          )}

          {/* Stats row */}
          {(orderCount > 0 || addressCount > 0 || walletBal > 0) ? (
            <div className="dash-stats">
              <div className="dash-stat">
                <span className="dash-stat__num">{orderCount}</span>
                <span className="dash-stat__label">{t('account.yourOrders')}</span>
              </div>
              {walletBal > 0 && (
                <div className="dash-stat">
                  <span className="dash-stat__num dash-stat__num--sm">{birr(walletBal)}</span>
                  <span className="dash-stat__label">{t('account.walletBalance')}</span>
                </div>
              )}
              {lastOrderAgo ? (
                <div className="dash-stat">
                  <span className="dash-stat__num dash-stat__num--sm">{lastOrderAgo}</span>
                  <span className="dash-stat__label">{t('account.lastOrder')}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Sign-out — visually quiet, top-right */}
        <button type="button" className="dash-sign-out-btn" onClick={handleSignOut}>
          {t('auth.signOut')}
        </button>
      </div>

      {/* ── Shop CTA ────────────────────────────────────────────────── */}
      <motion.div
        className="dash-shop-cta"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReduced ? 0 : 0.28, delay: prefersReduced ? 0 : 0.08 }}
      >
        <span className="dash-shop-cta__title">{t('account.readyToShop')}</span>
        <motion.div
          className="dash-shop-cta__btn-wrap"
          whileTap={prefersReduced ? {} : { scale: 1.05 }}
          transition={{ duration: 0.12 }}
        >
          <Link to="/products" className="dash-shop-cta__btn">
            {t('account.shopNow')}
            <span className="dash-shop-cta__arrow" aria-hidden="true">→</span>
          </Link>
        </motion.div>
      </motion.div>

      {/* ── Quick actions ────────────────────────────────────────────── */}
      <div className="dash-quick">
        <button type="button" className={`dash-action${openTab === 'orders' ? ' dash-action--active' : ''}`} onClick={() => toggleTab('orders')}>
          <div className="dash-action__icon-wrap"><IconPackage /></div>
          <span className="dash-action__label">{t('account.viewOrders')}</span>
        </button>
        <Link to="/tracking" className="dash-action">
          <div className="dash-action__icon-wrap"><IconPin /></div>
          <span className="dash-action__label">{t('account.trackOrder')}</span>
        </Link>
        <button type="button" className={`dash-action${openTab === 'addresses' ? ' dash-action--active' : ''}`} onClick={() => toggleTab('addresses')}>
          <div className="dash-action__icon-wrap"><IconHome /></div>
          <span className="dash-action__label">{t('account.manageAddress')}</span>
        </button>
        <Link to="/referral" className="dash-action">
          <div className="dash-action__icon-wrap"><IconGift /></div>
          <span className="dash-action__label">{t('account.referralRewards')}</span>
        </Link>
        <Link to="/student-discount" className={`dash-action${studentStatus === 'approved' ? ' dash-action--student-verified' : ''}`}>
          <div className="dash-action__icon-wrap">🎓</div>
          <span className="dash-action__label">{t('account.studentDiscount')}</span>
          {studentStatus && (
            <span className={`dash-action__status${
              studentStatus === 'approved' ? ' dash-action__status--approved'
              : studentStatus === 'pending' ? ' dash-action__status--pending'
              : ''
            }`}>
              {studentStatus === 'approved' ? t('account.svApproved')
               : studentStatus === 'pending' ? t('account.svPending')
               : t('account.svNone')}
            </span>
          )}
        </Link>
      </div>

      {/* ── My Orders ───────────────────────────────────────────────── */}
      <div ref={ordersTabRef} className={`dash-tab-panel${openTab === 'orders' ? ' dash-tab-panel--open' : ''}`}>
      <div className="dash-section" id="dash-orders">
        <div className="dash-section__head">
          <div className="dash-section__icon-wrap"><IconPackage /></div>
          <div>
            <h2 className="dash-section__title">{t('account.yourOrders')}</h2>
            <p className="dash-section__desc">{t('account.ordersDesc')}</p>
          </div>
          {orderCount > 0 ? (
            <span className="dash-section__badge">{orderCount}</span>
          ) : null}
        </div>
        <div className="dash-section__body">
          {ordersLoading && dbOrders === null ? (
            <p className="muted" style={{ textAlign: 'center', padding: '1.5rem 0' }}>...</p>
          ) : ordersError ? (
            <EmptyState
              icon="alert-circle"
              title={t('account.ordersError')}
              hint={t('account.ordersErrorHint')}
              ctaLabel={t('error.tryAgain')}
              ctaOnClick={fetchOrders}
              danger
            />
          ) : orders.length === 0 ? (
            <div className="dash-empty">
              <span className="dash-empty__icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" height="64" style={{ width: 'auto' }}>
                  <path d="M6 24 L6 56 Q6 60 10 60 L46 60 Q50 60 50 56 L50 24 Z" fill="#1a2340"/>
                  <path d="M28 24 L50 24 L50 46 Z" fill="#FF6B00"/>
                  <path d="M16 24 Q16 10 28 10 Q40 10 40 24" fill="none" stroke="#FF6B00" strokeWidth="4" strokeLinecap="round"/>
                  <rect x="11" y="30" width="6" height="22" rx="1.5" fill="white"/>
                  <rect x="35" y="30" width="6" height="22" rx="1.5" fill="white"/>
                  <line x1="17" y1="30" x2="35" y2="52" stroke="#FF6B00" strokeWidth="6" strokeLinecap="round"/>
                  <text x="62" y="36" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="26" fill="#1a2340">NUSO</text>
                  <text x="78" y="55" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="16" fill="#FF6B00" letterSpacing="4">STORE</text>
                </svg>
              </span>
              <p className="dash-empty__msg">{t('account.noOrders')}</p>
              <Link to="/products" className="btn btn-primary dash-empty__cta">
                {t('account.startShopping')}
              </Link>
            </div>
          ) : (
            <>
              {/* ── Filter tabs ───────────────────────────────────────── */}
              <div className="my-orders-tabs" role="tablist">
                {[
                  { id: 'active',    label: t('account.filterActive') },
                  { id: 'delivered', label: t('account.filterDelivered') },
                  { id: 'cancelled', label: t('account.filterCancelled') },
                  { id: 'all',       label: t('account.filterAll') },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={ordersFilter === id}
                    className={`my-orders-tab${ordersFilter === id ? ' my-orders-tab--active' : ''}`}
                    onClick={() => setOrdersFilter(id)}
                  >
                    {label}
                    {filterCounts[id] > 0 && (
                      <span className="my-orders-tab__badge">{filterCounts[id]}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Filtered order list ───────────────────────────────── */}
              {filteredOrders.length === 0 ? (
                <div className="dash-empty">
                  <span className="dash-empty__icon" aria-hidden="true">📦</span>
                  <p className="dash-empty__msg">
                    {ordersFilter === 'active'    && t('account.noActiveOrders')}
                    {ordersFilter === 'delivered' && t('account.noDeliveredOrders')}
                    {ordersFilter === 'cancelled' && t('account.noCancelledOrders')}
                    {ordersFilter === 'all'       && t('account.noOrders')}
                  </p>
                  {ordersFilter !== 'cancelled' && (
                    <Link to="/products" className="btn btn-primary dash-empty__cta">
                      {t('account.startShopping')}
                    </Link>
                  )}
                </div>
              ) : (
                <div className="dash-orders">
                  {filteredOrders.map((order) => {
                    const isCancellable = CUSTOMER_CANCEL_STATUSES.has(order.status)
                    const isCancelling  = cancellingId === order.id
                    return (
                      <div key={order.id} className="dash-order" style={{ flexWrap: 'wrap' }}>
                        <div className="dash-order__left">
                          <p className="dash-order__id">{order.id}</p>
                          <p className="dash-order__total">{birr(order.total)}</p>
                          <p className="dash-order__payment" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <span className="muted" style={{ fontSize: '0.8rem' }}>{t('account.paymentLabel')}:</span>
                            <PaymentStatusBadge status={order.paymentStatus || 'pending'} />
                          </p>
                        </div>
                        <div className="dash-order__right">
                          <span className={`dash-status ${orderStatusClass(order.status)}`}>
                            {t(`orderStatus.${order.status}`)}
                          </span>
                          {order.createdAt ? (
                            <span className="dash-order__date">{daysAgo(order.createdAt, t)}</span>
                          ) : null}
                        </div>

                        {/* Cancellation info box — only in Cancelled tab */}
                        {ordersFilter === 'cancelled' && order.status === 'cancelled' && (
                          <div className="dash-order__cancel-note">
                            {order.cancellationReason
                              ? <><strong>{t('tracker.cancelReason')}:</strong> {order.cancellationReason}</>
                              : <span className="muted">{t('cancel.success')}</span>
                            }
                          </div>
                        )}

                        {/* Refund pending info */}
                        {order.paymentStatus === 'refund_needed' && (
                          <p className="dash-order__refund-info">
                            {t('account.refundPending')}
                          </p>
                        )}

                        {/* Refunded info */}
                        {order.paymentStatus === 'refunded' && (
                          <p className="dash-order__refund-info dash-order__refund-info--done">
                            {t('account.refundDone', { date: order.refundedAt ? new Date(order.refundedAt).toLocaleDateString() : '—' })}
                            {order.refundReference && (
                              <span style={{ marginLeft: '0.5rem', opacity: 0.75 }}>
                                · {t('account.refundRef')}: {order.refundReference}
                              </span>
                            )}
                          </p>
                        )}

                        {/* Estimated delivery — active orders only */}
                        {ACTIVE_ORDER_STATUSES.has(order.status) && order.estimatedDeliveryDate && (
                          <p className="dash-order__est-delivery">
                            {t('account.estimatedDelivery')}: <strong>{formatDeliveryDate(order.estimatedDeliveryDate, language)}</strong>
                          </p>
                        )}

                        {/* Contact Support — active orders only */}
                        {ACTIVE_ORDER_STATUSES.has(order.status) && (
                          <a
                            href="https://t.me/nusostore"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dash-order__support-link"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.6l-2.94-.918c-.64-.203-.654-.64.135-.954l11.57-4.461c.537-.194 1.006.131.96.954z"/>
                            </svg>
                            {t('support.contactSupport')}
                          </a>
                        )}

                        {/* Cancel button / inline form */}
                        {isCancellable && (
                          <div className="dash-order__cancel">
                            {isCancelling ? (
                              <div className="dash-order__cancel-form">
                                <textarea
                                  value={cancelReason}
                                  onChange={(e) => setCancelReason(e.target.value)}
                                  placeholder={t('cancel.reasonPlaceholder')}
                                  disabled={cancelLoading}
                                />
                                {cancelError && (
                                  <p className="error-text" style={{ margin: 0, fontSize: '0.82rem' }}>{cancelError}</p>
                                )}
                                <div className="dash-order__cancel-actions">
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ background: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                                    onClick={() => handleCancelOrder(order)}
                                    disabled={cancelLoading}
                                  >
                                    {cancelLoading ? '…' : t('cancel.confirmBtn')}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                                    onClick={() => { setCancellingId(null); setCancelReason(''); setCancelError('') }}
                                    disabled={cancelLoading}
                                  >
                                    {t('cancel.abortBtn')}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.85rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                onClick={() => { setCancellingId(order.id); setCancelReason(''); setCancelError('') }}
                              >
                                {t('cancel.requestBtn')}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Return request — delivered orders only */}
                        {order.status === 'delivered' && (() => {
                          const req = returnRequests[order.id]
                          if (req) {
                            return (
                              <div className={`dash-order__return-status return-status--${req.status}`}>
                                {req.status === 'pending'  && t('returns.pending')}
                                {req.status === 'approved' && t('returns.approved')}
                                {req.status === 'rejected' && t('returns.rejected')}
                                {req.admin_note && (
                                  <span className="return-status__note"> · {req.admin_note}</span>
                                )}
                              </div>
                            )
                          }
                          if (returningOrderId === order.id) {
                            return (
                              <div className="dash-order__return-form">
                                <select
                                  value={returnReason}
                                  onChange={(e) => setReturnReason(e.target.value)}
                                  disabled={returnLoading}
                                >
                                  <option value="">{t('returns.selectReasonPlaceholder')}</option>
                                  {RETURN_REASONS.map((r) => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                  ))}
                                </select>
                                <textarea
                                  value={returnDescription}
                                  onChange={(e) => setReturnDescription(e.target.value)}
                                  placeholder={t('returns.descriptionPlaceholder')}
                                  disabled={returnLoading}
                                  rows={2}
                                />
                                {returnError && (
                                  <p className="error-text" style={{ margin: 0, fontSize: '0.82rem' }}>{returnError}</p>
                                )}
                                <div className="dash-order__return-actions">
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                                    onClick={() => handleSubmitReturn(order)}
                                    disabled={returnLoading || !returnReason}
                                  >
                                    {returnLoading ? '…' : t('returns.submitBtn')}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}
                                    onClick={() => { setReturningOrderId(null); setReturnReason(''); setReturnDescription(''); setReturnError('') }}
                                    disabled={returnLoading}
                                  >
                                    {t('returns.cancelBtn')}
                                  </button>
                                </div>
                              </div>
                            )
                          }
                          const withinWindow = order.updatedAt
                            ? (Date.now() - new Date(order.updatedAt).getTime()) < 72 * 60 * 60 * 1000
                            : false
                          if (!withinWindow) {
                            return (
                              <p className="return-window-closed">{t('returns.windowClosed')}</p>
                            )
                          }
                          return (
                            <button
                              type="button"
                              className="dash-order__return-btn"
                              onClick={() => { setReturningOrderId(order.id); setReturnReason(''); setReturnDescription(''); setReturnError('') }}
                            >
                              {t('returns.requestReturn')}
                            </button>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </div>

      {/* ── My Addresses ────────────────────────────────────────────── */}
      <div ref={addressesTabRef} className={`dash-tab-panel${openTab === 'addresses' ? ' dash-tab-panel--open' : ''}`}>
      <div className="dash-section" id="dash-addresses">
        <div className="dash-section__head">
          <div className="dash-section__icon-wrap"><IconHome /></div>
          <div>
            <h2 className="dash-section__title">{t('account.yourAddresses')}</h2>
            <p className="dash-section__desc">{t('account.addressesDesc')}</p>
          </div>
          {addressCount > 0 ? (
            <span className="dash-section__badge">{addressCount}</span>
          ) : null}
        </div>
        <div className="dash-section__body">
          {state.addresses.length === 0 ? (
            <div className="dash-empty">
              <span className="dash-empty__icon" aria-hidden="true">📍</span>
              <p className="dash-empty__msg">{t('account.noAddresses')}</p>
              <p className="dash-empty__hint">{t('account.noAddressesHint')}</p>
            </div>
          ) : (
            state.addresses.map((address, idx) => (
              <div key={address.id ?? idx} className="dash-addr">
                <p className="dash-addr__name">{address.fullName}</p>
                <p className="dash-addr__detail">
                  {address.city}, {address.area}
                  {address.landmark ? ` — ${address.landmark}` : ''}
                </p>
                <p className="dash-addr__detail">{address.phone}</p>
              </div>
            ))
          )}
        </div>
      </div>
      </div>

      {/* ── Account Settings ────────────────────────────────────────── */}
      <div className="dash-section" id="dash-settings">
        <button
          type="button"
          className={`dash-section__head dash-section__head--toggle${settingsOpen ? '' : ' dash-section__head--collapsed'}`}
          onClick={() => setSettingsOpen(o => !o)}
          aria-expanded={settingsOpen}
        >
          <div className="dash-section__icon-wrap"><IconSettings /></div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h2 className="dash-section__title">{t('account.accountSettings')}</h2>
            <p className="dash-section__desc">{t('account.settingsDesc')}</p>
          </div>
          <span style={{ transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', color: 'var(--muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <ChevronIcon />
          </span>
        </button>
        <div className={`dash-tab-panel${settingsOpen ? ' dash-tab-panel--open' : ''}`}>
          <div className="dash-section__body">
            {!editing ? (
              <>
                <div className="dash-info-row">
                  <span className="dash-info-row__label">{t('auth.fullNameLabel')}</span>
                  <strong className="dash-info-row__value">{user.name || '—'}</strong>
                  <button type="button" className="dash-info-row__edit" onClick={() => setEditing(true)} aria-label={t('account.editProfile')}><PencilIcon /></button>
                </div>
                <div className="dash-info-row">
                  <span className="dash-info-row__label">{t('auth.emailLabel')}</span>
                  <strong className="dash-info-row__value">{user.email || '—'}</strong>
                  <button type="button" className="dash-info-row__edit" onClick={() => setEditing(true)} aria-label={t('account.editProfile')}><PencilIcon /></button>
                </div>
                {user.phone ? (
                  <div className="dash-info-row">
                    <span className="dash-info-row__label">{t('auth.phoneLabel')}</span>
                    <strong className="dash-info-row__value">{user.phone}</strong>
                    <button type="button" className="dash-info-row__edit" onClick={() => setEditing(true)} aria-label={t('account.editProfile')}><PencilIcon /></button>
                  </div>
                ) : null}
                <div className="dash-info-row">
                  <span className="dash-info-row__label">Language</span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className={`btn${language === 'en' ? ' btn-primary' : ' btn-secondary'}`}
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                      onClick={() => setLanguage('en')}
                    >EN</button>
                    <button
                      type="button"
                      className={`btn${language === 'am' ? ' btn-primary' : ' btn-secondary'}`}
                      style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                      onClick={() => setLanguage('am')}
                    >አማ</button>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditing(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '1rem' }}
                >
                  <PencilIcon /> {t('account.editProfile')}
                </button>
              </>
            ) : (
              <EditProfileForm
                user={user}
                t={t}
                dispatch={dispatch}
                onClose={() => setEditing(false)}
              />
            )}

            {/* ── Danger zone ──────────────────────────────────── */}
            <div className="danger-zone">
              <div>
                <p className="danger-zone__title">{t('account.deleteAccountBtn')}</p>
                <p className="danger-zone__desc">{t('account.deleteAccountDesc')}</p>
              </div>
              <button
                type="button"
                className="danger-zone__btn"
                onClick={() => { setDeleteModalOpen(true); setDeleteConfirmText(''); setDeleteError('') }}
              >
                {t('account.deleteAccountBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>{/* end dash-page */}

    {/* ── Delete account modal ────────────────────────────────────── */}
    {deleteModalOpen && (
      <div
        className="delete-modal-backdrop"
        onClick={() => { if (!deleting) { setDeleteModalOpen(false) } }}
      >
        <div
          className="delete-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="delete-modal__icon" aria-hidden="true">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 id="delete-modal-title" className="delete-modal__title">{t('account.deleteModalTitle')}</h2>
          <p className="delete-modal__warning">{t('account.deleteModalWarning')}</p>
          <ul className="delete-modal__list">
            <li>{t('account.deleteWhatProfile')}</li>
            <li>{t('account.deleteWhatData')}</li>
            <li>{t('account.deleteWhatOrders')}</li>
          </ul>
          <p className="delete-modal__confirm-label">
            {t('account.deleteTypePrompt')} <strong>DELETE</strong>
          </p>
          <input
            type="text"
            className="delete-modal__input"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={deleting}
            autoComplete="off"
            spellCheck={false}
          />
          {deleteError && (
            <p className="error-text" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>{deleteError}</p>
          )}
          <div className="delete-modal__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              {t('account.deleteCancelBtn')}
            </button>
            <button
              type="button"
              className="delete-modal__confirm-btn"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'DELETE' || deleting}
            >
              {deleting ? '…' : t('account.deleteConfirmBtn')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AccountPage() {
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  usePageMeta(t('meta.account.title'), t('meta.account.desc'))

  useEffect(() => {
    const returnTo = searchParams.get('returnTo')
    if (state.user && returnTo) {
      navigate(returnTo, { replace: true })
    }
  }, [state.user, searchParams, navigate])

  return (
    <div style={{ maxWidth: '660px', margin: '1.5rem auto' }}>
      {state.user ? (
        <ProfileCard user={state.user} t={t} state={state} dispatch={dispatch} />
      ) : (
        <AuthCard t={t} />
      )}
    </div>
  )
}
