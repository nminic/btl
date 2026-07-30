import { Link } from 'react-router'
import {
  daysBetween,
  nextPrice,
  nextPriceStart,
  priceOn,
  REGISTRATION_OPENS,
  registrationOpen,
  seasonOnOffer,
} from '../../data/pricing'
import { useI18n } from '../../i18n/useI18n'

/* The seasonal slot: what membership costs today and how long that lasts.
 * The price thresholds are the real lever and they were being used only in
 * three reminder emails; here they work every day of the year.
 *
 * The season named is the one on sale, which turns over on 1 October (owner,
 * 30.07.2026). Before that date the slot would have gone on offering 2027 in
 * the middle of 2027, which is a season nobody can still join.
 */
export function EnrolmentSlot({ today }: { today: string }) {
  const { locale, t } = useI18n()
  const season = seasonOnOffer(today)

  if (!registrationOpen(today)) {
    return (
      <section className="card card--slot" aria-labelledby="slot-heading">
        <h2 className="card__title" id="slot-heading">
          {t('home.enrolment', { season })}
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

  const price = priceOn(today)

  return (
    <section className="card card--slot" aria-labelledby="slot-heading">
      <h2 className="card__title" id="slot-heading">
        {t('home.enrolment', { season })}
      </h2>
      <p className="slot__price">
        <strong>{price.eur} EUR</strong>
        <span className="slot__rsd">{price.rsd.toLocaleString('sr-Latn')} RSD</span>
      </p>
      {/* Always something: the four periods repeat, so there is always a next
          one and always a day it starts. */}
      <p className="slot__note">
        {t('home.priceRises', {
          price: nextPrice(today).eur,
          count: daysBetween(today, nextPriceStart(today)),
        })}
      </p>
      <Link className="button button--primary card__more" to={`/${locale}/registracija`}>
        {t('home.toRegistration')}
      </Link>
    </section>
  )
}
