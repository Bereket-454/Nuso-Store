import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import { isValidEthiopianPhone, formatPhone } from '../lib/auth'

// Send an email notification to the admin via the EmailJS REST API.
// Requires VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and
// VITE_EMAILJS_PUBLIC_KEY environment variables to be configured.
// If they are not set this is a no-op — the request is already saved in Supabase.
async function sendEmailNotification(data) {
  const serviceId  = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  if (!serviceId || !templateId || !publicKey) {
    console.log('[Request] Email skipped — VITE_EMAILJS_* env vars not configured')
    return
  }
  try {
    console.log('[Request] Sending EmailJS notification…')
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: 'bereketdemeke454@gmail.com',
          product_name: data.productName,
          customer_name: data.customerName,
          telegram_phone: data.telegramPhone,
          description: data.description,
          extra_details: data.extraDetails || 'None',
          photo_url: data.photoUrl,
        },
      }),
    })
    console.log('[Request] EmailJS response status:', res.status, res.statusText)
  } catch (err) {
    console.error('[Request] EmailJS threw:', err)
  }
}

const emptyForm = {
  productName: '',
  description: '',
  customerName: '',
  telegramPhone: '',
  extraDetails: '',
}

export function RequestProductPage() {
  const { t } = useTranslation()
  const { state } = useStore()
  const user = state.user  // null when not signed in
  usePageMeta(t('meta.request.title'), t('meta.request.desc'))

  const [form, setForm] = useState(emptyForm)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef(null)

  // When the auth state resolves (on mount or after sign-in) pre-fill known fields.
  // customerName is locked to the account name; telegramPhone is pre-filled but editable
  // in case the user has a different Telegram number than their account phone.
  useEffect(() => {
    if (!user) return
    setForm((prev) => ({
      ...prev,
      customerName: user.name || prev.customerName,
      // Only pre-fill phone if the field is still empty so manual edits are preserved.
      telegramPhone: prev.telegramPhone || user.phone || '',
    }))
  }, [user?.name, user?.phone])

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setErrors((prev) => ({ ...prev, photo: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!photo) errs.photo = t('request.errorPhotoRequired')
    if (!form.productName.trim()) errs.productName = t('request.errorNameRequired')
    if (!form.description.trim()) errs.description = t('request.errorDescRequired')
    if (!form.customerName.trim()) errs.customerName = t('request.errorCustomerRequired')
    if (!form.telegramPhone.trim()) {
      errs.telegramPhone = t('request.errorPhoneRequired')
    } else {
      const normalized = formatPhone(form.telegramPhone.trim())
      if (!normalized || !isValidEthiopianPhone(normalized)) {
        errs.telegramPhone = t('request.errorPhoneInvalid')
      }
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setLoading(true)
    setErrors({})

    // ── Step 1: photo upload ─────────────────────────────────────────────────
    let publicUrl
    try {
      const ext = photo.name.split('.').pop().toLowerCase()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      console.log('[Request] Step 1 — uploading photo:', fileName, 'size:', photo.size, 'type:', photo.type)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('requests')
        .upload(fileName, photo, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        console.error('[Request] Photo upload failed:', uploadError.message, uploadError)
        setErrors({ submit: `Photo upload failed: ${uploadError.message}` })
        return
      }

      console.log('[Request] Photo upload succeeded. path:', uploadData.path)
      const { data: urlData } = supabase.storage.from('requests').getPublicUrl(uploadData.path)
      publicUrl = urlData.publicUrl
      console.log('[Request] Public URL:', publicUrl)
    } catch (err) {
      console.error('[Request] Photo upload threw:', err)
      setErrors({ submit: `Photo upload error: ${err.message}` })
      setLoading(false)
      return
    }

    // ── Step 2: database insert ──────────────────────────────────────────────
    const normalized = formatPhone(form.telegramPhone.trim())
    const row = {
      photo_url: publicUrl,
      product_name: form.productName.trim(),
      description: form.description.trim(),
      customer_name: form.customerName.trim(),
      telegram_phone: normalized,
      extra_details: form.extraDetails.trim() || null,
      status: 'pending',
    }
    console.log('[Request] Step 2 — inserting row:', row)

    try {
      const { data: insertData, error: insertError } = await supabase
        .from('product_requests')
        .insert(row)
        .select()

      if (insertError) {
        console.error('[Request] DB insert failed:', insertError.message, 'code:', insertError.code, insertError)
        setErrors({ submit: `Database save failed: ${insertError.message}` })
        setLoading(false)
        return
      }

      console.log('[Request] DB insert succeeded:', insertData)
    } catch (err) {
      console.error('[Request] DB insert threw:', err)
      setErrors({ submit: `Database error: ${err.message}` })
      setLoading(false)
      return
    }

    // ── Step 3: email notification (best-effort, never blocks) ───────────────
    console.log('[Request] Step 3 — sending email notification (best-effort)')
    sendEmailNotification({
      productName: form.productName.trim(),
      description: form.description.trim(),
      customerName: form.customerName.trim(),
      telegramPhone: normalized,
      extraDetails: form.extraDetails.trim(),
      photoUrl: publicUrl,
    })
    console.log('[Request] Email notification dispatched (fire-and-forget)')

    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <article className="card card-body" style={{ textAlign: 'center', padding: '3rem 1.5rem', maxWidth: '540px', margin: '2rem auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✓</div>
        <h2 style={{ margin: '0 0 0.75rem' }}>{t('request.successTitle')}</h2>
        <p style={{ color: 'var(--muted)', maxWidth: '380px', margin: '0 auto' }}>{t('request.successMessage')}</p>
      </article>
    )
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <h1>{t('request.title')}</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>{t('request.subtitle')}</p>

      <form onSubmit={handleSubmit} noValidate>
        {/* Photo upload */}
        <div className="form-group">
          <label>{t('request.photoLabel')} <span style={{ color: 'var(--danger)' }}>*</span></label>
          <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>{t('request.photoHint')}</p>
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Preview"
              style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', display: 'block', marginBottom: '0.5rem', border: '1px solid var(--border)' }}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            {photo ? t('request.changePhoto') : t('request.choosePhoto')}
          </button>
          {errors.photo && <p className="error-text" style={{ marginTop: '0.3rem' }}>{errors.photo}</p>}
        </div>

        {/* Product name */}
        <div className="form-group">
          <label htmlFor="req-name">{t('request.productNameLabel')} <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input
            id="req-name"
            value={form.productName}
            onChange={set('productName')}
            placeholder={t('request.productNamePlaceholder')}
          />
          {errors.productName && <p className="error-text">{errors.productName}</p>}
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="req-desc">{t('request.descriptionLabel')} <span style={{ color: 'var(--danger)' }}>*</span></label>
          <textarea
            id="req-desc"
            rows={3}
            value={form.description}
            onChange={set('description')}
            placeholder={t('request.descriptionPlaceholder')}
          />
          {errors.description && <p className="error-text">{errors.description}</p>}
        </div>

        {/* Customer name — read-only when signed in */}
        <div className="form-group">
          <label htmlFor="req-customer-name">
            {t('request.customerNameLabel')} <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          {user ? (
            <>
              <input
                id="req-customer-name"
                value={form.customerName}
                readOnly
                style={{ background: 'var(--surface)', color: 'var(--muted)', cursor: 'default' }}
              />
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--success)' }}>
                ✓ {t('request.signedInAs', { name: user.name || user.email })}
              </p>
            </>
          ) : (
            <>
              <input
                id="req-customer-name"
                value={form.customerName}
                onChange={set('customerName')}
                placeholder={t('request.customerNamePlaceholder')}
              />
              {errors.customerName && <p className="error-text">{errors.customerName}</p>}
            </>
          )}
        </div>

        {/* Telegram phone — pre-filled from account phone when signed in, always editable */}
        <div className="form-group">
          <label htmlFor="req-phone">
            {t('request.telegramPhoneLabel')} <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="req-phone"
            type="tel"
            value={form.telegramPhone}
            onChange={set('telegramPhone')}
            placeholder={t('request.telegramPhonePlaceholder')}
          />
          {errors.telegramPhone && <p className="error-text">{errors.telegramPhone}</p>}
        </div>

        {/* Extra details (optional) */}
        <div className="form-group">
          <label htmlFor="req-extra">{t('request.extraDetailsLabel')}</label>
          <textarea
            id="req-extra"
            rows={3}
            value={form.extraDetails}
            onChange={set('extraDetails')}
            placeholder={t('request.extraDetailsPlaceholder')}
          />
        </div>

        {errors.submit && (
          <p className="error-text" style={{ marginBottom: '0.75rem' }}>{errors.submit}</p>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
          {loading ? t('request.submitting') : t('request.submitButton')}
        </button>
      </form>
    </div>
  )
}
