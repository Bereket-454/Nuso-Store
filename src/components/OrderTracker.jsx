import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from '../i18n'

// Canonical step sequence
export const ORDER_STEPS = [
  { id: 'order_received',   icon: ReceiptIcon },
  { id: 'confirming',       icon: ClockIcon },
  { id: 'confirmed',        icon: CheckCircleIcon },
  { id: 'preparing',        icon: BoxIcon },
  { id: 'out_for_delivery', icon: TruckIcon },
  { id: 'delivered',        icon: HomeIcon },
]

// Map legacy DB values to canonical step IDs
const STATUS_ALIAS = {
  pending:            'order_received',
  packed:             'preparing',
  'out-for-delivery': 'out_for_delivery',
}

export function resolveStatus(raw) {
  return STATUS_ALIAS[raw] ?? raw ?? 'order_received'
}

export function statusIndex(raw) {
  const resolved = resolveStatus(raw)
  const idx = ORDER_STEPS.findIndex((s) => s.id === resolved)
  return idx === -1 ? 0 : idx
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function ReceiptIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <path d="M14 2v6h6M9 13h6M9 17h4"/>
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  )
}
function CheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
      <path d="M22 4L12 14.01l-3-3"/>
    </svg>
  )
}
function BoxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>
    </svg>
  )
}
function TruckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 5v3h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  )
}
function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <path d="M9 22V12h6v10"/>
    </svg>
  )
}

// Animated checkmark drawn via pathLength
function Checkmark({ prefersReduced, delay = 0 }) {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" aria-hidden="true">
      <motion.path
        d="M3.5 9l3.5 3.5 7-8"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={
          prefersReduced
            ? { duration: 0 }
            : { duration: 0.35, ease: 'easeOut', delay }
        }
      />
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OrderTracker({ status, updatedAt, orderId, cancelledAt, cancellationReason }) {
  const { t } = useTranslation()
  const prefersReduced = useReducedMotion()
  const currentIndex = statusIndex(status)

  if (status === 'cancelled') {
    return (
      <div className="order-tracker">
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: '10px', padding: '0.9rem 1rem',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <div>
            <p style={{ margin: '0 0 0.2rem', fontWeight: 700, color: '#b91c1c', fontSize: '0.95rem' }}>
              {t('tracker.cancelled')}
            </p>
            {cancellationReason && (
              <p style={{ margin: '0 0 0.15rem', fontSize: '0.83rem', color: '#6b7280' }}>
                {t('tracker.cancelReason')}: {cancellationReason}
              </p>
            )}
            {cancelledAt && (
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af' }}>
                {t('tracker.cancelledAt')}: {new Date(cancelledAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Fill % of the progress track: goes from left-center of step 0 to right-center of last step
  const fillPct = (currentIndex / (ORDER_STEPS.length - 1)) * 100

  return (
    <div className="order-tracker">
      {/* Estimated delivery note */}
      <p className="tracker-eta">{t('tracker.estimatedDelivery')}</p>

      <div className="tracker-body">
        {/* Background track + animated fill line */}
        <div className="tracker-line-wrap" aria-hidden="true">
          <div className="tracker-line-bg" />
          <motion.div
            className="tracker-line-fill"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: fillPct / 100 }}
            transition={{ duration: prefersReduced ? 0 : 0.55, ease: 'easeOut' }}
            style={{ transformOrigin: 'left center' }}
          />
        </div>

        {/* Step nodes */}
        <div className="tracker-steps" role="list">
          {ORDER_STEPS.map((step, i) => {
            const isDone    = i < currentIndex
            const isCurrent = i === currentIndex
            const state     = isDone ? 'done' : isCurrent ? 'current' : 'future'
            const Icon      = step.icon

            return (
              <div
                key={step.id}
                className={`tracker-step tracker-step--${state}`}
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <motion.div
                  className="tracker-step__circle"
                  initial={prefersReduced ? { scale: 1 } : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={
                    prefersReduced
                      ? { duration: 0 }
                      : { duration: 0.3, delay: i * 0.06, ease: 'easeOut' }
                  }
                >
                  {isDone ? (
                    <Checkmark prefersReduced={prefersReduced} delay={i * 0.06} />
                  ) : (
                    <Icon />
                  )}

                  {/* Pulsing ring on current step */}
                  {isCurrent && !prefersReduced && (
                    <motion.span
                      className="tracker-step__pulse"
                      aria-hidden="true"
                      animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                </motion.div>

                <span className="tracker-step__label">
                  {t(`orderStatus.${step.id}`)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Last-updated timestamp */}
      {updatedAt && (
        <p className="tracker-updated">
          {t('tracker.lastUpdated')}: {new Date(updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
