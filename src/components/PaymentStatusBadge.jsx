import { useTranslation } from '../i18n'

export function PaymentStatusBadge({ status }) {
  const { t } = useTranslation()
  const s = status || 'pending'
  return (
    <span className={`pay-status pay-status--${s}`}>
      {t(`paymentStatus.${s}`, { defaultValue: s })}
    </span>
  )
}
