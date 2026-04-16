import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../app/store'
import { isAdminUser } from '../utils/auth'
import { useTranslation } from '../i18n'
import { getFirstName } from '../pages/AccountPage'

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
              {state.user
                ? t('auth.helloUser', { name: getFirstName(state.user.name) })
                : t('nav.account')}
            </NavLink>
            <NavLink className={({ isActive }) => `pill${isActive ? ' active' : ''}`} to="/tracking">
              {t('nav.track')}
            </NavLink>
            <NavLink className={({ isActive }) => `pill${isActive ? ' active' : ''}`} to="/cart">
              <span
                key={cartAnimKey}
                className={cartAnimKey > 0 ? 'header-cart--bump' : undefined}
                style={{ display: 'inline-block' }}
              >
                {t('nav.cart')} ({cartItemsCount})
              </span>
            </NavLink>
            {isAdminUser(state.user) ? (
              <NavLink className={({ isActive }) => `pill${isActive ? ' active' : ''}`} to="/admin">
                {t('nav.admin')}
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
