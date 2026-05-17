import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTranslation } from '../i18n'

const IconBell = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
)

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationBell({ userId }) {
  const { t, language } = useTranslation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Initial load
  useEffect(() => {
    if (!userId) return
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { if (data) setNotifications(data) })
  }, [userId])

  // Real-time: new INSERT for this user → prepend to list
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notif-user-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setNotifications((prev) => [payload.new, ...prev]),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleClickNotif = async (n) => {
    setOpen(false)
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
    }
    if (n.link) navigate(n.link)
  }

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  if (!userId) return null

  return (
    <div className="notif-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="pill notif-bell"
        aria-label={unreadCount > 0 ? t('notif.bellLabel', { count: unreadCount }) : t('notif.bellLabelEmpty')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell />
        {unreadCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label={t('notif.title')}>
          <div className="notif-dropdown__header">
            <span className="notif-dropdown__title">{t('notif.title')}</span>
            {unreadCount > 0 && (
              <button type="button" className="notif-dropdown__mark-all" onClick={markAllRead}>
                {t('notif.markAllRead')}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="notif-dropdown__empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--muted)', opacity: 0.45, marginBottom: '0.5rem' }}>
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem' }}>{t('notif.empty')}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.45 }}>{t('notif.emptyHint')}</p>
            </div>
          ) : (
            <ul className="notif-list" role="list">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`notif-item${n.read ? ' notif-item--read' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleClickNotif(n)}
                  onKeyDown={(e) => e.key === 'Enter' && handleClickNotif(n)}
                >
                  {!n.read && <span className="notif-item__dot" aria-hidden="true" />}
                  <div className="notif-item__body">
                    <p className="notif-item__msg">
                      {language === 'am' && n.message_am ? n.message_am : n.message}
                    </p>
                    <p className="notif-item__time">{timeAgo(n.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
