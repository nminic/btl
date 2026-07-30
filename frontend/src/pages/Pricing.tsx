import { useToday } from '../clock/useClock'
import { JUNIOR, PRICES, seasonOnOffer } from '../data/pricing'
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
  const { t } = useI18n()
  const today = useToday()

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
              <tr key={row.key}>
                <td>{t(`pricing.rows.${row.key}`)}</td>
                <td>
                  {row.eur} EUR
                  {!row.ranking && (
                    <span className="pricing__note"> ({t('pricing.noRanking')})</span>
                  )}
                </td>
                <td>{`${row.rsd.toLocaleString('sr-Latn')} RSD`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pricing__notes">
        <p>{t('pricing.cycle')}</p>
        <p>{t('pricing.rsdNote')}</p>
        <p>{t('pricing.previewNote')}</p>
        <p>{t('pricing.noRefund')}</p>
        <p>{t('pricing.reminders')}</p>
      </div>
    </div>
  )
}
