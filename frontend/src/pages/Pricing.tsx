import { Link } from 'react-router'
import { useToday } from '../clock/useClock'
import {
  JUNIOR,
  PRICES,
  PROCESSING_FEE_EUR,
  REGISTRATION_OPENS,
  daysBetween,
  priceOn,
  registrationOpen,
  seasonOnOffer,
} from '../data/pricing'
import { formatDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Pricing.css'

/* The rows come from the data layer, which is where the price lives (ADL A12).
 * This screen kept a second copy of them, five rows written out again beside the
 * four that everything else reads: a price changed in one place and not the
 * other is the one kind of mistake nothing here would have caught, on the screen
 * whose whole job is to state what membership costs.
 */
const ROWS = [...PRICES, { ...JUNIOR, ranking: true }]

export function Pricing() {
  const { locale, t } = useI18n()
  const today = useToday()
  /* Which row is the one a reader is actually being asked to pay. The number was
     already worked out for the front page and for the renewal screen; this
     screen, whose whole job is to say what membership costs, left the reader to
     find their own row among five. */
  const now = priceOn(today)

  return (
    <div className="pricing">
      <h1>{t('pricing.title')}</h1>
      <p className="pricing__lead">{t('pricing.lead', { season: seasonOnOffer(today) })}</p>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t('pricing.period')}</th>
              <th scope="col">{t('pricing.priceEur')}</th>
              <th scope="col">{t('pricing.priceRsd')}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className={row.key === now.key ? 'pricing__now' : undefined}>
                <td>
                  {t(`pricing.rows.${row.key}`)}
                  {row.key === now.key && (
                    <span className="pricing__badge">{t('pricing.today')}</span>
                  )}
                </td>
                <td>
                  {row.eur} EUR
                  {!row.ranking && (
                    <span className="pricing__note"> ({t('pricing.noRanking')})</span>
                  )}
                </td>
                <td>{`${row.rsd.toLocaleString('sr-Latn')} RSD`}</td>
              </tr>
            ))}
            {/* The fee has a row of its own, because the owner asked that it be
                something anybody can look up rather than something only the
                member who pays it is told (04.08.2026). It is not a price band,
                so it stands apart from the four: it buys nothing, and a member
                paying in dinars does not pay it. */}
            <tr className="pricing__fee">
              {/* A row heading, not a period: read down the first column this
                  row is not one of the four bands, and a screen reader
                  announcing it under "Period uplate" would say it is. */}
              <th scope="row">{t('pricing.feeRow')}</th>
              <td>{PROCESSING_FEE_EUR} EUR</td>
              <td>{t('pricing.feeNone')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PDL P28a put this page second under "O ligi" because it is "strana koja
          vodi ka učlanjenju", and until now it led nowhere at all. */}
      <p className="pricing__join">
        {registrationOpen(today) ? (
          <Link className="button button--primary" to={`/${locale}/registracija`}>
            {t('shell.join')}
          </Link>
        ) : (
          /* One sentence out of the dictionary, not two glued together in the
             code. The two of them read "Otvara se 1. oktobar 2026.. Otvara se za
             62 dana.", with the date already carrying its own full stop and the
             opening announced twice. Where a sentence breaks is the
             dictionary's business, not this screen's. */
          t('registration.opensIn', {
            date: formatDate(REGISTRATION_OPENS, locale),
            count: daysBetween(today, REGISTRATION_OPENS),
          })
        )}
      </p>

      <div className="pricing__notes">
        <p>{t('pricing.cycle')}</p>
        <p>{t('pricing.rsdNote')}</p>
        {/* Beside the table rather than inside a price (PDL P8, 03.08.2026):
            what the intermediary takes is not membership, and a member who pays
            it has bought exactly what a member paying in dinars bought. */}
        <p>{t('pricing.feeNote')}</p>
        {/* One September, in 2026, and not a rule of the list. Printed
            for ever it told a reader every autumn that registration was
            shut, which from 2027 it is not. */}
        {!registrationOpen(today) && <p>{t('pricing.previewNote')}</p>}
        <p>{t('pricing.noRefund')}</p>
        <p>{t('pricing.reminders')}</p>
      </div>
    </div>
  )
}
