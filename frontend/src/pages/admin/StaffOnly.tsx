import { useI18n } from '../../i18n/useI18n'

/** Every administration screen ends here for anyone who is not staff. In the
 *  prototype the role comes from the switch; the server will decide later, and
 *  this check is never the boundary that matters. */
export function StaffOnly() {
  const { t } = useI18n()

  return (
    <div className="member">
      <h1>{t('admin.notAllowed')}</h1>
      <p className="member__note">{t('admin.notAllowedText')}</p>
    </div>
  )
}
