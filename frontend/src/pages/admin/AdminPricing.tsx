import { useState } from 'react'
import {
  JUNIOR,
  PRICES,
  PROCESSING_FEE_EUR,
  REFERRAL,
  REFERRAL_ROW,
  type PriceRow,
} from '../../data/pricing'
import { money } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useToday } from '../../clock/useClock'
import { referralMayBeSet } from '../../data/season'
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

/* And the referral, which is a number an administrator sets on this screen
   (owner, 12.08.2026) and not a price of membership at all: nobody pays it, it
   is credited. So it is a section of its own under the table rather than a sixth
   row in it, where two of the five columns would have had nothing to say: a
   credit has no window in the year and no bearing on the right to be ranked, and
   „Da" written under „Pravo rangiranja" would have been an answer to a question
   nobody asked.

   It goes through the same form as every price, which asks for a name, euro and
   dinars and nothing else, so the two fit the one form exactly. Its shape is in
   `data/pricing.ts`, with the amount, because the member's screen reads the same
   row (member/Membership.tsx). */

export function AdminPricing() {
  const { locale, t } = useI18n()
  const overlay = useOverlay()
  /* The day the portal is being read as, from the one clock it all reads
     (src/clock). One thing on this screen depends on it: whether the amount a
     referral brings may still be set for the season about to be renewed. */
  const today = useToday()
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

  const base: PriceListRow[] = [...PRICES, JUNIOR_ROW, REFERRAL_ROW].map((row) => ({
    ...row,
    label: t(`pricing.rows.${row.key}`),
  }))
  /* One pass over the overlay for both, so an edit typed into either is read
     back the same way. Split after it, not before. */
  const all = recordsOf(PRICING, base, overlay)
  const rows = all.filter((row) => row.key !== REFERRAL.key)
  /* A list of one rather than one row, because a row found is a row that might
     not be, and neither `!` nor `as` is written on this portal. Walked as a
     list, the case where it is missing is the empty list and needs no guard at
     all. */
  const referral = all.filter((row) => row.key === REFERRAL.key)
  /* Whether the amount one referral brings may still be set for the season that
     is about to be renewed. One place decides it, beside the rest of the year's
     dates (data/season.ts), because the moment is the same one the renewal window
     opens on and a second copy of a date is a date that drifts. */
  const maySet = referralMayBeSet(today)

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
                <td>{money(row.eur, locale)}</td>
                <td>{money(row.rsd, locale)}</td>
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

      {referral.map((row) => (
        <section className="member__panel" aria-labelledby="pricing-referral" key={row.key}>
          <h2 className="profile__section" id="pricing-referral">
            {t('admin.referral')}
          </h2>
          <p className="member__note">{t('admin.referralNote')}</p>

          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">{t('admin.referral')}</caption>
              <thead>
                <tr>
                  {/* „Naziv" and not „Naziv perioda", which is what the price
                      table above says: this row has no period, and a column
                      named after one is a column that answers a question the row
                      cannot. The form both open says the same, since it is one
                      form for both. */}
                  <th scope="col">{t('admin.field.rowLabel')}</th>
                  <th scope="col">{'EUR'}</th>
                  <th scope="col">{'RSD'}</th>
                  <th scope="col">{t('admin.form.record')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{row.label}</td>
                  <td>{money(row.eur, locale)}</td>
                  <td>{money(row.rsd, locale)}</td>
                  <td>
                    {/* Told off rather than switched off, as everywhere else on
                        the portal: `disabled` takes the control out of the tab
                        order and takes the reason it stands for with it. */}
                    <OpenRecord
                      name={row.label}
                      settled={!maySet}
                      onOpen={() => setEditing({ mode: 'one', record: row })}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Why it will not open, and until when it would have. Said once, under
              the table, rather than inside the cell, because it is a fact about
              the amount and not about the button (owner, 16.08.2026: „podešava do
              1.10. u 00 po CET za predstojeću godinu"). */}
          {!maySet && (
            <p id="referral-settled" className="rate__hint" role="status">
              {t('admin.referralSettled')}
            </p>
          )}
        </section>
      ))}

      {/* What arrives on the statement is the fee plus the fee for processing
          it, where the money comes from abroad (PDL P8, 03.08.2026). Whoever
          records a payment has to be able to tell three euro of processing from
          three euro of overpayment, and the table above quotes membership
          alone. */}
      <p className="member__note">{t('admin.processingFee', { fee: PROCESSING_FEE_EUR })}</p>
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
