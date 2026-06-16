import { supabase } from '../lib/supabase'

/**
 * Insert a notification row for a specific user.
 * Called by admin actions — fires and forgets in non-critical paths.
 */
export async function insertNotification({ userId, type, title, message, messageAm, link, orderId }) {
  if (!userId) return
  const row = {
    user_id:    userId,
    type,
    message,
    message_am: messageAm || '',
    link:       link || null,
  }
  if (title)   row.title    = title
  if (orderId) row.order_id = orderId
  const { error } = await supabase.from('notifications').insert(row)
  if (error) console.error('[notificationsService] insert error:', error.message)
}

/**
 * Notify all admin users (super_admin, admin, order_manager, delivery_manager)
 * when a customer places a new order. Fire-and-forget — never throws.
 */
export async function notifyAdmins({ orderId, customerName, total }) {
  try {
    const { data: admins, error } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['super_admin', 'admin', 'order_manager', 'delivery_manager'])

    if (error || !admins?.length) {
      if (error) console.error('[notificationsService] fetch admins error:', error.message)
      return
    }

    const totalStr = `${Number(total).toLocaleString()} ETB`
    const message   = `🛍️ New order from ${customerName} — ${totalStr}`
    const messageAm = `🛍️ ${customerName} አዲስ ትዕዛዝ አስቀምጠዋል — ${totalStr}`

    await Promise.all(
      admins.map((admin) =>
        insertNotification({
          userId:    admin.id,
          type:      'new_order',
          message,
          messageAm,
          link:      '/admin',
          orderId,
        })
      )
    )
  } catch (err) {
    console.error('[notificationsService] notifyAdmins error:', err.message)
  }
}

/**
 * Send an order status email via EmailJS REST API.
 * Requires VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_ORDER_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY.
 * Fails silently so checkout/order flow is never blocked.
 */
export async function sendOrderEmail({ toEmail, toName, message, orderId }) {
  const serviceId  = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env.VITE_EMAILJS_ORDER_TEMPLATE_ID
  const publicKey  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

  if (!serviceId || !templateId || !publicKey || !toEmail) return

  try {
    await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:  serviceId,
        template_id: templateId,
        user_id:     publicKey,
        template_params: {
          to_email: toEmail,
          to_name:  toName || 'Customer',
          message,
          order_id: orderId,
        },
      }),
    })
  } catch (err) {
    console.error('[notificationsService] email send error:', err.message)
  }
}
