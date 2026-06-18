import { getToken, onMessage } from 'firebase/messaging'
import { getFirebaseMessaging } from '../lib/firebase'
import { supabase } from '../lib/supabase'

const VAPID_KEY = 'BGN29UM2SvLAx1a66FaaCvquyAWZX-bf9C9oT-fm2Q4KrObAjJxNsPtIKztrzXDMTzWI4ws5BKOYk7TFtTEHTW8'

export async function requestAndSaveFCMToken(userId) {
  if (!userId) return null

  const messaging = await getFirebaseMessaging()
  if (!messaging) {
    console.log('[FCM] messaging not supported in this browser')
    return null
  }

  if (Notification.permission === 'denied') {
    console.log('[FCM] notifications denied by user')
    return null
  }

  try {
    // Use the existing PWA service worker registration — avoids scope conflict
    // with a second firebase-messaging-sw.js at scope /
    const registration = await navigator.serviceWorker.ready

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })

    if (!token) {
      console.log('[FCM] no token returned — permission may not be granted')
      return null
    }

    console.log('[FCM] token obtained:', token.slice(0, 20) + '…')

    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', userId)

    if (error) console.error('[FCM] failed to save token:', error.message)
    else console.log('[FCM] token saved to profiles')

    return token
  } catch (err) {
    console.error('[FCM] requestAndSaveFCMToken error:', err.message)
    return null
  }
}

// Handle foreground push messages (when app is open)
export async function listenForegroundMessages() {
  const messaging = await getFirebaseMessaging()
  if (!messaging) return () => {}

  return onMessage(messaging, (payload) => {
    console.log('[FCM] foreground message received:', payload)
    const { title, body } = payload.notification || {}
    if (!title) return

    // Show a brief notification even in foreground using the Notifications API
    // so the user sees it regardless of which page they're on
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body:  body || '',
        icon:  '/nuso-icon.png',
        badge: '/nuso-icon.png',
        tag:   'nuso-foreground',
      })
    }
  })
}
