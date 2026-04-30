import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../app/store'
import { isAdminUser } from '../utils/auth'
import { signOut } from '../lib/auth'
import { useTranslation } from '../i18n'
import { getFirstName } from '../pages/AccountPage'
import { AdminNav } from './AdminNav'

const IconPerson = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>
  </svg>
)

const IconCart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
)

// Bottom tab bar icons — larger for touch targets
const IconShopLg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
)

const IconCartLg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
)

const IconPersonLg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>
  </svg>
)

// Center nav routes (desktop + mobile).
// desktopHide = only visible in mobile top nav scroll; the desktop .actions handles it separately.
const navRoutes = [
  { to: '/', key: 'home' },
  { to: '/products', key: 'shop' },
  { to: '/category/men', key: 'men', mobileHide: true },
  { to: '/category/women', key: 'women', mobileHide: true },
  { to: '/category/children', key: 'children', mobileHide: true },
  { to: '/request', key: 'request', desktopHide: true },
]

export function Layout() {
  const { t, language, setLanguage } = useTranslation()
  const { state } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const prefersReduced = useReducedMotion()
  const cartItemsCount = state.cart.reduce((sum, item) => sum + item.quantity, 0)
  const prevCartCount = useRef(null)
  const [cartAnimKey, setCartAnimKey] = useState(0)
  const [headerHidden, setHeaderHidden] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  const lastScrollY = useRef(0)

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

  // Close profile dropdown on click outside or Escape
  useEffect(() => {
    const onClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    const onEscape = (e) => { if (e.key === 'Escape') setProfileOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  // Hide header on scroll down, show on scroll up — mobile only (CSS gates the visual effect).
  //
  // Three guards keep this from feeling jerky:
  //   1. Movements under 10px are ignored entirely (jitter when the user pauses).
  //   2. The header only hides after 80px of *continuous* downward scroll from the
  //      point where the last upward movement ended — prevents hiding on a short dip.
  //   3. requestAnimationFrame throttles the handler to one read per paint frame so
  //      rapid scroll events can't queue up redundant state updates.
  useEffect(() => {
    let rafId = null
    let scrollDownStartY = null  // Y where the current downward run began

    const onScroll = () => {
      // If a frame is already scheduled, skip — we'll read the latest Y when it fires.
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const currentY = window.scrollY
        const delta = currentY - lastScrollY.current

        // Guard 1: ignore sub-10px movements to absorb micro-jitter.
        if (Math.abs(delta) < 10) return

        if (currentY <= 60) {
          // Always visible at the very top — reset downward tracking.
          scrollDownStartY = null
          setHeaderHidden(false)
        } else if (delta > 0) {
          // Scrolling down — begin tracking distance if this is a new downward run.
          if (scrollDownStartY === null) {
            scrollDownStartY = lastScrollY.current
          }
          // Guard 2: only hide after 80px of continuous downward travel.
          if (currentY - scrollDownStartY >= 80) {
            setHeaderHidden(true)
          }
        } else {
          // Scrolling up — show immediately and reset the downward run.
          scrollDownStartY = null
          setHeaderHidden(false)
        }

        // Update reference only after a meaningful movement so tiny drifts
        // accumulate into the next delta rather than resetting the baseline.
        lastScrollY.current = currentY
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  const adminViewStore = localStorage.getItem('adminViewStore') === 'true'
  const showAdminNav = isAdminUser(state.user) && !adminViewStore
  const showAdminBanner = isAdminUser(state.user) && adminViewStore

  const handleSignOut = async () => {
    setProfileOpen(false)
    await signOut()
    navigate('/')
  }

  const closeDropdown = () => setProfileOpen(false)

  const handleBackToAdmin = () => {
    localStorage.removeItem('adminViewStore')
    window.location.href = '/admin'
  }

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
      {showAdminBanner && (
        <div className="admin-store-banner">
          <span>Admin Mode — you're browsing as a customer</span>
          <button type="button" className="admin-store-banner__back" onClick={handleBackToAdmin}>
            ← Back to Admin
          </button>
        </div>
      )}
      <div className="top-note">{t('layout.topNote')}</div>
      {showAdminNav && <AdminNav />}
      <header className={`header${headerHidden ? ' header--hidden' : ''}${showAdminNav ? ' header--hidden-always' : ''}`}>
        <div className="container header-inner">
          <NavLink to="/" className="brand" aria-label="Nuso Store — home">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" aria-hidden="true">
              <path d="M6 24 L6 56 Q6 60 10 60 L46 60 Q50 60 50 56 L50 24 Z" fill="#1a2340"/>
              <path d="M28 24 L50 24 L50 46 Z" fill="#FF6B00"/>
              <path d="M16 24 Q16 10 28 10 Q40 10 40 24" fill="none" stroke="#FF6B00" strokeWidth="4" strokeLinecap="round"/>
              <rect x="11" y="30" width="6" height="22" rx="1.5" fill="white"/>
              <rect x="35" y="30" width="6" height="22" rx="1.5" fill="white"/>
              <line x1="17" y1="30" x2="35" y2="52" stroke="#FF6B00" strokeWidth="6" strokeLinecap="round"/>
              <text x="62" y="36" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="26" fill="#1a2340">NUSO</text>
              <text x="78" y="55" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="16" fill="#FF6B00" letterSpacing="4">STORE</text>
            </svg>
          </NavLink>

          {/* Center nav — text links, no pills */}
          <nav className="nav">
            {navRoutes.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}${item.mobileHide ? ' nav-link--mobile-hide' : ''}${item.desktopHide ? ' nav-link--desktop-hide' : ''}`
                }
                to={item.to}
              >
                {t(`nav.${item.key}`)}
              </NavLink>
            ))}
            {isAdminUser(state.user) && (
              <NavLink
                className={({ isActive }) => `nav-link nav-link--admin-mobile${isActive ? ' active' : ''}`}
                to="/admin"
              >
                {t('nav.admin')}
              </NavLink>
            )}
          </nav>

          {/* Right actions — desktop only */}
          <div className="actions">
            {/* Language toggle */}
            <div className="lang-toggle" role="group" aria-label={t('language.toggleLabel')}>
              <button
                type="button"
                className={`pill ${language === 'en' ? 'pill-active' : ''}`}
                onClick={() => setLanguage('en')}
                aria-pressed={language === 'en'}
              >
                EN
              </button>
              <span className="lang-toggle__sep" aria-hidden="true">|</span>
              <button
                type="button"
                className={`pill ${language === 'am' ? 'pill-active' : ''}`}
                onClick={() => setLanguage('am')}
                aria-pressed={language === 'am'}
              >
                {t('language.amShort')}
              </button>
            </div>

            {/* Request — brand orange CTA */}
            <NavLink to="/request" className="nav-request-cta">
              {t('nav.request')}
            </NavLink>

            {/* Cart icon with count badge */}
            <NavLink
              to="/cart"
              className={({ isActive }) => `nav-icon-btn${isActive ? ' active' : ''}`}
              aria-label={`${t('nav.cart')} (${cartItemsCount})`}
            >
              <span
                key={cartAnimKey}
                className={cartAnimKey > 0 ? 'header-cart--bump' : undefined}
                style={{ position: 'relative', display: 'inline-flex' }}
              >
                <IconCart />
                {cartItemsCount > 0 && (
                  <span className="nav-cart-badge" aria-hidden="true">{cartItemsCount}</span>
                )}
              </span>
            </NavLink>

            {/* Profile icon + dropdown */}
            <div className="nav-profile" ref={profileRef}>
              <button
                type="button"
                className={`nav-icon-btn${profileOpen ? ' active' : ''}`}
                onClick={() => setProfileOpen((o) => !o)}
                aria-label={t('nav.account')}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <IconPerson />
              </button>

              {profileOpen && (
                <div className="nav-dropdown" role="menu">
                  {/* Signed-in user header */}
                  {state.user && (
                    <div className="nav-dropdown__user">
                      <span className="nav-dropdown__user-name">{getFirstName(state.user.name)}</span>
                      <span className="nav-dropdown__user-email">{state.user.email}</span>
                    </div>
                  )}

                  <NavLink className="nav-dropdown__item" to="/account" onClick={closeDropdown} role="menuitem">
                    {t('nav.account')}
                  </NavLink>
                  <NavLink className="nav-dropdown__item" to="/tracking" onClick={closeDropdown} role="menuitem">
                    {t('nav.track')}
                  </NavLink>
                  <NavLink className="nav-dropdown__item" to="/notifications" onClick={closeDropdown} role="menuitem">
                    {t('nav.notifications')}
                  </NavLink>

                  {isAdminUser(state.user) && (
                    <NavLink className="nav-dropdown__item" to="/admin" onClick={closeDropdown} role="menuitem">
                      {t('nav.admin')}
                    </NavLink>
                  )}

                  <button
                    type="button"
                    className="nav-dropdown__item nav-dropdown__signout"
                    onClick={handleSignOut}
                    role="menuitem"
                  >
                    {t('auth.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: prefersReduced ? 0 : 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="footer">
        <div className="container muted">{t('layout.footer')}</div>
      </footer>

      {/* Bottom tab bar — mobile only, hidden when admin nav is active */}
      <nav className={`bottom-nav${showAdminNav ? ' bottom-nav--hidden' : ''}`} aria-label="Main navigation">
        <NavLink
          to="/products"
          className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}
        >
          <IconShopLg />
          <span>{t('nav.shop')}</span>
        </NavLink>
        <NavLink
          to="/cart"
          className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}
        >
          <span className="bottom-nav__cart-wrap">
            <span
              key={cartAnimKey}
              className={cartAnimKey > 0 ? 'header-cart--bump' : undefined}
              style={{ display: 'inline-flex' }}
            >
              <IconCartLg />
            </span>
            <AnimatePresence>
              {cartItemsCount > 0 && (
                <motion.span
                  key={cartItemsCount}
                  className="bottom-nav__badge"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={prefersReduced ? { scale: 1, opacity: 1 } : { scale: [0.5, 1.4, 1], opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  {cartItemsCount}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          <span>{t('nav.cart')}</span>
        </NavLink>
        <NavLink
          to="/account"
          className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}
        >
          <IconPersonLg />
          <span>
            {state.user ? getFirstName(state.user.name) : t('nav.account')}
          </span>
        </NavLink>
      </nav>
    </>
  )
}
