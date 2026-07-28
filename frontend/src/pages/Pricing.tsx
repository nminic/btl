import { useI18n } from '../i18n/useI18n'
import './Pricing.css'

/* The price list is a table of rows with a period of validity, not a constant
 * in the code (ADL A12). It is spelled out here because the screen exists
 * before the backend does; it moves to the data layer with the rest. */
const PRICES = [
  { key: 'preview', eur: null, rsd: null },
  { key: 'regular', eur: 40, rsd: 4800 },
  { key: 'late', eur: 50, rsd: 6000 },
  { key: 'season', eur: 40, rsd: 4800, noRanking: true },
  { key: 'junior', eur: 20, rsd: 2400 },
]

export function Pricing() {
  const { t } = useI18n()

  return (
    <div className="pricing">
      <h1>{t('pricing.title')}</h1>
      <p className="pricing__lead">{t('pricing.lead')}</p>

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
            {PRICES.map((row) => (
              <tr key={row.key}>
                <td>{t(`pricing.rows.${row.key}`)}</td>
                <td>
                  {row.eur === null ? (
                    t('pricing.notSold')
                  ) : (
                    <>
                      {row.eur} EUR
                      {row.noRanking === true && (
                        <span className="pricing__note"> ({t('pricing.noRanking')})</span>
                      )}
                    </>
                  )}
                </td>
                <td>{row.rsd === null ? '' : `${row.rsd.toLocaleString('sr-Latn')} RSD`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pricing__notes">
        <p>{t('pricing.rsdNote')}</p>
        <p>{t('pricing.previewNote')}</p>
        <p>{t('pricing.noRefund')}</p>
        <p>{t('pricing.reminders')}</p>
      </div>
    </div>
  )
}
