import { Link } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'

const trustIcons = ['💳', '📦', '🚚', '💬', '💰']
const trustTextKeys = ['trustPayment', 'trustConfirmed', 'trustDelivery', 'trustSupport', 'trustOptions']

const teamKeys = [
  { key: 'bereket', initials: 'BK', hasNickname: false },
  { key: 'beri',    initials: 'BD', hasNickname: true },
  { key: 'abi',     photo: '/abi.jpg', hasNickname: true },
]

function TeamCard({ memberKey, initials, photo, hasNickname, t }) {
  const name     = t(`about.team.${memberKey}.name`)
  const nickname = hasNickname ? t(`about.team.${memberKey}.nickname`) : null
  const title    = t(`about.team.${memberKey}.title`)
  const desc     = t(`about.team.${memberKey}.desc`)

  return (
    <div className="about-team-card">
      <div className="about-team-card__photo-wrap">
        {photo ? (
          <img src={photo} alt={name} className="about-team-card__photo" />
        ) : (
          <div className="about-team-card__photo about-team-card__photo--placeholder">
            <span>{initials}</span>
          </div>
        )}
      </div>
      <div className="about-team-card__body">
        <p className="about-team-card__name">
          {name}
          {nickname && <span className="about-team-card__nickname"> ({nickname})</span>}
        </p>
        <p className="about-team-card__title">{title}</p>
        <p className="about-team-card__desc">{desc}</p>
      </div>
    </div>
  )
}

export function AboutPage() {
  const { t } = useTranslation()

  usePageMeta(t('about.pageTitle'), t('about.pageDesc'))

  return (
    <div className="about-page">

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="about-hero about-hero--centered">
        <p className="about-hero__eyebrow">{t('about.eyebrow')}</p>
        <h1 className="about-hero__title">
          {t('about.heroTitle')}<br />
          <span className="about-hero__title--accent">{t('about.heroTitleAccent')}</span>
        </h1>
        <p className="about-hero__body about-hero__body--wide">
          {t('about.heroStory')}
        </p>
      </section>

      {/* ── Team ──────────────────────────────────────────────────── */}
      <section className="about-team">
        <h2 className="about-section-title about-section-title--center">{t('about.teamTitle')}</h2>
        <div className="about-team__grid">
          {teamKeys.map(({ key, initials, photo, hasNickname }) => (
            <TeamCard key={key} memberKey={key} initials={initials} photo={photo} hasNickname={hasNickname} t={t} />
          ))}
        </div>
      </section>

      {/* ── Mission + Vision ──────────────────────────────────────── */}
      <section className="about-cards">
        <div className="about-card about-card--navy">
          <div className="about-card__icon" aria-hidden="true">🎯</div>
          <h2 className="about-card__title">{t('about.missionTitle')}</h2>
          <p className="about-card__body">{t('about.missionBody')}</p>
        </div>

        <div className="about-card about-card--orange">
          <div className="about-card__icon" aria-hidden="true">🔭</div>
          <h2 className="about-card__title">{t('about.visionTitle')}</h2>
          <p className="about-card__body">{t('about.visionBody')}</p>
        </div>
      </section>

      {/* ── Promise ───────────────────────────────────────────────── */}
      <section className="about-promise">
        <p className="about-promise__text">{t('about.promise')}</p>
      </section>

      {/* ── Trust badges ─────────────────────────────────────────── */}
      <section className="about-trust">
        <h2 className="about-section-title">{t('about.trustTitle')}</h2>
        <ul className="about-trust__list">
          {trustTextKeys.map((key, i) => (
            <li key={key} className="about-trust__item">
              <span className="about-trust__icon" aria-hidden="true">{trustIcons[i]}</span>
              <span>{t(`about.${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Support ───────────────────────────────────────────────── */}
      <section className="about-support">
        <h2 className="about-section-title">{t('about.supportTitle')}</h2>
        <p className="about-support__sub">{t('about.supportSub')}</p>
        <div className="about-support__links">
          <a
            href="https://t.me/nusostore"
            target="_blank"
            rel="noopener noreferrer"
            className="about-support__btn about-support__btn--tg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.19 14.447l-2.95-.924c-.64-.203-.654-.64.136-.95l11.49-4.427c.537-.194 1.006.131.696.102z"/>
            </svg>
            {t('about.chatTelegram')}
          </a>
          <a
            href="tel:0992728667"
            className="about-support__btn about-support__btn--phone"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
            </svg>
            {t('about.callPhone')}
          </a>
        </div>
      </section>

      <nav className="legal-nav">
        <Link to="/terms">Terms of Service</Link>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/refund-policy">Refund Policy</Link>
        <Link to="/">Back to Store</Link>
      </nav>

    </div>
  )
}
