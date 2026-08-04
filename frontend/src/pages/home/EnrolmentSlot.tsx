import { Link } from 'react-router'
import {
  daysBetween,
  nextPrice,
  nextPriceStart,
  priceOn,
  PROCESSING_FEE_EUR,
  REGISTRATION_OPENS,
  registrationOpen,
  seasonOnOffer,
} from '../../data/pricing'
import { useI18n } from '../../i18n/useI18n'

/* The seasonal slot: what membership costs today and how long that lasts.
 * The price thresholds are the real lever and they were being used only in
 * four reminder emails; here they work every day of the year.
 *
 * The season named is the one on offer, which turns over on 1 October (owner,
 * 30.07.2026). It was a constant, so in the middle of 2027 the slot went on
 * naming 2027 after the price beside it had become next year's.
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
      {/* The processing fee said where the price is said, in the fewest words
          that are still true (PDL P8, 03.08.2026): quoting the euro price alone
          on the front page and the fee three screens later is how somebody
          arrives at the payment expecting one number and finds another. */}
      <p className="slot__fee">{t('home.processingFee', { fee: PROCESSING_FEE_EUR })}</p>
      {/* Only where the next price is higher, which is the only thing worth
          hurrying anybody for. Through the nine months the season is running the
          next price is the early one and is lower, so the slot was announcing a
          rise to 35 EUR for two hundred and seventy-three days of every year.
          What is worth saying then is the other half of the in-season price:
          it buys a profile and the results, and no place in the standing. */}
      {nextPrice(today).eur > price.eur ? (
        <p className="slot__note">
          {t('home.priceRises', {
            price: nextPrice(today).eur,
            count: daysBetween(today, nextPriceStart(today)),
          })}
        </p>
      ) : (
        !price.ranking && <p className="slot__note">{t('home.noRanking')}</p>
      )}
      <Link className="button button--primary card__more" to={`/${locale}/registracija`}>
        {t('home.toRegistration')}
      </Link>
    </section>
  )
}
