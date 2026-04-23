import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { birr } from '../utils/format'
import { getReferralStats } from '../services/referral'

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconGift() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  )
}

function IconWallet() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconShare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ─── Copy button ─────────────────────────────────────────────────────────────

function CopyButton({ text, label, className }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for older browsers / non-HTTPS contexts
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      className={className || 'ref-copy-btn'}
      onClick={handleCopy}
      aria-live="polite"
    >
      {copied ? (
        <><IconCheck /> {t('referral.copied')}</>
      ) : (
        <>{label}</>
      )}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReferralPage() {
  const { t } = useTranslation()
  const { state } = useStore()
  const user = state.user
  usePageMeta(t('referral.pageTitle'), t('referral.pageDesc'))

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    getReferralStats(user.id).then(({ stats: s }) => {
      setStats(s)
      setLoading(false)
    })
  }, [user?.id])

  const referralCode = stats?.code || user?.referral_code || null
  const referralLink = referralCode
    ? `${window.location.origin}/account?ref=${referralCode}`
    : null
  const shareText = referralCode
    ? t('referral.shareText', { code: referralCode })
    : ''
  const walletBalance = Number(stats?.balance ?? state.wallet?.balance ?? 0)

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="ref-page">
        <div className="ref-hero">
          <div className="ref-hero__icon" aria-hidden="true"><IconGift /></div>
          <h1 className="ref-hero__title">{t('referral.heroTitle')}</h1>
          <p className="ref-hero__subtitle">{t('referral.heroSubtitle')}</p>
        </div>
        <div className="ref-how">
          <ReferralSteps t={t} />
        </div>
        <div className="ref-signin-prompt card card-body">
          <p>{t('referral.signInPrompt')}</p>
          <Link to="/account" className="btn btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
            {t('auth.signInButton')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="ref-page">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="ref-hero">
        <div className="ref-hero__icon" aria-hidden="true"><IconGift /></div>
        <h1 className="ref-hero__title">{t('referral.heroTitle')}</h1>
        <p className="ref-hero__subtitle">{t('referral.heroSubtitle')}</p>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="ref-stats-grid">
        <div className="ref-stat ref-stat--wallet">
          <div className="ref-stat__icon"><IconWallet /></div>
          <div className="ref-stat__body">
            <p className="ref-stat__num">
              {loading ? '—' : birr(walletBalance)}
            </p>
            <p className="ref-stat__label">{t('referral.walletBalance')}</p>
          </div>
        </div>
        <div className="ref-stat">
          <div className="ref-stat__icon"><IconUsers /></div>
          <div className="ref-stat__body">
            <p className="ref-stat__num">{loading ? '—' : (stats?.total ?? 0)}</p>
            <p className="ref-stat__label">{t('referral.totalReferrals')}</p>
          </div>
        </div>
        <div className="ref-stat ref-stat--pending">
          <div className="ref-stat__icon">⏳</div>
          <div className="ref-stat__body">
            <p className="ref-stat__num">{loading ? '—' : (stats?.pending ?? 0)}</p>
            <p className="ref-stat__label">{t('referral.pendingReferrals')}</p>
          </div>
        </div>
        <div className="ref-stat ref-stat--success">
          <div className="ref-stat__icon">✅</div>
          <div className="ref-stat__body">
            <p className="ref-stat__num">{loading ? '—' : (stats?.completed ?? 0)}</p>
            <p className="ref-stat__label">{t('referral.completedReferrals')}</p>
          </div>
        </div>
      </div>

      {/* ── Your referral code ────────────────────────────────────────────── */}
      <div className="ref-card">
        <h2 className="ref-card__title">{t('referral.yourCode')}</h2>
        {loading ? (
          <div className="ref-code-skeleton" aria-hidden="true" />
        ) : referralCode ? (
          <>
            <div className="ref-code-display" aria-label={`Referral code: ${referralCode}`}>
              {referralCode}
            </div>
            <div className="ref-card__actions">
              <CopyButton text={referralCode} label={t('referral.copyCode')} className="ref-copy-btn ref-copy-btn--primary" />
              {referralLink && (
                <CopyButton text={referralLink} label={<><IconShare /> {t('referral.copyLink')}</>} className="ref-copy-btn" />
              )}
            </div>
            {referralLink && (
              <p className="ref-link-preview" aria-label="Referral link">{referralLink}</p>
            )}
          </>
        ) : (
          <p className="muted">{t('referral.noCode')}</p>
        )}

        {/* Share message ready-to-paste */}
        {referralCode && (
          <div className="ref-share-msg">
            <p className="ref-share-msg__label">{t('referral.shareMessageLabel')}</p>
            <p className="ref-share-msg__text">{shareText}</p>
            <CopyButton text={shareText} label={t('referral.copyMessage')} />
          </div>
        )}
      </div>

      {/* ── Wallet balance detail ─────────────────────────────────────────── */}
      {walletBalance > 0 && (
        <div className="ref-wallet-card">
          <div className="ref-wallet-card__icon"><IconWallet /></div>
          <div>
            <p className="ref-wallet-card__amount">{birr(walletBalance)}</p>
            <p className="ref-wallet-card__hint">{t('referral.walletHint')}</p>
          </div>
          <Link to="/checkout" className="ref-wallet-card__cta">
            {t('referral.useNow')}
          </Link>
        </div>
      )}

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <div className="ref-card">
        <h2 className="ref-card__title">{t('referral.howTitle')}</h2>
        <ReferralSteps t={t} />
      </div>

      {/* ── Terms ─────────────────────────────────────────────────────────── */}
      <p className="ref-terms">{t('referral.terms')}</p>

    </div>
  )
}

function ReferralSteps({ t }) {
  return (
    <ol className="ref-steps-list">
      <li className="ref-step-item">
        <div className="ref-step-num" aria-hidden="true">1</div>
        <div>
          <strong>{t('referral.step1Title')}</strong>
          <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>{t('referral.step1Desc')}</p>
        </div>
      </li>
      <li className="ref-step-item">
        <div className="ref-step-num" aria-hidden="true">2</div>
        <div>
          <strong>{t('referral.step2Title')}</strong>
          <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>{t('referral.step2Desc')}</p>
        </div>
      </li>
      <li className="ref-step-item">
        <div className="ref-step-num" aria-hidden="true">3</div>
        <div>
          <strong>{t('referral.step3Title')}</strong>
          <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>{t('referral.step3Desc')}</p>
        </div>
      </li>
    </ol>
  )
}
