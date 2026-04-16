import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../app/store'
import { birr } from '../utils/format'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { checkEmailExists, checkPhoneExists, isValidEthiopianPhone, signIn, signOut, signUp, updateProfile } from '../lib/auth'

export function getFirstName(fullName) {
  if (!fullName || !fullName.trim()) return 'User'
  return fullName.trim().split(/\s+/)[0]
}

// ─── Eye icons ────────────────────────────────────────────────────────────────

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

    // Validate password change fields if any are filled
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) { setError(t('account.currentPasswordRequired')); return }
      if (newPassword.length < 6) { setError(t('auth.passwordTooShort')); return }
      if (newPassword !== confirmPassword) { setError(t('account.passwordMismatch')); return }

      // Re-authenticate to verify the current password before changing it
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
        <input
          id="edit-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="edit-phone">{t('auth.phoneLabel')}</label>
        <input
          id="edit-phone"
          type="tel"
          autoComplete="tel"
          placeholder="+2519XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
      </div>

      <p style={{ margin: '0.25rem 0 0.75rem', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
        {t('account.changePassword')} <span style={{ fontWeight: 400 }}>({t('account.optional')})</span>
      </p>

      <div className="form-group">
        <label htmlFor="edit-current-pw">{t('account.currentPassword')}</label>
        <PasswordInput
          id="edit-current-pw"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="edit-new-pw">{t('account.newPassword')}</label>
        <PasswordInput
          id="edit-new-pw"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="edit-confirm-pw">{t('account.confirmPassword')}</label>
        <PasswordInput
          id="edit-confirm-pw"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
        />
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

// ─── Sign-in form — centered, logo, bordered box ──────────────────────────────

function SignInForm({ t, onSwitchToSignUp }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // null | 'emailRequired' | 'wrongPassword' | 'notFound' | 'notConfirmed' | 'generic'
  const [errorType, setErrorType] = useState(null)

  async function handleSignIn() {
    console.log('handleSignIn called')
    if (!email.trim()) { setErrorType('emailRequired'); return }
    setLoading(true)
    setErrorType(null)
    try {
      console.log('calling signIn')
      const { data, error: err } = await signIn(email.trim(), password)
      console.log('signIn result:', err, data)
      if (err) {
        console.log('signIn error message:', err.message)
        const msg = (err.message || '').toLowerCase()
        if (msg.includes('email not confirmed')) {
          setErrorType('notConfirmed')
        } else if (
          msg.includes('invalid login credentials') ||
          msg.includes('invalid_credentials') ||
          msg.includes('user not found') ||
          msg.includes('no user found')
        ) {
          // Supabase returns the same error for wrong password and no account.
          // Do a profile lookup to tell them apart.
          const { exists } = await checkEmailExists(email.trim())
          setErrorType(exists ? 'wrongPassword' : 'notFound')
        } else {
          setErrorType('generic')
        }
      }
      // Success — onAuthStateChange listener updates state.user automatically.
    } catch (e) {
      console.log('signIn threw:', e)
      setErrorType('generic')
    } finally {
      console.log('finally running')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '65vh',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '0.04rem' }}>
            DI<span style={{ color: 'var(--accent)' }}>RE</span>
          </span>
        </div>

        {/* Form box */}
        <div className="card card-body" style={{ padding: '2rem' }}>
          <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.15rem', fontWeight: 700 }}>
            {t('auth.signInTitle')}
          </h2>
          <div className="form-group">
            <label htmlFor="signin-email">{t('auth.emailLabel')}</label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="signin-password">{t('auth.passwordLabel')}</label>
            <PasswordInput
              id="signin-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {errorType === 'emailRequired' && (
            <p className="error-text">{t('auth.emailRequired')}</p>
          )}
          {(errorType === 'wrongPassword' || errorType === 'notFound' || errorType === 'notConfirmed' || errorType === 'generic') && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '0.5rem',
                fontSize: '0.9rem',
                color: 'var(--danger)',
              }}
            >
              {errorType === 'wrongPassword' && t('auth.signInErrorWrongPassword')}
              {errorType === 'notFound' && (
                <>
                  {t('auth.signInErrorNotFound')}{' '}
                  <button
                    type="button"
                    onClick={onSwitchToSignUp}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      fontSize: 'inherit',
                      fontWeight: 700,
                      textDecoration: 'underline',
                    }}
                  >
                    {t('auth.createAccount')}
                  </button>
                </>
              )}
              {errorType === 'notConfirmed' && t('auth.signInErrorNotConfirmed')}
              {errorType === 'generic' && t('auth.signInError')}
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSignIn}
            disabled={loading}
            style={{ width: '100%', marginTop: '0.25rem' }}
          >
            {loading ? '...' : t('auth.signInButton')}
          </button>
        </div>

        {/* Switch to sign-up */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '1rem',
            color: 'var(--muted)',
            fontSize: '0.9rem',
          }}
        >
          {t('auth.newToDire')}{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 'inherit',
              fontWeight: 600,
            }}
          >
            {t('auth.createAccount')}
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Sign-up form ─────────────────────────────────────────────────────────────

function SignUpForm({ t, onVerificationSent, onSwitchToSignIn }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // null | 'duplicateEmail' | 'duplicatePhone'
  const [dupType, setDupType] = useState(null)
  // Touched flags — inline errors show after blur or first submit attempt
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const emailRef = useRef(null)
  const phoneRef = useRef(null)

  // Focus the offending field after the render where loading becomes false and
  // the inputs are re-enabled. Doing it mid-handler would target a disabled element.
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
    if (password.length < 8) return  // inline error shown below password field
    if (confirmPassword !== password) return  // inline error shown below confirm field
    if (!isValidEthiopianPhone(phone)) { setFieldError(t('auth.invalidPhone')); return }

    setLoading(true)
    setError('')
    setDupType(null)

    try {
      // Check for duplicate phone before hitting the auth API
      const { exists: phoneExists, error: phoneCheckErr } = await checkPhoneExists(phone)
      if (!phoneCheckErr && phoneExists) {
        setDuplicateError('duplicatePhone')
      } else {
        const { data, error: err } = await signUp(email.trim(), password, phone, fullName.trim())

        if (err) {
          const msg = (err.message || '').toLowerCase()
          if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
            setDuplicateError('duplicateEmail')
          } else {
            setFieldError(t('auth.signUpError'))
          }
        } else if (data.user && data.user.identities?.length === 0) {
          // When email confirmation is required and the email already exists, Supabase
          // returns success but with an empty identities array instead of an error.
          setDuplicateError('duplicateEmail')
        } else if (!data.session) {
          onVerificationSent()
        }
        // If session exists, onAuthStateChange handles state update automatically.
      }
    } catch {
      setFieldError(t('auth.signUpError'))
    } finally {
      setLoading(false)
      console.log('loading reset')
    }
  }

  const dupBoxStyle = {
    background: '#c0392b',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '0.85rem 1rem',
    marginBottom: '0.75rem',
    fontSize: '0.92rem',
    fontWeight: 500,
    lineHeight: 1.45,
  }

  return (
    <article className="card card-body">
      <h2>{t('auth.signUpTab')}</h2>
      <div className="form-group">
        <label htmlFor="signup-name">{t('auth.fullNameLabel')}</label>
        <input
          id="signup-name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="signup-email">{t('auth.emailLabel')}</label>
        <input
          id="signup-email"
          ref={emailRef}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="signup-password">{t('auth.passwordLabel')}</label>
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setPasswordTouched(true)}
          disabled={loading}
        />
        {showPasswordLengthErr && (
          <p className="error-text" style={{ margin: '0.25rem 0 0' }}>
            {t('auth.passwordMinLength')}
          </p>
        )}
      </div>
      <div className="form-group">
        <label htmlFor="signup-confirm-password">{t('auth.confirmPasswordLabel')}</label>
        <PasswordInput
          id="signup-confirm-password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setConfirmTouched(true)}
          disabled={loading}
        />
        {showConfirmErr && (
          <p className="error-text" style={{ margin: '0.25rem 0 0' }}>
            {t('auth.passwordsMismatch')}
          </p>
        )}
      </div>
      <div className="form-group">
        <label htmlFor="signup-phone">{t('auth.phoneLabel')}</label>
        <input
          id="signup-phone"
          ref={phoneRef}
          type="tel"
          autoComplete="tel"
          placeholder="+2519XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {dupType === 'duplicateEmail' && (
        <div style={dupBoxStyle}>
          {t('auth.duplicateEmail')}{' '}
          <button
            type="button"
            onClick={onSwitchToSignIn}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 'inherit',
              fontWeight: 700,
              textDecoration: 'underline',
            }}
          >
            {t('auth.signInButton')}
          </button>
        </div>
      )}

      {dupType === 'duplicatePhone' && (
        <div style={dupBoxStyle}>
          {t('auth.duplicatePhone')}
        </div>
      )}

      <button className="btn btn-primary" onClick={handleSignUp} disabled={loading}>
        {loading ? '...' : t('auth.signUpButton')}
      </button>
      <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
        {t('auth.alreadyHaveAccount')}{' '}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: 'inherit',
            fontWeight: 600,
          }}
        >
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
  const [tab, setTab] = useState('signin')
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
    />
  )
}

// ─── Collapsible dashboard section ───────────────────────────────────────────

function DashboardSection({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          font: 'inherit',
          fontSize: '1rem',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div
          className="card-body"
          style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

// ─── Logged-in profile + dashboard ───────────────────────────────────────────

function ProfileCard({ user, t, state, dispatch }) {
  const firstName = getFirstName(user.name)
  const [editing, setEditing] = useState(false)
  const navigate = useNavigate()

  function handleSignOut() {
    // Clear state and navigate immediately — don't wait for the Supabase network
    // round-trip. The onAuthStateChange SIGNED_OUT event will fire shortly after
    // and dispatch AUTH_CHANGED again (a no-op since user is already null).
    dispatch({ type: 'AUTH_CHANGED', payload: null })
    navigate('/')
    signOut() // fire-and-forget — cleans up the Supabase session in the background
  }

  return (
    <>
      <article className="card card-body" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.2rem' }}>
              {t('auth.helloUser', { name: firstName })}
            </h2>
            {user.name ? (
              <p style={{ margin: '0 0 0.1rem', fontWeight: 500 }}>{user.name}</p>
            ) : null}
            <p className="muted" style={{ margin: '0 0 0.9rem', fontSize: '0.9rem' }}>
              {user.email || user.id}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('account.editProfile')}
            onClick={() => setEditing((e) => !e)}
            style={{
              background: editing ? 'var(--surface)' : 'none',
              border: '1px solid var(--border)',
              padding: '0.4rem',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <PencilIcon />
          </button>
        </div>

        {user.role === 'admin' ? (
          <span className="badge" style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
            {t('nav.admin')}
          </span>
        ) : null}

        {editing ? (
          <EditProfileForm
            user={user}
            t={t}
            dispatch={dispatch}
            onClose={() => setEditing(false)}
          />
        ) : (
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
              {t('auth.signOut')}
            </button>
          </div>
        )}
      </article>

      <DashboardSection title={t('account.yourOrders')}>
        {state.orders.length === 0 ? (
          <p className="muted">{t('account.noOrders')}</p>
        ) : (
          state.orders.map((order) => (
            <article
              key={order.id}
              style={{ borderBottom: '1px solid var(--border)', padding: '0.8rem 0' }}
            >
              <p>
                <strong>{order.id}</strong> — {t(`orderStatus.${order.status}`)}
              </p>
              <p className="muted">
                {t('account.paymentLabel')}: {order.paymentStatus}
              </p>
              <p>
                {t('admin.total')}: {birr(order.total)}
              </p>
            </article>
          ))
        )}
      </DashboardSection>

      <DashboardSection title={t('account.yourAddresses')}>
        {state.addresses.length === 0 ? (
          <p className="muted">{t('account.noAddresses')}</p>
        ) : (
          state.addresses.map((address) => (
            <article key={address.id} style={{ marginBottom: '0.6rem' }}>
              <p style={{ margin: 0 }}>{address.fullName}</p>
              <p className="muted" style={{ margin: '0.15rem 0 0' }}>
                {address.city}, {address.area}
                {address.landmark ? ` — ${address.landmark}` : ''}
              </p>
              <p className="muted" style={{ margin: '0.1rem 0 0' }}>
                {address.phone}
              </p>
            </article>
          ))
        )}
      </DashboardSection>

      <DashboardSection title={t('account.accountSettings')}>
        <p style={{ margin: '0 0 0.3rem' }}>
          <span className="muted">{t('auth.fullNameLabel')}: </span>
          {user.name || '—'}
        </p>
        <p style={{ margin: 0 }}>
          <span className="muted">{t('auth.emailLabel')}: </span>
          {user.email || '—'}
        </p>
      </DashboardSection>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AccountPage() {
  const { t } = useTranslation()
  const { state, dispatch } = useStore()
  usePageMeta(t('meta.account.title'), t('meta.account.desc'))

  return (
    <div style={{ maxWidth: '640px', margin: '2rem auto' }}>
      {state.user ? (
        <ProfileCard user={state.user} t={t} state={state} dispatch={dispatch} />
      ) : (
        <AuthCard t={t} />
      )}
    </div>
  )
}
