import { Link } from 'react-router-dom'
import { useTranslation } from '../i18n'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <article className="card card-body">
      <h1>{t('notFound.title')}</h1>
      <p className="muted">{t('notFound.hint')}</p>
      <Link className="btn btn-primary" to="/">
        {t('notFound.goHome')}
      </Link>
    </article>
  )
}
