import { Link } from 'react-router-dom'

// Consistent SVG icon set — 48×48, stroke-based, matches the app's icon language
function CartIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 001.95-1.56L23 6H6"/>
    </svg>
  )
}
function BoxIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}
function SearchXIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="8.5" y1="8.5" x2="13.5" y2="13.5"/><line x1="13.5" y1="8.5" x2="8.5" y2="13.5"/>
    </svg>
  )
}
function AlertCircleIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}
function WifiOffIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/>
      <path d="M5 12.55a10.94 10.94 0 015.17-2.39"/>
      <path d="M10.71 5.05A16 16 0 0122.56 9"/>
      <path d="M1.42 9a15.91 15.91 0 014.7-2.88"/>
      <path d="M8.53 16.11a6 6 0 016.95 0"/>
      <line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
  )
}
function BellOffIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
      <path d="M18.63 13A17.89 17.89 0 0018 8"/>
      <path d="M6.26 6.26A5.86 5.86 0 006 8c0 7-3 9-3 9h14"/>
      <path d="M18 8a6 6 0 00-9.33-5"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}
function CloudXIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25"/>
      <line x1="8" y1="16" x2="16" y2="24"/><line x1="16" y1="16" x2="8" y2="24"/>
    </svg>
  )
}

const ICONS = {
  cart:           CartIcon,
  box:            BoxIcon,
  'search-x':     SearchXIcon,
  'alert-circle': AlertCircleIcon,
  'wifi-off':     WifiOffIcon,
  'bell-off':     BellOffIcon,
  'cloud-x':      CloudXIcon,
}

/**
 * Reusable empty / error state block.
 *
 * @param {string|Function} icon     - Icon key ('cart', 'box', …) or a custom SVG component
 * @param {string}          title    - Primary message
 * @param {string}         [hint]    - Secondary helper text
 * @param {string}         [ctaLabel]- CTA button / link text
 * @param {string}         [ctaTo]   - React Router <Link> destination (renders <Link>)
 * @param {Function}       [ctaOnClick] - Click handler (renders <button>)
 * @param {boolean}        [danger]  - Red icon tint for error states
 */
export function EmptyState({ icon, title, hint, ctaLabel, ctaTo, ctaOnClick, danger = false }) {
  const Icon = typeof icon === 'string' ? ICONS[icon] : icon
  return (
    <div className={`empty-state${danger ? ' empty-state--danger' : ''}`}>
      {Icon && (
        <span className="empty-state__icon" aria-hidden="true">
          <Icon />
        </span>
      )}
      <p className="empty-state__title">{title}</p>
      {hint && <p className="empty-state__hint">{hint}</p>}
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className={`btn ${danger ? 'btn-secondary' : 'btn-primary'} empty-state__cta`}
        >
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && ctaOnClick && !ctaTo && (
        <button
          type="button"
          className={`btn ${danger ? 'btn-secondary' : 'btn-primary'} empty-state__cta`}
          onClick={ctaOnClick}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
