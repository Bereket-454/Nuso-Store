// Supabase Edge Function — send-push
// Handles two notification types:
//   1. order_status_update — customer push when their order status changes
//   2. new_order           — admin push when any new order is placed
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
  const jwtPayload = {
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }

  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const body    = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signing = `${header}.${body}`

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

// ── FCM HTTP v1 send (single token) ──────────────────────────────────────────
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
}): Promise<void> {
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
}

// ── Order status labels (customer notifications) ──────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  pending:          'Order received',
  confirmed:        'Order confirmed',
  preparing:        'Your order is being prepared',
  out_for_delivery: 'Out for delivery',
  delivered:        'Order delivered!',
  cancelled:        'Order cancelled',
}

// ── Format ETB amount ─────────────────────────────────────────────────────────
function formatBirr(amount: number): string {
  return `ETB ${Number(amount).toLocaleString('en-US')}`
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

  let payload: {
    type?:   string
    record?: {
      id?:            string
      user_id?:       string
      status?:        string
      customer_name?: string
      total?:         number
    }
  } = {}

  try {
    payload = await req.json()
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Branch: new order → notify all admins ──────────────────────────────────
  if (payload.type === 'new_order') {
    const { record } = payload
    if (!record?.id) {
      return new Response('missing record.id for new_order', { status: 400 })
    }

    const customerName = record.customer_name || 'A customer'
    const totalStr     = record.total ? formatBirr(record.total) : ''
    const title        = '🛍️ New Order Received'
    const body         = totalStr
      ? `${customerName} placed an order — ${totalStr}`
      : `${customerName} placed a new order`

    // Fetch all admin FCM tokens in one query
    const { data: admins, error: adminsErr } = await supabase
      .from('profiles')
      .select('id, fcm_token, role')
      .in('role', ['super_admin', 'order_manager', 'delivery_manager'])
      .not('fcm_token', 'is', null)

    if (adminsErr) {
      console.error('[send-push] new_order — failed to fetch admins:', adminsErr.message)
      return new Response('db error', { status: 500 })
    }

    if (!admins || admins.length === 0) {
      console.log('[send-push] new_order — no admins with fcm_token registered')
      return new Response('ok — no admin tokens', { status: 200 })
    }

    console.log(`[send-push] new_order — sending to ${admins.length} admin(s) for order ${record.id}`)

    try {
      const accessToken = await getGoogleAccessToken(serviceAccountJson)

      // Send to all admins in parallel; log individual failures without failing the whole batch
      const results = await Promise.allSettled(
        admins.map((admin) =>
          sendFCMNotification({
            fcmToken:    admin.fcm_token,
            title,
            body,
            data:        { url: '/admin', orderId: record.id || '', type: 'new_order' },
            accessToken,
          }).then(() => {
            console.log(`[send-push] new_order — sent to ${admin.role} (${admin.id})`)
          }).catch((err: Error) => {
            console.error(`[send-push] new_order — failed for ${admin.role} (${admin.id}):`, err.message)
          })
        ),
      )

      const sent   = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      console.log(`[send-push] new_order — done: ${sent} sent, ${failed} failed`)

      return new Response(JSON.stringify({ sent, failed }), {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      console.error('[send-push] new_order — Google auth error:', (err as Error).message)
      return new Response('auth error', { status: 500 })
    }
  }

  // ── Branch: order status update → notify the customer ─────────────────────
  const { record } = payload
  if (!record?.user_id || !record?.status) {
    return new Response('missing user_id or status', { status: 400 })
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', record.user_id)
    .single()

  if (profileErr || !profile?.fcm_token) {
    console.log('[send-push] status_update — no fcm_token for user', record.user_id)
    return new Response('ok — no token', { status: 200 })
  }

  const statusLabel = STATUS_LABELS[record.status] || `Order ${record.status}`
  const title       = `Nuso Store — ${statusLabel}`
  const body        = record.status === 'delivered'
    ? 'Your order has been delivered! Thank you for shopping with us.'
    : `Your order status: ${statusLabel}`

  try {
    const accessToken = await getGoogleAccessToken(serviceAccountJson)
    await sendFCMNotification({
      fcmToken:    profile.fcm_token,
      title,
      body,
      data:        { url: '/tracking', orderId: record.id || '', type: 'status_update' },
      accessToken,
    })
    console.log('[send-push] status_update — sent for order', record.id, '→', record.status)
    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('[send-push] status_update — error:', (err as Error).message)
    return new Response('send failed', { status: 500 })
  }
})
