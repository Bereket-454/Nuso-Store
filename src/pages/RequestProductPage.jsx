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
      <div className="req-success">
        <div className="req-success__icon" aria-hidden="true">✓</div>
        <h2 className="req-success__title">{t('request.successTitle')}</h2>
        <p className="req-success__msg">{t('request.successMessage')}</p>
        <div className="req-trust-pills" style={{ justifyContent: 'center', marginTop: '1.75rem' }}>
          <span className="req-trust-pill">📲 Telegram</span>
          <span className="req-trust-pill">⚡ 30 min</span>
          <span className="req-trust-pill">✓ {t('requestStatus.confirmed')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="req-page">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="req-hero">
        <div className="req-hero__icon" aria-hidden="true">🛍️</div>
        <h1 className="req-hero__title">{t('request.heroTitle')}</h1>
        <p className="req-hero__subtitle">{t('request.heroSubtitle')}</p>
        <div className="req-trust-pills">
          <span className="req-trust-pill">⚡ {t('request.trust1')}</span>
          <span className="req-trust-pill">📦 {t('request.trust2')}</span>
          <span className="req-trust-pill">🎓 {t('request.trust3')}</span>
        </div>
      </div>

      {/* ── Step indicators ───────────────────────────────────────────────── */}
      <div className="req-steps" aria-label="How it works">
        <div className="req-step">
          <div className="req-step__num" aria-hidden="true">1</div>
          <div className="req-step__label">{t('request.step1Label')}</div>
        </div>
        <div className="req-step-divider" aria-hidden="true" />
        <div className="req-step">
          <div className="req-step__num" aria-hidden="true">2</div>
          <div className="req-step__label">{t('request.step2Label')}</div>
        </div>
        <div className="req-step-divider" aria-hidden="true" />
        <div className="req-step">
          <div className="req-step__num" aria-hidden="true">3</div>
          <div className="req-step__label">{t('request.step3Label')}</div>
        </div>
      </div>

      {/* ── Form card ─────────────────────────────────────────────────────── */}
      <div className="req-card">
        <form onSubmit={handleSubmit} noValidate>

          {/* Photo upload zone */}
          <div
            className={`req-photo-zone${photoPreview ? ' req-photo-zone--has-photo' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label={photo ? t('request.changePhoto') : t('request.photoLabel')}
          >
            {photoPreview ? (
              <>
                <img src={photoPreview} alt="Product preview" className="req-photo-preview" />
                <span className="req-photo-zone__change">{t('request.changePhoto')}</span>
              </>
            ) : (
              <>
                <div className="req-photo-zone__icon" aria-hidden="true">📷</div>
                <div className="req-photo-zone__label">{t('request.photoLabel')}</div>
                <div className="req-photo-zone__hint">{t('request.photoHint')}</div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
          {errors.photo && <p className="error-text" style={{ marginTop: '-0.75rem', marginBottom: '1rem' }}>{errors.photo}</p>}

          {/* Product name */}
          <div className="form-group req-form-group">
            <label htmlFor="req-name" className="req-label">
              {t('request.productNameLabel')} <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="req-name"
              className="req-input"
              value={form.productName}
              onChange={set('productName')}
              placeholder={t('request.productNamePlaceholder')}
            />
            {errors.productName && <p className="error-text">{errors.productName}</p>}
          </div>

          {/* Description */}
          <div className="form-group req-form-group">
            <label htmlFor="req-desc" className="req-label">
              {t('request.descriptionLabel')} <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              id="req-desc"
              className="req-input"
              rows={4}
              value={form.description}
              onChange={set('description')}
              placeholder={t('request.descriptionPlaceholder')}
            />
            {errors.description && <p className="error-text">{errors.description}</p>}
          </div>

          {/* Customer name — read-only when signed in */}
          <div className="form-group req-form-group">
            <label htmlFor="req-customer-name" className="req-label">
              {t('request.customerNameLabel')} <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span>
            </label>
            {user ? (
              <>
                <input
                  id="req-customer-name"
                  className="req-input req-input--readonly"
                  value={form.customerName}
                  readOnly
                />
                <p className="req-signed-in-note">
                  ✓ {t('request.signedInAs', { name: user.name || user.email })}
                </p>
              </>
            ) : (
              <>
                <input
                  id="req-customer-name"
                  className="req-input"
                  value={form.customerName}
                  onChange={set('customerName')}
                  placeholder={t('request.customerNamePlaceholder')}
                />
                {errors.customerName && <p className="error-text">{errors.customerName}</p>}
              </>
            )}
          </div>

          {/* Telegram phone — pre-filled from account phone when signed in, always editable */}
          <div className="form-group req-form-group">
            <label htmlFor="req-phone" className="req-label">
              {t('request.telegramPhoneLabel')} <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="req-phone"
              className="req-input"
              type="tel"
              value={form.telegramPhone}
              onChange={set('telegramPhone')}
              placeholder={t('request.telegramPhonePlaceholder')}
            />
            {errors.telegramPhone && <p className="error-text">{errors.telegramPhone}</p>}
          </div>

          {/* Extra details (optional) */}
          <div className="form-group req-form-group">
            <label htmlFor="req-extra" className="req-label">{t('request.extraDetailsLabel')}</label>
            <textarea
              id="req-extra"
              className="req-input"
              rows={3}
              value={form.extraDetails}
              onChange={set('extraDetails')}
              placeholder={t('request.extraDetailsPlaceholder')}
            />
          </div>

          {errors.submit && (
            <p className="error-text" style={{ marginBottom: '1rem' }}>{errors.submit}</p>
          )}

          <button type="submit" className="req-submit-btn" disabled={loading}>
            {loading
              ? t('request.submitting')
              : <>{t('request.submitButton')} <span aria-hidden="true">→</span></>
            }
          </button>
          <p className="req-microcopy">{t('request.microcopy')}</p>
        </form>
      </div>

    </div>
  )
}
