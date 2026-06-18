// Supabase Edge Function — send-push
// Receives a webhook payload when an order status changes, then sends
// an FCM push notification to the customer's registered device.
//
// Required Supabase secrets (set via: supabase secrets set KEY=value):
//   GOOGLE_SERVICE_ACCOUNT_JSON  — full JSON of the Firebase service account key
//   SUPABASE_URL                 — your project URL (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (auto-injected)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Google OAuth2 token from service account ──────────────────────────────────
async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }

  // Build JWT header + payload
  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const body    = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signing = `${header}.${body}`

  // Import private key
  const keyData = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sigBytes  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signing))
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBytes))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt       = `${signing}.${signature}`

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get Google access token: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token
}

// ── FCM HTTP v1 send ──────────────────────────────────────────────────────────
async function sendFCMNotification({
  fcmToken,
  title,
  body,
  data,
  accessToken,
}: {
  fcmToken:    string
  title:       string
  body:        string
  data?:       Record<string, string>
  accessToken: string
}) {
  const res = await fetch(
    'https://fcm.googleapis.com/v1/projects/nuso-store/messages:send',
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token:        fcmToken,
          notification: { title, body },
          webpush: {
            notification: {
              title,
              body,
              icon:  '/nuso-icon.png',
              badge: '/nuso-icon.png',
            },
            fcm_options: { link: data?.url || '/' },
          },
          data: data || {},
        },
      }),
    },
  )

  const result = await res.json()
  if (!res.ok) throw new Error(`FCM send failed: ${JSON.stringify(result)}`)
  return result
}

// ── Human-readable order status labels ────────────────────────────────────────
const STATUS_LABELS: Record<string, { en: string; am: string }> = {
  pending:          { en: 'Order received',        am: 'ትዕዛዝ ደረሰን' },
  confirmed:        { en: 'Order confirmed',        am: 'ትዕዛዝ ተረጋገጠ' },
  preparing:        { en: 'Preparing your order',   am: 'ትዕዛዝ እየተዘጋጀ ነው' },
  out_for_delivery: { en: 'Out for delivery',       am: 'ወደ ቤትዎ እየሄደ ነው' },
  delivered:        { en: 'Order delivered!',       am: 'ትዕዛዝ ደረሰ!' },
  cancelled:        { en: 'Order cancelled',        am: 'ትዕዛዝ ተሰርዟል' },
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!serviceAccountJson) {
    console.error('[send-push] GOOGLE_SERVICE_ACCOUNT_JSON secret not set')
    return new Response('server misconfigured', { status: 500 })
  }

  let payload: { record?: { user_id?: string; status?: string; id?: string } } = {}
  try {
    payload = await req.json()
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  const { record } = payload
  if (!record?.user_id || !record?.status) {
    return new Response('missing user_id or status', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', record.user_id)
    .single()

  if (error || !profile?.fcm_token) {
    console.log('[send-push] no fcm_token for user', record.user_id)
    return new Response('ok — no token', { status: 200 })
  }

  const label = STATUS_LABELS[record.status] || { en: `Order ${record.status}`, am: `ትዕዛዝ ${record.status}` }

  try {
    const accessToken = await getGoogleAccessToken(serviceAccountJson)
    await sendFCMNotification({
      fcmToken:    profile.fcm_token,
      title:       `Nuso Store — ${label.en}`,
      body:        `Your order has been updated: ${label.en}`,
      data:        { url: `/tracking`, orderId: record.id || '' },
      accessToken,
    })
    console.log('[send-push] notification sent for order', record.id, 'status:', record.status)
    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('[send-push] error:', err.message)
    return new Response('send failed', { status: 500 })
  }
})
