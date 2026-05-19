import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../app/store'
import { signOut } from '../lib/auth'
import { isSuperAdmin, isOrderManager, isDeliveryManager, isProductOperator } from '../utils/auth'

export function AdminNav() {
  const { state } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const user = state.user
  const firstName = (user?.name ?? '').split(' ')[0] || user?.email?.split('@')[0] || 'Admin'

  // Which nav items this role may see
  const showDashboard = isSuperAdmin(user)
  const showOrders    = isSuperAdmin(user) || isOrderManager(user) || isDeliveryManager(user)
  const showProducts  = isSuperAdmin(user) || isProductOperator(user)
  const showInventory = isSuperAdmin(user) || isProductOperator(user)
  const showRequests  = isSuperAdmin(user)

  const sections = [
    showOrders    && { id: 'admin-section-orders',    label: 'Orders' },
    showProducts  && { id: 'admin-section-products',  label: 'Products' },
    showInventory && { id: 'admin-section-inventory', label: 'Inventory' },
    showRequests  && { id: 'admin-section-requests',  label: 'Requests' },
  ].filter(Boolean)

  const close = () => setMenuOpen(false)

  const scrollTo = (sectionId) => {
    close()
    const doScroll = () => {
      const el = document.getElementById(sectionId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        // Retry once — section may still be rendering
        setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 400)
      }
    }
    if (location.pathname === '/admin') {
      // Small delay so any re-render triggered by close() settles first
      setTimeout(doScroll, 80)
    } else {
      navigate('/admin')
      // Wait for AdminDashboardPage to mount and render all conditional sections
      setTimeout(doScroll, 700)
    }
  }

  const handleViewStore = () => {
    close()
    localStorage.setItem('adminViewStore', 'true')
    window.location.href = '/'
  }

  const handleSignOut = async () => {
    close()
    await signOut()
    navigate('/')
  }

  return (
    <header className="admin-nav">
      <div className="admin-nav__inner">

        {/* Brand */}
        <NavLink to="/admin" className="admin-nav__brand" onClick={close} aria-label="Nuso Admin — dashboard">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" aria-hidden="true" style={{ height: 32, width: 'auto' }}>
            <path d="M6 24 L6 56 Q6 60 10 60 L46 60 Q50 60 50 56 L50 24 Z" fill="#fff"/>
            <path d="M28 24 L50 24 L50 46 Z" fill="#FF6B00"/>
            <path d="M16 24 Q16 10 28 10 Q40 10 40 24" fill="none" stroke="#FF6B00" strokeWidth="4" strokeLinecap="round"/>
            <rect x="11" y="30" width="6" height="22" rx="1.5" fill="#1a2340"/>
            <rect x="35" y="30" width="6" height="22" rx="1.5" fill="#1a2340"/>
            <line x1="17" y1="30" x2="35" y2="52" stroke="#FF6B00" strokeWidth="6" strokeLinecap="round"/>
            <text x="62" y="36" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="26" fill="#fff">NUSO</text>
            <text x="78" y="55" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="16" fill="#FF6B00" letterSpacing="4">STORE</text>
          </svg>
          <span className="admin-nav__badge">Admin</span>
        </NavLink>

        {/* Nav links — desktop horizontal / mobile dropdown */}
        <nav
          className={`admin-nav__links${menuOpen ? ' admin-nav__links--open' : ''}`}
          aria-label="Admin navigation"
        >
          {showDashboard && (
            <NavLink
              to="/admin"
              end
              className={({ isActive }) => `admin-nav__link${isActive ? ' admin-nav__link--active' : ''}`}
              onClick={close}
            >
              Dashboard
            </NavLink>
          )}

          {sections.map(s => (
            <button
              key={s.id}
              type="button"
              className="admin-nav__link admin-nav__link--btn"
              onClick={() => scrollTo(s.id)}
            >
              {s.label}
            </button>
          ))}

          {isSuperAdmin(user) && (
            <NavLink
              to="/admin/student-verifications"
              className={({ isActive }) => `admin-nav__link${isActive ? ' admin-nav__link--active' : ''}`}
              onClick={close}
            >
              Student Verifications
            </NavLink>
          )}

          {/* Mobile-only footer */}
          <div className="admin-nav__mobile-footer">
            <span className="admin-nav__user-mobile">{firstName}</span>
            <button type="button" className="admin-nav__link admin-nav__link--btn" onClick={handleViewStore}>
              View Store ↗
            </button>
            <button
              type="button"
              className="admin-nav__link admin-nav__link--btn admin-nav__link--signout"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        </nav>

        {/* Desktop right actions */}
        <div className="admin-nav__actions">
          <span className="admin-nav__user">{firstName}</span>
          <button type="button" className="admin-nav__view-store" onClick={handleViewStore}>
            View Store ↗
          </button>
          <button type="button" className="admin-nav__signout-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="admin-nav__hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open admin menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          }
        </button>
      </div>

      {menuOpen && (
        <div className="admin-nav__backdrop" onClick={close} aria-hidden="true" />
      )}
    </header>
  )
}
