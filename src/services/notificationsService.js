import { supabase } from '../lib/supabase'

/**
 * Insert a notification row for a specific user.
 * Called by admin actions — fires and forgets in non-critical paths.
 */
export async function insertNotification({ userId, type, message, messageAm, link }) {
  if (!userId) return
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    message,
    message_am: messageAm || '',
    link: link || null,
  })
  if (error) console.error('[notificationsService] insert error:', error.message)
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
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: toEmail,
          to_name: toName || 'Customer',
          message,
          order_id: orderId,
        },
      }),
    })
  } catch (err) {
    console.error('[notificationsService] email send error:', err.message)
  }
}
