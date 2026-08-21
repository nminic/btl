import { JUNIOR_ROW, PRICES, type PriceRow, ranksByPeriod } from '../data/pricing'
import { applyChanges } from '../forms/records'
import { money } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { useOverlay } from '../pages/admin/overlay'
/* The sheets this table's own classes come from, and both are needed. `table`
   and `table-scroll` are the shared ones; `markdown__table` is what dresses a
   table as part of a document rather than as a standing, and it lives in
   `Markdown.css`, which pulls the shared sheet in itself.
 *
   It used to arrive by way of `member/Member.css`, for the notes that stood
   around the table until 21.08.2026. With those gone that import was wrong, and
   naming only the shared sheet was wrong the other way: a screen that drew this
   table without any prose on it would have got a table dressed as a standing,
   capitals that do not wrap, on a page where the rulebook says they should. A
   component that names a class asks for the sheet that defines it rather than
   hoping a neighbour on the same screen imported it. */
import './Markdown.css'

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
 *
 * The figures and nothing else. Three notes stood around this table until
 * 21.08.2026, saying who sets the fee, what a payment from abroad costs to
 * process, and that the board may free a member of the fee. All three were
 * sentences the rulebook already carries, and while the table stood at the foot
 * of the whole section they read as a summary of it. Since the owner moved the
 * table up under Član 14 they stand a line away from the prose they copy: the
 * first was word for word the sentence above it. The words are the article's,
 * the figures are this table's, and neither says the other's part.
 */

/**
 * What the ranking column says for a band.
 *
 * The row that has no answer of its own points at the periods above it; see
 * `ranksByPeriod` in `data/pricing.ts`, which both this table and the administrator's
 * read, so the page that publishes a price and the screen that sets it cannot say
 * different things about it.
 */
function ranks(row: PriceRow, say: (key: string) => string): string {
  if (ranksByPeriod(row)) {
    return say('pricing.rankingByPeriod')
  }

  return row.ranking ? say('pricing.yes') : say('pricing.no')
}

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
    <div className="table-scroll">
      <table className="table markdown__table">
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
              <td>{ranks(row, t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
