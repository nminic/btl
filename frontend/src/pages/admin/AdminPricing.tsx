import { useState } from 'react'
import { JUNIOR, PRICES, type PriceRow } from '../../data/pricing'
import { useI18n } from '../../i18n/useI18n'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { PRICING, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import '../member/Member.css'

/* The price list as it is actually stored: rows with a period of validity.
 *
 * A price is a promise to a member and nothing here changes in the row, because
 * a correction typed by accident into a price is a different kind of mistake
 * from one typed into a city. It is changed through the form, because the list
 * has to be written down before a season starts and the owner asked for every
 * entity to be enterable and changeable (PDL P8).
 */

/** A row carries the words that name its period, so a row somebody adds is not
 *  nameless. The five that come with the portal take theirs from the dictionary. */
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
        {/* The name of the screen is in the navigation beside it and in the browser
            tab. Here it was a heading and a sentence or two above the work, and the
            moderator arrives having just read the name in the list he came from
            (owner, 30.07.2026). It stays in the markup so the page has a name for
            anyone who cannot see which entry is marked. */}
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

      <EntityBar entity={PRICING} onNew={() => setEditing({ mode: 'new' })} />

      <div className="table-scroll">
        <table className="table">
          <caption className="visually-hidden">{t('admin.pricing')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('pricing.period')}</th>
              <th scope="col">{t('admin.from')}</th>
              <th scope="col">{t('admin.to')}</th>
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
                <td>{day(row.from)}</td>
                <td>{day(row.to)}</td>
                <td>{row.eur}</td>
                <td>{row.rsd.toLocaleString('sr-Latn')}</td>
                <td>{row.ranking ? t('admin.yes') : t('admin.no')}</td>
                <td>
                  <RowActions
                    entity={PRICING}
                    record={row}
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

/** A dash where a row has no period, so an empty cell is never read as a gap in
 *  the data. */
function day(iso: string): string {
  return iso === '' ? '-' : iso
}
