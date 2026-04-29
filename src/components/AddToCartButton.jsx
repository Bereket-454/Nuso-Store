import { useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

/**
 * Drop-in replacement for any "Add to Cart" button.
 *
 * On click it:
 *   1. Calls `onClick(e)` — cart logic lives in the caller, unchanged.
 *   2. If `onClick` returns `false` explicitly, skips the animation
 *      (use this to signal a validation failure, e.g. no colour selected).
 *   3. Briefly switches to a green "Added ✓" state (~900 ms) then reverts.
 *
 * Width and height are kept stable via a hidden ghost span that holds the
 * normal label in the document flow at all times; the animated states are
 * absolutely positioned on top so they never trigger a layout shift.
 */
export function AddToCartButton({
  onClick,
  disabled,
  label,
  addedLabel = 'Added',
  className = 'btn btn-primary',
  style,
  ...rest
}) {
  const [justAdded, setJustAdded] = useState(false)
  const prefersReduced = useReducedMotion()

  function handleClick(e) {
    const result = onClick?.(e)
    // Don't animate if the caller signals failure via an explicit `return false`
    if (result !== false) {
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 900)
    }
  }

  return (
    <motion.button
      type="button"
      className={`${className}${justAdded ? ' atc-btn--added' : ''}`}
      disabled={disabled}
      style={{ position: 'relative', ...style }}
      onClick={handleClick}
      animate={
        justAdded && !prefersReduced
          ? { scale: [1, 1.04, 1] }
          : { scale: 1 }
      }
      transition={{ duration: 0.28, ease: 'easeOut' }}
      {...rest}
    >
      {/*
        Ghost label — always in flow, invisible.
        Gives the button its correct intrinsic width and height so the
        absolutely-positioned animated states never cause layout shifts.
      */}
      <span
        aria-hidden="true"
        style={{ visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none' }}
      >
        {label}
      </span>

      <AnimatePresence mode="wait" initial={false}>
        {justAdded ? (
          <motion.span
            key="added"
            aria-live="polite"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            {/* Checkmark drawn via pathLength 0 → 1 */}
            <motion.svg
              width="15"
              height="15"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <motion.path
                d="M2 7.5l3 3 7-7.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={
                  prefersReduced
                    ? { duration: 0 }
                    : { duration: 0.32, ease: 'easeOut' }
                }
              />
            </motion.svg>
            {addedLabel}
          </motion.span>
        ) : (
          <motion.span
            key="label"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
