import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'

/**
 * Banner inviting users to request a product they can't find.
 * `compact` prop renders a smaller inline version for use inside page content.
 */
export function RequestBanner({ compact = false }) {
  const { t } = useTranslation()

  if (compact) {
    return (
      <div className="request-banner request-banner--compact">
        <div>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{t('request.banner')}</h3>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{t('request.bannerHint')}</p>
        </div>
        <Link to="/request" className="btn btn-primary" style={{ flexShrink: 0 }}>
          {t('request.bannerButton')}
        </Link>
      </div>
    )
  }

  return (
    <section className="request-banner">
      <div>
        <h3 style={{ margin: '0 0 0.3rem' }}>{t('request.banner')}</h3>
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>{t('request.bannerHint')}</p>
      </div>
      <Link to="/request" className="btn btn-primary" style={{ flexShrink: 0 }}>
        {t('request.bannerButton')}
      </Link>
    </section>
  )
}
