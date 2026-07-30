import { useI18n } from '../../i18n/useI18n'

/**
 * Every administration screen ends here for anyone who is not staff. In the
 * prototype the role comes from the switch; the server will decide later, and
 * this check is never the boundary that matters.
 *
 * The sentence under the heading is given where the reason is a different one.
 * Moderators are the one entity a moderator may not open (PDL P21), so the
 * standard "only moderators and the superadmin see this" would be read by a
 * moderator as a fault rather than as the rule it is.
 */
export function StaffOnly({ noteKey = 'admin.notAllowedText' }: { noteKey?: string }) {
  const { t } = useI18n()

  return (
    <div className="member">
      <h1>{t('admin.notAllowed')}</h1>
      <p className="member__note">{t(noteKey)}</p>
    </div>
  )
}
