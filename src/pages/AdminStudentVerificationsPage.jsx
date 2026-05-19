import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../app/store'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTranslation } from '../i18n'
import {
  getAllVerifications,
  getSignedImageUrl,
  approveVerification,
  rejectVerification,
} from '../services/studentVerificationService'

function StatusBadge({ status, t }) {
  const cls =
    status === 'approved' ? 'student-badge student-badge--approved'
    : status === 'rejected' ? 'student-badge student-badge--rejected'
    : 'student-badge student-badge--pending'
  return <span className={cls}>{t(`adminStudents.status_${status}`)}</span>
}

export function AdminStudentVerificationsPage() {
  const { t } = useTranslation()
  const { state } = useStore()
  usePageMeta(t('adminStudents.title'), t('adminStudents.title'))

  const [verifications, setVerifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [expandedId, setExpandedId] = useState(null)
  const [imageUrls, setImageUrls] = useState({})
  const [noteText, setNoteText] = useState({})
  const [actionLoading, setActionLoading] = useState(null)
  const [actionError, setActionError] = useState({})

  const user = state.user
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    if (!isAdmin) return
    getAllVerifications().then(({ data, error }) => {
      if (!error) setVerifications(data)
      setLoading(false)
    })
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <article className="card card-body" style={{ textAlign: 'center' }}>
        <h2>Access denied</h2>
        <Link to="/" className="btn btn-secondary" style={{ marginTop: '1rem' }}>Home</Link>
      </article>
    )
  }

  const counts = {
    pending:  verifications.filter((v) => v.status === 'pending').length,
    approved: verifications.filter((v) => v.status === 'approved').length,
    rejected: verifications.filter((v) => v.status === 'rejected').length,
    all:      verifications.length,
  }

  const filtered = verifications.filter((v) => filter === 'all' || v.status === filter)

  async function handleExpand(v) {
    const next = expandedId === v.id ? null : v.id
    setExpandedId(next)
    if (next && !imageUrls[v.id]) {
      const { url } = await getSignedImageUrl(v.id_image_path)
      setImageUrls((prev) => ({ ...prev, [v.id]: url }))
    }
  }

  async function handleApprove(v) {
    setActionLoading(v.id)
    setActionError({})
    const { error } = await approveVerification(v.id, v.user_id)
    setActionLoading(null)
    if (error) { setActionError({ [v.id]: error.message }); return }
    setVerifications((prev) =>
      prev.map((x) => x.id === v.id ? { ...x, status: 'approved', reviewed_at: new Date().toISOString() } : x)
    )
    setExpandedId(null)
  }

  async function handleReject(v) {
    setActionLoading(v.id)
    setActionError({})
    const note = noteText[v.id] || ''
    const { error } = await rejectVerification(v.id, v.user_id, note)
    setActionLoading(null)
    if (error) { setActionError({ [v.id]: error.message }); return }
    setVerifications((prev) =>
      prev.map((x) => x.id === v.id ? { ...x, status: 'rejected', reviewer_note: note, reviewed_at: new Date().toISOString() } : x)
    )
    setExpandedId(null)
  }

  return (
    <div style={{ maxWidth: '740px', margin: '1.5rem auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <Link to="/admin" className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.3rem 0.85rem' }}>
          ← {t('adminStudents.back')}
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{t('adminStudents.title')}</h1>
      </div>

      <div className="my-orders-tabs" role="tablist" style={{ marginBottom: '1.25rem' }}>
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`my-orders-tab${filter === f ? ' my-orders-tab--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {t(`adminStudents.filter_${f}`)}
            {counts[f] > 0 && <span className="my-orders-tab__badge">{counts[f]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>...</p>
      ) : filtered.length === 0 ? (
        <article className="card card-body" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          {t('adminStudents.empty')}
        </article>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map((v) => {
            const isOpen = expandedId === v.id
            const isActioning = actionLoading === v.id
            return (
              <div key={v.id} className="card card-body" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>{v.school_name}</p>
                    <p className="muted" style={{ margin: '0.1rem 0 0', fontSize: '0.82rem' }}>
                      {t('adminStudents.studentId')}: {v.student_id_number}
                      {' · '}{new Date(v.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <StatusBadge status={v.status} t={t} />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.7rem' }}
                      onClick={() => handleExpand(v)}
                    >
                      {isOpen ? '▲' : t('adminStudents.viewId')}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    {imageUrls[v.id] ? (
                      <img
                        src={imageUrls[v.id]}
                        alt="Student ID"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '320px',
                          objectFit: 'contain',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          display: 'block',
                          margin: '0 auto 1rem',
                        }}
                      />
                    ) : (
                      <p className="muted" style={{ textAlign: 'center', marginBottom: '1rem' }}>Loading image...</p>
                    )}

                    {v.status === 'pending' && (
                      <>
                        <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                          <label style={{ fontSize: '0.85rem' }}>{t('adminStudents.noteLabel')}</label>
                          <input
                            type="text"
                            placeholder={t('adminStudents.notePlaceholder')}
                            value={noteText[v.id] || ''}
                            onChange={(e) => setNoteText((prev) => ({ ...prev, [v.id]: e.target.value }))}
                            disabled={isActioning}
                            style={{ fontSize: '0.88rem' }}
                          />
                        </div>
                        {actionError[v.id] && (
                          <p className="error-text" style={{ marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                            {actionError[v.id]}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ flex: 1, background: 'var(--success)', borderColor: 'var(--success)' }}
                            onClick={() => handleApprove(v)}
                            disabled={isActioning}
                          >
                            {isActioning ? '...' : t('adminStudents.approve')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ flex: 1, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            onClick={() => handleReject(v)}
                            disabled={isActioning}
                          >
                            {isActioning ? '...' : t('adminStudents.reject')}
                          </button>
                        </div>
                      </>
                    )}

                    {v.status !== 'pending' && (
                      <p className="muted" style={{ fontSize: '0.85rem' }}>
                        {t('adminStudents.reviewedOn')}: {v.reviewed_at ? new Date(v.reviewed_at).toLocaleDateString() : '—'}
                        {v.reviewer_note && (
                          <span style={{ marginLeft: '0.5rem' }}>
                            · {t('adminStudents.note')}: {v.reviewer_note}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
