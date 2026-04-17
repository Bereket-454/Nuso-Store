import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../app/store'
import { isAdminUser } from '../utils/auth'
import { useTranslation } from '../i18n'
import { getFirstName } from '../pages/AccountPage'

const IconPerson = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>
  </svg>
)

const IconPin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
)

const IconCart = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
)

const IconShield = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2l8 4v6c0 5-3.6 9.7-8 11-4.4-1.3-8-6-8-11V6l8-4z"/>
  </svg>
)

const navRoutes = [
  { to: '/', key: 'home' },
  { to: '/products', key: 'shop' },
  { to: '/category/men', key: 'men' },
  { to: '/category/women', key: 'women' },
  { to: '/category/children', key: 'children' },
]

export function Layout() {
  const { t, language, setLanguage } = useTranslation()
  const { state } = useStore()
  const cartItemsCount = state.cart.reduce((sum, item) => sum + item.quantity, 0)
  const prevCartCount = useRef(null)
  const [cartAnimKey, setCartAnimKey] = useState(0)

  useEffect(() => {
    if (prevCartCount.current === null) {
      prevCartCount.current = cartItemsCount
      return
    }
    if (prevCartCount.current !== cartItemsCount) {
      prevCartCount.current = cartItemsCount
      setCartAnimKey((key) => key + 1) // eslint-disable-line react-hooks/set-state-in-effect -- sync animation to cart total
    }
  }, [cartItemsCount])

  return (
    <>
      <style>{`
        @keyframes header-cart-pulse {
          0% { transform: scale(1); }
          35% { transform: scale(1.14); }
          55% { transform: scale(0.94); }
          75% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        .header-cart--bump {
          display: inline-block;
          animation: header-cart-pulse 0.55s ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .header-cart--bump {
            animation: none;
          }
        }
      `}</style>
      <div className="top-note">{t('layout.topNote')}</div>
      <header className="header">
        <div className="container header-inner">
          <NavLink to="/" className="brand">
            DI<span className="accent">RE</span>
          </NavLink>
          <nav className="nav">
            {navRoutes.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to={item.to}
              >
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
          </nav>
          <div className="actions">
            <div className="lang-toggle" role="group" aria-label={t('language.toggleLabel')}>
              <button
                type="button"
                className={`pill ${language === 'en' ? 'pill-active' : ''}`}
                onClick={() => setLanguage('en')}
                aria-pressed={language === 'en'}
              >
                EN
              </button>
              <span className="lang-toggle__sep" aria-hidden="true">
                |
              </span>
              <button
                type="button"
                className={`pill ${language === 'am' ? 'pill-active' : ''}`}
                onClick={() => setLanguage('am')}
                aria-pressed={language === 'am'}
              >
                {t('language.amShort')}
              </button>
            </div>
            <NavLink className={({ isActive }) => `pill${isActive ? ' active' : ''}`} to="/account">
              <span className="nav-icon"><IconPerson /></span>
              <span className="nav-label">
                {state.user
                  ? t('auth.helloUser', { name: getFirstName(state.user.name) })
                  : t('nav.account')}
              </span>
            </NavLink>
            <NavLink className={({ isActive }) => `pill${isActive ? ' active' : ''}`} to="/tracking">
              <span className="nav-icon"><IconPin /></span>
              <span className="nav-label">{t('nav.track')}</span>
            </NavLink>
            <NavLink className={({ isActive }) => `pill${isActive ? ' active' : ''}`} to="/cart">
              <span
                key={cartAnimKey}
                className={cartAnimKey > 0 ? 'header-cart--bump' : undefined}
                style={{ display: 'inline-block' }}
              >
                <span className="nav-icon"><IconCart /></span>
                <span className="nav-label">{t('nav.cart')} </span>({cartItemsCount})
              </span>
            </NavLink>
            {isAdminUser(state.user) ? (
              <NavLink className={({ isActive }) => `pill${isActive ? ' active' : ''}`} to="/admin">
                <span className="nav-icon"><IconShield /></span>
                <span className="nav-label">{t('nav.admin')}</span>
              </NavLink>
            ) : null}
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container muted">{t('layout.footer')}</div>
      </footer>
    </>
  )
}
