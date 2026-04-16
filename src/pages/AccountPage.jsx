import { useState } from 'react'
import { useStore } from '../app/store'
import { birr } from '../utils/format'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { isValidEthiopianPhone, signIn, signOut, signUp } from '../lib/auth'

export function getFirstName(fullName) {
  if (!fullName || !fullName.trim()) return 'User'
  return fullName.trim().split(/\s+/)[0]
}

// ─── Sign-in form — centered, logo, bordered box ──────────────────────────────

function SignInForm({ t, onSwitchToSignUp }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn() {
    if (!email.trim()) { setError(t('auth.emailRequired')); return }
    setLoading(true)
    setError('')
    const { error: err } = await signIn(email.trim(), password)
    setLoading(false)
    if (err) { setError(t('auth.signInError')); return }
    // Success — onAuthStateChange listener updates state.user automatically.
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
            <input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {error ? <p className="error-text">{error}</p> : null}
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
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignUp() {
    if (!fullName.trim()) { setError(t('auth.fullNameRequired')); return }
    if (!email.trim()) { setError(t('auth.emailRequired')); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(t('auth.invalidEmail')); return }
    if (!password) { setError(t('auth.passwordRequired')); return }
    if (password.length < 6) { setError(t('auth.passwordTooShort')); return }
    if (!isValidEthiopianPhone(phone)) { setError(t('auth.invalidPhone')); return }

    setLoading(true)
    setError('')
    const { data, error: err } = await signUp(email.trim(), password, phone, fullName.trim())
    setLoading(false)
    if (err) { setError(t('auth.signUpError')); return }
    if (!data.session) {
      onVerificationSent()
    }
    // If session exists, onAuthStateChange handles state update automatically.
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
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="signup-password">{t('auth.passwordLabel')}</label>
        <input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="signup-phone">{t('auth.phoneLabel')}</label>
        <input
          id="signup-phone"
          type="tel"
          autoComplete="tel"
          placeholder="+2519XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
      </div>
      {error ? <p className="error-text">{error}</p> : null}
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

function ProfileCard({ user, t, state }) {
  const firstName = getFirstName(user.name)

  return (
    <>
      <article className="card card-body" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: '0 0 0.2rem' }}>
          {t('auth.helloUser', { name: firstName })}
        </h2>
        {user.name ? (
          <p style={{ margin: '0 0 0.1rem', fontWeight: 500 }}>{user.name}</p>
        ) : null}
        <p className="muted" style={{ margin: '0 0 0.9rem', fontSize: '0.9rem' }}>
          {user.email || user.id}
        </p>
        {user.role === 'admin' ? (
          <span className="badge" style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
            {t('nav.admin')}
          </span>
        ) : null}
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={signOut}>
            {t('auth.signOut')}
          </button>
        </div>
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
  const { state } = useStore()
  usePageMeta(t('meta.account.title'), t('meta.account.desc'))

  return (
    <div style={{ maxWidth: '640px', margin: '2rem auto' }}>
      {state.user ? (
        <ProfileCard user={state.user} t={t} state={state} />
      ) : (
        <AuthCard t={t} />
      )}
    </div>
  )
}
