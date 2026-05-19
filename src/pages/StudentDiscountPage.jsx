import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import {
  getMyVerification,
  submitStudentVerification,
} from '../services/studentVerificationService'

function IconCamera() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )
}

export function StudentDiscountPage() {
  const { t } = useTranslation()
  const { state } = useStore()
  usePageMeta(t('studentDiscount.pageTitle'), t('studentDiscount.pageTitle'))

  const [verification, setVerification] = useState(null)
  const [loading, setLoading] = useState(true)
  const [schoolName, setSchoolName] = useState('')
  const [studentIdNumber, setStudentIdNumber] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const fileRef = useRef(null)

  const user = state.user

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    getMyVerification(user.id).then(({ data }) => {
      setVerification(data)
      if (data) {
        setSchoolName(data.school_name)
        setStudentIdNumber(data.student_id_number)
      }
      setLoading(false)
    })
  }, [user?.id])

  if (!user) {
    return (
      <article className="card card-body sv-card">
        <div style={{ fontSize: '2.5rem', textAlign: 'center' }}>🎓</div>
        <h2 style={{ textAlign: 'center' }}>{t('studentDiscount.pageTitle')}</h2>
        <p className="muted" style={{ textAlign: 'center' }}>{t('studentDiscount.explainer')}</p>
        <Link to="/account?returnTo=/student-discount" className="btn btn-primary" style={{ marginTop: '1rem', display: 'block', textAlign: 'center' }}>
          {t('studentDiscount.signInRequired')}
        </Link>
      </article>
    )
  }

  if (loading) {
    return <div className="card card-body sv-card" style={{ textAlign: 'center' }}>...</div>
  }

  if (verification?.status === 'approved') {
    return (
      <article className="card card-body sv-card">
        <div className="sv-status-icon sv-status-icon--approved">✓</div>
        <h2>{t('studentDiscount.approvedTitle')}</h2>
        <p className="muted">{t('studentDiscount.approvedHint')}</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          {t('studentDiscount.school')}: <strong>{verification.school_name}</strong>
        </p>
        <Link to="/products" className="btn btn-primary" style={{ marginTop: '1.25rem', display: 'block', textAlign: 'center' }}>
          {t('account.shopNow')}
        </Link>
      </article>
    )
  }

  if (verification?.status === 'pending') {
    return (
      <article className="card card-body sv-card">
        <div className="sv-status-icon sv-status-icon--pending">⏳</div>
        <h2>{t('studentDiscount.pendingTitle')}</h2>
        <p className="muted">{t('studentDiscount.pendingHint')}</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
          {t('studentDiscount.school')}: <strong>{verification.school_name}</strong>
        </p>
      </article>
    )
  }

  const isRejected = verification?.status === 'rejected'

  async function handleSubmit() {
    if (!schoolName.trim()) { setError(t('studentDiscount.errorSchool')); return }
    if (!studentIdNumber.trim()) { setError(t('studentDiscount.errorStudentId')); return }
    if (!imageFile) { setError(t('studentDiscount.errorImage')); return }
    setSubmitting(true)
    setError('')
    const { error: submitErr } = await submitStudentVerification(user.id, {
      schoolName: schoolName.trim(),
      studentIdNumber: studentIdNumber.trim(),
      imageFile,
    })
    setSubmitting(false)
    if (submitErr) { setError(t('studentDiscount.submitError')); return }
    setVerification({ status: 'pending', school_name: schoolName.trim(), student_id_number: studentIdNumber.trim() })
    setSuccess(true)
  }

  return (
    <div style={{ maxWidth: '520px', margin: '1.5rem auto' }}>
      <article className="card card-body sv-card">
        <div style={{ fontSize: '2.5rem', textAlign: 'center' }}>🎓</div>
        <h1 style={{ textAlign: 'center', marginBottom: '0.25rem' }}>{t('studentDiscount.pageTitle')}</h1>
        <p className="muted" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {t('studentDiscount.explainer')}
        </p>

        {isRejected && (
          <div className="sv-rejected-notice">
            <strong>{t('studentDiscount.rejectedTitle')}</strong>
            {verification.reviewer_note && (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>{verification.reviewer_note}</p>
            )}
          </div>
        )}

        {success ? (
          <p className="success-text" style={{ textAlign: 'center', padding: '0.75rem 0' }}>
            {t('studentDiscount.submitSuccess')}
          </p>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="sv-school">{t('studentDiscount.schoolLabel')}</label>
              <input
                id="sv-school"
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="sv-sid">{t('studentDiscount.studentIdLabel')}</label>
              <input
                id="sv-sid"
                type="text"
                value={studentIdNumber}
                onChange={(e) => setStudentIdNumber(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label>{t('studentDiscount.uploadLabel')}</label>
              <div
                className={`sv-upload-zone${imagePreview ? ' sv-upload-zone--has-image' : ''}`}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label={t('studentDiscount.uploadLabel')}
              >
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Student ID preview" className="sv-upload-zone__preview" />
                    <span className="sv-upload-zone__change">{t('studentDiscount.changeImage')}</span>
                  </>
                ) : (
                  <>
                    <span className="sv-upload-zone__icon"><IconCamera /></span>
                    <span className="sv-upload-zone__label">{t('studentDiscount.uploadHint')}</span>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setImageFile(file)
                  setImagePreview(URL.createObjectURL(file))
                }}
              />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
              style={{ width: '100%' }}
            >
              {submitting
                ? t('studentDiscount.submitting')
                : isRejected
                  ? t('studentDiscount.resubmitBtn')
                  : t('studentDiscount.submitBtn')}
            </button>
          </>
        )}
      </article>
    </div>
  )
}
