import { Link } from 'react-router'
import { daysBetween, registrationOpen, SEASON, SEASON_STARTS } from '../../data/pricing'
import { useI18n } from '../../i18n/useI18n'

/* One sentence about what BTL is, the countdown while the season has not
 * started, and the two things a visitor came to do. The long introductory
 * paragraph with a signature and a phone number that used to sit here belongs
 * on the page about the league, not in the way. */
export function Hero({ today }: { today: string }) {
  const { locale, t } = useI18n()
  const days = daysBetween(today, SEASON_STARTS)

  return (
    <section className="hero">
      <h1 className="hero__title">{t('app.name')}</h1>
      <p className="hero__lead">{t('home.lead')}</p>

      {days > 0 && (
        <p className="hero__countdown">
          <strong>{t('units.dayCount', { count: days })}</strong>{' '}
          {t('home.untilSeason', { season: SEASON })}
        </p>
      )}

      <div className="hero__actions">
        <Link className="button button--primary" to={`/${locale}/kalendar`}>
          {t('home.toCalendar')}
        </Link>
        {registrationOpen(today) ? (
          <Link className="button button--secondary" to={`/${locale}/registracija`}>
            {t('home.toRegistration')}
          </Link>
        ) : (
          <Link className="button button--secondary" to={`/${locale}/clanarina`}>
            {t('home.toPricing')}
          </Link>
        )}
      </div>
    </section>
  )
}
