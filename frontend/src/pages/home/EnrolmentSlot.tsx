import { Link } from 'react-router'
import {
  daysBetween,
  priceAfter,
  priceOn,
  REGISTRATION_OPENS,
  SEASON,
  registrationOpen,
} from '../../data/pricing'
import { useI18n } from '../../i18n/useI18n'

/* The seasonal slot: what membership costs today and how long that lasts.
 * The price thresholds are the real lever and they were being used only in
 * three reminder emails; here they work every day of the year. */
export function EnrolmentSlot({ today }: { today: string }) {
  const { locale, t } = useI18n()
  const price = priceOn(today)

  if (!registrationOpen(today) || price === null) {
    return (
      <section className="card card--slot" aria-labelledby="slot-heading">
        <h2 className="card__title" id="slot-heading">
          {t('home.enrolment', { season: SEASON })}
        </h2>
        <p className="slot__price">{t('registration.closed')}</p>
        <p className="slot__note">
          {t('home.opensIn', { count: daysBetween(today, REGISTRATION_OPENS) })}
        </p>
        <Link className="card__more" to={`/${locale}/clanarina`}>
          {t('home.toPricing')}
        </Link>
      </section>
    )
  }

  const next = priceAfter(price)
  const daysLeft = daysBetween(today, price.to) + 1

  return (
    <section className="card card--slot" aria-labelledby="slot-heading">
      <h2 className="card__title" id="slot-heading">
        {t('home.enrolment', { season: SEASON })}
      </h2>
      <p className="slot__price">
        <strong>{price.eur} EUR</strong>
        <span className="slot__rsd">{price.rsd.toLocaleString('sr-Latn')} RSD</span>
      </p>
      {next !== null && (
        <p className="slot__note">
          {t('home.priceRises', { price: next.eur, count: daysLeft })}
        </p>
      )}
      <Link className="button button--primary card__more" to={`/${locale}/registracija`}>
        {t('home.toRegistration')}
      </Link>
    </section>
  )
}
