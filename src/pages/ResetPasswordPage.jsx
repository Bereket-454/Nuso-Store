import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { updatePassword } from '../lib/auth'
import { supabase } from '../lib/supabase'

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

function PasswordInput({ id, value, onChange, disabled, autoComplete, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{ paddingRight: '2.5rem' }}
      />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((s) => !s)}
        disabled={disabled}
        style={{
          position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', padding: '0.25rem', borderRadius: '4px',
          cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', lineHeight: 1,
        }}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

export function ResetPasswordPage() {
  const { t }    = useTranslation()
  const navigate = useNavigate()

  const [ready,    setReady]    = useState(false)   // true once PASSWORD_RECOVERY fires
  const [expired,  setExpired]  = useState(false)   // true if token doesn't arrive in time
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [error,    setError]    = useState('')

  const recoveredRef = useRef(false)

  usePageMeta(t('auth.resetPasswordTitle'), '')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveredRef.current = true
        setReady(true)
        setExpired(false)
      }
    })
    // If Supabase doesn't fire PASSWORD_RECOVERY within 6 s, the link is invalid or expired
    const timer = setTimeout(() => {
      if (!recoveredRef.current) setExpired(true)
    }, 6000)
    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleUpdate() {
    if (!password)              { setError(t('auth.passwordRequired'));  return }
    if (password.length < 8)   { setError(t('auth.passwordMinLength')); return }
    if (password !== confirm)  { setError(t('auth.passwordsMismatch')); return }

    setLoading(true)
    setError('')
    const { error: updateErr } = await updatePassword(password)
    if (updateErr) {
      setError(t('auth.resetPasswordError'))
      setLoading(false)
      return
    }
    setSuccess(true)
    // Sign out the recovery session so the user gets a clean sign-in on /account
    setTimeout(() => {
      supabase.auth.signOut().then(() => navigate('/account'))
    }, 2000)
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

          {/* ── Success state ── */}
          {success && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center' }}>
                {t('auth.resetPasswordTitle')}
              </h2>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.93rem', lineHeight: 1.55, textAlign: 'center' }}>
                {t('auth.resetPasswordSuccess')}
              </p>
            </>
          )}

          {/* ── Expired / invalid link state ── */}
          {!success && expired && (
            <>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', fontWeight: 700 }}>
                {t('auth.resetPasswordTitle')}
              </h2>
              <p className="error-text" style={{ marginBottom: '1.25rem', lineHeight: 1.5 }}>
                {t('auth.resetPasswordExpired')}
              </p>
              <Link to="/forgot-password" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', width: '100%' }}>
                {t('auth.requestNewLink')}
              </Link>
            </>
          )}

          {/* ── Loading state — waiting for Supabase to verify token ── */}
          {!success && !expired && !ready && (
            <p className="muted" style={{ textAlign: 'center', padding: '1rem 0' }}>…</p>
          )}

          {/* ── Password form — shown once PASSWORD_RECOVERY event fires ── */}
          {!success && !expired && ready && (
            <>
              <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.15rem', fontWeight: 700 }}>
                {t('auth.resetPasswordTitle')}
              </h2>
              <p style={{ margin: '0 0 1.25rem', color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                {t('auth.resetPasswordHint')}
              </p>
              <div className="form-group">
                <label htmlFor="reset-password">{t('auth.newPasswordLabel')}</label>
                <PasswordInput
                  id="reset-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                {password.length > 0 && password.length < 8 && (
                  <p className="error-text" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                    {t('auth.passwordMinLength')}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="reset-confirm">{t('auth.confirmNewPasswordLabel')}</label>
                <PasswordInput
                  id="reset-confirm"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                />
                {confirm.length > 0 && confirm !== password && (
                  <p className="error-text" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                    {t('auth.passwordsMismatch')}
                  </p>
                )}
              </div>
              {error && <p className="error-text" style={{ margin: '-0.25rem 0 0.5rem' }}>{error}</p>}
              <button
                className="btn btn-primary"
                onClick={handleUpdate}
                disabled={loading}
                style={{ width: '100%', marginTop: '0.25rem' }}
              >
                {loading ? '...' : t('auth.resetPasswordButton')}
              </button>
            </>
          )}

        </div>

        {!success && (
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
