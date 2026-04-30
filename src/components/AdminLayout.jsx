import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../app/store'
import { signOut } from '../lib/auth'

// ── Icons ──────────────────────────────────────────────────────────────────────

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const IconOrders = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
)
const IconBox = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>
  </svg>
)
const IconChart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IconMessage = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
)
const IconExternalLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)
const IconLogOut = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const IconMenu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

// ── Section nav items — scroll within the single AdminDashboardPage ────────────

const SECTION_ITEMS = [
  { id: 'admin-section-orders',    label: 'Orders',    icon: IconOrders, adminOnly: true },
  { id: 'admin-section-products',  label: 'Products',  icon: IconBox,    adminOnly: false },
  { id: 'admin-section-inventory', label: 'Inventory', icon: IconChart,  adminOnly: true },
  { id: 'admin-section-requests',  label: 'Requests',  icon: IconMessage, adminOnly: true },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const { state } = useStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isStaff    = state.user?.role === 'staff'
  const firstName  = (state.user?.name ?? '').split(' ')[0] || state.user?.email?.split('@')[0] || 'Admin'
  const visibleSections = SECTION_ITEMS.filter((item) => !isStaff || !item.adminOnly)

  const close = () => setSidebarOpen(false)

  const scrollTo = (sectionId) => {
    close()
    // Small delay so the sidebar closes on mobile before scrolling
    setTimeout(() => {
      const el = document.getElementById(sectionId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const handleSignOut = async () => {
    close()
    await signOut()
  }

  return (
    <div className="admin-layout">

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={`admin-sidebar${sidebarOpen ? ' admin-sidebar--open' : ''}`}
        aria-label="Admin navigation"
      >
        {/* Brand */}
        <div className="admin-sidebar__header">
          <NavLink to="/admin" className="admin-sidebar__brand" onClick={close} aria-label="Nuso Admin — dashboard">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" aria-hidden="true" style={{ height: 34, width: 'auto' }}>
              <path d="M6 24 L6 56 Q6 60 10 60 L46 60 Q50 60 50 56 L50 24 Z" fill="#fff"/>
              <path d="M28 24 L50 24 L50 46 Z" fill="#FF6B00"/>
              <path d="M16 24 Q16 10 28 10 Q40 10 40 24" fill="none" stroke="#FF6B00" strokeWidth="4" strokeLinecap="round"/>
              <rect x="11" y="30" width="6" height="22" rx="1.5" fill="#1a2340"/>
              <rect x="35" y="30" width="6" height="22" rx="1.5" fill="#1a2340"/>
              <line x1="17" y1="30" x2="35" y2="52" stroke="#FF6B00" strokeWidth="6" strokeLinecap="round"/>
              <text x="62" y="36" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="26" fill="#fff">NUSO</text>
              <text x="78" y="55" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="16" fill="#FF6B00" letterSpacing="4">STORE</text>
            </svg>
            <span className="admin-sidebar__brand-badge">Admin</span>
          </NavLink>
        </div>

        {/* Primary nav */}
        <nav className="admin-sidebar__nav">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `admin-nav-item${isActive ? ' admin-nav-item--active' : ''}`}
            onClick={close}
          >
            <IconGrid />
            <span>Dashboard</span>
          </NavLink>

          {visibleSections.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className="admin-nav-item"
                onClick={() => scrollTo(item.id)}
              >
                <Icon />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer: user info + utility links */}
        <div className="admin-sidebar__footer">
          {state.user && (
            <div className="admin-sidebar__user">
              <span className="admin-sidebar__user-name">{firstName}</span>
              <span className="admin-sidebar__user-role">{state.user.role}</span>
            </div>
          )}

          <Link to="/" className="admin-nav-item admin-nav-item--store" onClick={close}>
            <IconExternalLink />
            <span>View Store</span>
          </Link>

          <button type="button" className="admin-nav-item admin-nav-item--signout" onClick={handleSignOut}>
            <IconLogOut />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="admin-sidebar__backdrop"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="admin-main">
        {/* Mobile topbar */}
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-topbar__menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open admin menu"
            aria-expanded={sidebarOpen}
          >
            <IconMenu />
          </button>
          <span className="admin-topbar__title">Nuso Admin</span>
          <Link to="/" className="admin-topbar__store-link">View Store ↗</Link>
        </header>

        {/* Page content */}
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
