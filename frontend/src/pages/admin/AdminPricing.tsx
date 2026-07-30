import { useState } from 'react'
import { JUNIOR, PRICES, type PriceRow } from '../../data/pricing'
import { useI18n } from '../../i18n/useI18n'
import { EntityEditor, OpenRecord } from './EntityEditor'
import { PRICING, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import '../member/Member.css'

/* The price list as it is actually stored: rows with a period of validity.
 *
 * Nothing is added here and nothing is removed (owner, 30.07.2026). The periods
 * are the year itself, four windows that tile it and repeat: the season being
 * sold changes on 1 October, and the same four open again for the year after.
 * A fifth row would have to fall inside one of the four, and a row taken away
 * would leave a stretch of the year with no price at all.
 *
 * What is changed is what a period is called and what it costs, and both through
 * the form: a correction typed by accident into a price is a different kind of
 * mistake from one typed into a city, and a price is a promise to a member.
 */

/** A row carries the words that name its period, so the table has something to
 *  show and the form something to change. */
type PriceListRow = PriceRow & { label: string }

/** The junior price is the one row with no period: twenty euro whenever it is
 *  paid, so it sits in the same list without pretending to have dates. */
const JUNIOR_ROW: PriceRow = { ...JUNIOR, from: '', to: '', ranking: true }

export function AdminPricing() {
  const { t } = useI18n()
  const overlay = useOverlay()
  const [editing, setEditing] = useState<Editing | null>(null)

  if (editing !== null) {
    return (
      <div className="member">
        {/* The name of the screen is in the navigation beside it and in the
            browser tab (owner, 30.07.2026). It stays in the markup so the page
            has a name for anyone who cannot see which entry is marked. */}
        <h1 className="visually-hidden">{t('admin.pricing')}</h1>
        <EntityEditor entity={PRICING} editing={editing} onDone={() => setEditing(null)} />
      </div>
    )
  }

  const base: PriceListRow[] = [...PRICES, JUNIOR_ROW].map((row) => ({
    ...row,
    label: t(`pricing.rows.${row.key}`),
  }))
  const rows = recordsOf(PRICING, base, overlay)

  return (
    <div className="member">
      <h1 className="visually-hidden">{t('admin.pricing')}</h1>

      {/* Said once, at the top, because the absence of a button to add a row is
          not an explanation on its own. */}
      <p className="member__note">{t('admin.pricingFixed')}</p>

      <div className="table-scroll">
        <table className="table">
          <caption className="visually-hidden">{t('admin.pricing')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('admin.field.priceLabel')}</th>
              <th scope="col">{t('admin.period')}</th>
              <th scope="col">EUR</th>
              <th scope="col">RSD</th>
              <th scope="col">{t('admin.ranking')}</th>
              <th scope="col">{t('admin.form.record')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{period(row, t('admin.everyPayment'))}</td>
                <td>{row.eur}</td>
                <td>{row.rsd.toLocaleString('sr-Latn')}</td>
                <td>{row.ranking ? t('admin.yes') : t('admin.no')}</td>
                <td>
                  <OpenRecord
                    name={row.label}
                    onOpen={() => setEditing({ mode: 'one', record: row })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * The window itself, which is a stretch of any year rather than a date.
 *
 * Shown as the two days of the year it runs between, and as words where a row
 * has no window at all: an empty cell reads as a gap in the data, and the junior
 * price genuinely has none.
 */
function period(row: PriceRow, always: string): string {
  return row.from === '' ? always : `${day(row.from)} - ${day(row.to)}`
}

/** mm-dd as a day is read: 10-05 is the fifth of October. */
function day(monthDay: string): string {
  const [month, date] = monthDay.split('-')

  return `${Number(date)}.${Number(month)}.`
}
