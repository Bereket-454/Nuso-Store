import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { sendPasswordReset } from '../lib/auth'

function IconMail() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  usePageMeta(t('auth.forgotPasswordTitle'), '')

  async function handleSubmit() {
    if (!email.trim()) { setError(t('auth.forgotPasswordEmailRequired')); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(t('auth.invalidEmail')); return }
    setLoading(true)
    setError('')
    await sendPasswordReset(email.trim())
    setLoading(false)
    setSent(true)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1a2340', letterSpacing: '0.05em' }}>
            NUSO <span style={{ color: '#FF6B00' }}>STORE</span>
          </span>
        </div>

        <div className="card card-body" style={{ padding: '2rem' }}>
          {sent ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <IconMail />
              </div>
              <h2 style={{ margin: '0 0 0.6rem', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}>
                {t('auth.forgotPasswordTitle')}
              </h2>
              <p style={{ margin: '0 0 1.5rem', color: 'var(--muted)', fontSize: '0.93rem', lineHeight: 1.55, textAlign: 'center' }}>
                {t('auth.forgotPasswordSuccess')}
              </p>
              <Link to="/account" className="btn btn-secondary" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
                {t('auth.backToSignIn')}
              </Link>
            </>
          ) : (
            <>
              <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.15rem', fontWeight: 700 }}>
                {t('auth.forgotPasswordTitle')}
              </h2>
              <p style={{ margin: '0 0 1.25rem', color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                {t('auth.forgotPasswordHint')}
              </p>
              <div className="form-group">
                <label htmlFor="forgot-email">{t('auth.emailLabel')}</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={loading}
                />
              </div>
              {error && <p className="error-text" style={{ margin: '-0.25rem 0 0.5rem' }}>{error}</p>}
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: '100%', marginTop: '0.25rem' }}
              >
                {loading ? '...' : t('auth.forgotPasswordButton')}
              </button>
            </>
          )}
        </div>

        {!sent && (
          <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
            <Link to="/account" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              {t('auth.backToSignIn')}
            </Link>
          </p>
        )}

      </div>
    </div>
  )
}
