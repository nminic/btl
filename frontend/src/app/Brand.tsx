import { Link } from 'react-router'
import { useI18n } from '../i18n/useI18n'

/* The mark, the full name, and the slogan under it (PDL P28a). The name is
 * spelled out rather than shortened to BTL: a visitor who lands here from a
 * shared link should not have to work out what the three letters mean.
 *
 * It closed the folded navigation of a telephone on the way home until 16.11.2026; there is no folded
 * navigation since, because the row of symbols stands on the screen (`app/Shell.tsx`). */
export function Brand() {
  const { locale, t } = useI18n()

  return (
    <Link to={`/${locale}`} className="brand" aria-label={t('shell.home')}>
      <img className="brand__mark" src="/icon-192.png" alt="" aria-hidden="true" width={56} height={56} />
      <span className="brand__words">
        <span className="brand__name">{t('app.name')}</span>
        <span className="brand__slogan">{t('app.slogan')}</span>
      </span>
    </Link>
  )
}
