import { useEffect, useState } from 'react'
import { useStore } from '../app/store'
import { requestAndSaveFCMToken, listenForegroundMessages } from '../services/fcm'

const DISMISS_KEY  = 'nuso_push_dismissed_until'
const COOLDOWN_MS  = 7 * 24 * 60 * 60 * 1000  // 7 days
const SHOW_DELAY   = 3000

export function PushPermissionPrompt() {
  const { state } = useStore()
  const userId    = state.user?.id

  const [visible, setVisible] = useState(false)
  const [asking,  setAsking]  = useState(false)

  useEffect(() => {
    if (!userId) return

    // Already granted — save token silently and wire up foreground handler
    if (Notification.permission === 'granted') {
      requestAndSaveFCMToken(userId)
      listenForegroundMessages()
      return
    }

    // Permanently denied — nothing to show
    if (Notification.permission === 'denied') return

    // Check cooldown from last dismiss
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (Date.now() < until) return

    const timer = setTimeout(() => setVisible(true), SHOW_DELAY)
    return () => clearTimeout(timer)
  }, [userId])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + COOLDOWN_MS))
    setVisible(false)
  }

  const allow = async () => {
    setAsking(true)
    const permission = await Notification.requestPermission()
    setVisible(false)
    setAsking(false)

    if (permission === 'granted') {
      await requestAndSaveFCMToken(userId)
      listenForegroundMessages()
    } else {
      // Denied or dismissed — apply cooldown so we don't keep asking
      localStorage.setItem(DISMISS_KEY, String(Date.now() + COOLDOWN_MS))
    }
  }

  if (!visible) return null

  return (
    <div className="push-prompt" role="dialog" aria-label="Enable notifications">
      <div className="push-prompt__inner">
        <div className="push-prompt__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div className="push-prompt__text">
          <p className="push-prompt__title">Stay updated on your orders</p>
          <p className="push-prompt__body">Get notified when your order status changes.</p>
        </div>
        <div className="push-prompt__actions">
          <button
            type="button"
            className="btn btn-primary push-prompt__allow"
            onClick={allow}
            disabled={asking}
          >
            {asking ? '…' : 'Allow'}
          </button>
          <button
            type="button"
            className="push-prompt__dismiss"
            onClick={dismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
