import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n'

export function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const handleSearch = (e) => {
    e.preventDefault()
    const q = query.trim()
    if (q) navigate(`/products?search=${encodeURIComponent(q)}`)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '3rem 1rem 4rem',
      maxWidth: '480px',
      margin: '0 auto',
    }}>
      {/* Large ghost 404 */}
      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
        <span style={{
          fontSize: 'clamp(6rem, 20vw, 9rem)',
          fontWeight: 800,
          color: '#f0f0f0',
          lineHeight: 1,
          userSelect: 'none',
          letterSpacing: '-0.03em',
        }} aria-hidden="true">
          {t('notFound.code')}
        </span>
        <h1 style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'clamp(1.2rem, 3.5vw, 1.6rem)',
          fontWeight: 700,
          margin: 0,
          whiteSpace: 'nowrap',
        }}>
          {t('notFound.title')}
        </h1>
      </div>

      <p className="muted" style={{ fontSize: '0.95rem', marginBottom: '2rem', maxWidth: '360px' }}>
        {t('notFound.hint')}
      </p>

      {/* Search bar */}
      <form onSubmit={handleSearch} style={{ width: '100%', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('notFound.searchPlaceholder')}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>→</button>
        </div>
      </form>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
        <Link className="btn btn-primary" to="/">
          {t('notFound.goHome')}
        </Link>
        <Link className="btn btn-secondary" to="/products">
          {t('notFound.browseProducts')}
        </Link>
        <Link className="btn btn-secondary" to="/request">
          {t('notFound.requestProduct')}
        </Link>
      </div>
    </div>
  )
}
