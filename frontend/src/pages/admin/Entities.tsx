import { useI18n } from '../../i18n/useI18n'
import '../member/Member.css'

/**
 * What the section is, on the way into it.
 *
 * The entities themselves are in the navigation beside this and beside every
 * screen behind it (SectionNav, owner 30.07.2026). They used to be a row of
 * buttons here, which meant that opening a second entity was always a trip back
 * through this screen.
 *
 * Which of them a role may open is decided in one place, entitiesForRole, and
 * the navigation is drawn from it: a moderator is shown eight, the superadmin
 * nine (PDL P21).
 */
export function Entities() {
  const { t } = useI18n()

  return (
    <div className="member">
      <h1>{t('entities.title')}</h1>
      <p className="member__note">{t('entities.intro')}</p>
      <p className="member__note">{t('entities.pickOne')}</p>
    </div>
  )
}
