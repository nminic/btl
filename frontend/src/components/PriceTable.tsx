import {
  JUNIOR,
  PRICES,
  PROCESSING_FEE_EUR,
  type PriceRow,
} from '../data/pricing'
import { applyChanges } from '../forms/records'
import { money } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { useOverlay } from '../pages/admin/overlay'
import '../pages/member/Member.css'

/**
 * The price list, in one place and drawn where the rulebook says it belongs.
 *
 * The statute puts the amount of the fee with the management board rather than
 * with the rulebook (član 24), so the rulebook names the decision and
 * carries this table under it, rather than a copy typed into the text. Three
 * copies of a price is three chances for one of them to be wrong, and the one a
 * member acts on is whichever they happened to open.
 *
 * The rows come off `data/pricing.ts`, the same constant the member screen and
 * the administration read, with the administrator's changes laid over them. A
 * price typed into administration has to show here too, or the rulebook is the
 * copy that drifts.
 */

/** The junior price is the one row with no period: it holds whenever it is paid,
 *  so it sits in the same table without pretending to have dates. */
const JUNIOR_ROW: PriceRow = { ...JUNIOR, from: '', to: '', ranking: true }

/** mm-dd as a day is read: 10-05 is the fifth of October. */
function day(monthDay: string): string {
  const [month, date] = monthDay.split('-')

  return `${Number(date)}.${Number(month)}.`
}

function period(row: PriceRow, always: string): string {
  return row.from === '' ? always : `${day(row.from)} - ${day(row.to)}`
}

export function PriceTable() {
  const { t, locale } = useI18n()
  const { edits } = useOverlay()

  const rows = [...PRICES, JUNIOR_ROW].map((row) => applyChanges(row, edits[row.key]))

  return (
    <div className="price-table">
      <p className="member__note">{t('pricing.setBy')}</p>

      <div className="table-scroll">
        <table className="table">
          <caption className="visually-hidden">{t('pricing.title')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('pricing.periodName')}</th>
              <th scope="col">{t('pricing.period')}</th>
              <th scope="col">EUR</th>
              <th scope="col">RSD</th>
              <th scope="col">{t('pricing.ranking')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{t(`pricing.rows.${row.key}`)}</td>
                <td>{period(row, t('pricing.everyPayment'))}</td>
                <td>{money(row.eur, locale)}</td>
                <td>{money(row.rsd, locale)}</td>
                <td>{row.ranking ? t('pricing.yes') : t('pricing.no')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="member__note">{t('pricing.fee', { fee: PROCESSING_FEE_EUR })}</p>
      <p className="member__note">{t('pricing.exempt')}</p>
    </div>
  )
}
