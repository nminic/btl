import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import {
  A_FEE,
  A_LEVEL,
  A_PERIOD,
  A_REFERRAL,
  ofKind,
  pricedInBoth,
  ranksByPeriod,
  windowOf,
} from '../../data/priceList'
import { usePricing } from '../../data/useResource'
import type { FormValues } from '../../forms/types'
import { money } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useToday } from '../../clock/useClock'
import { referralMayBeSet, seasonRunning } from '../../data/season'
import { seasonBeingRenewed } from '../../data/pricing'
import { recordKey } from '../../session/context'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { EntityEditor, OpenRecord, type Saving } from './EntityEditor'
import { PRICING, recordsOf, type Overlay } from './entityForms'
import { WHEN_WRITING_A_PRICE, amountsFrom } from './priceWrites'
import '../member/Member.css'

/* The price list as it is actually stored: rows with a period of validity.
 *
 * Nothing is added here and nothing is removed (owner, 30.07.2026). The periods
 * are the year itself, four windows that tile it and repeat: the season being
 * sold changes on 1 October, and the same four open again for the year after.
 * A fifth row would have to fall inside one of the four, and a row taken away
 * would leave a stretch of the year with no price at all.
 *
 * What is changed is what a period costs, and through the form: a correction typed
 * by accident into a price is a different kind of mistake from one typed into a
 * city, and a price is a promise to a member.
 */

/** An overlay holding nothing, which is what this screen starts every visit with. */
const NOTHING_YET: Overlay = { edits: {}, creations: {}, deletions: {} }

/* And the referral, which is a number an administrator sets on this screen
   (owner, 12.08.2026) and not a price of membership at all: nobody pays it, it
   is credited. So it is a section of its own under the table rather than a sixth
   row in it, where two of the five columns would have had nothing to say: a
   credit has no window in the year and no bearing on the right to be ranked, and
   „Da" written under „Pravo rangiranja" would have been an answer to a question
   nobody asked.

   It goes through the same form as every price, which asks for a name, euro and
   dinars and nothing else, so the two fit the one form exactly. */

/**
 * THIS SCREEN READS AND WRITES THE SERVER, SINCE 26.09.2026, AND UNTIL THAT DAY IT DID
 * NEITHER.
 *
 * <p><b>What that cost, measured rather than argued.</b> `/api/pricing` has answered
 * `price_row` since the codebooks went in and `PUT /api/pricing/{key}` has been able to
 * change a row since PR 370, while this screen edited a copy held in the browser: a price
 * the owner changed lived exactly as long as the visit, and `grep -rn "api/pricing"
 * frontend/src` came back empty. PDL P28c point 2, owner 24.09.2026: „Svi ekrani
 * administracije prestaju da pisu u sesijski sloj i pocinju da zovu rute", with his reason -
 * „bez toga nijedan entitet unet kroz portal stvarno ne postoji".
 *
 * <p><b>And the half that decides whether the route may be released at all.</b>
 * `PricingWriteApi` named it in its own heading: an amount has four homes, this route can
 * reach one of them, „so until a screen reads `GET /api/pricing` instead of the bundled
 * constant, an administrator who raises a price here raises what the next member is CHARGED
 * while the page he reads and the code he scans still say the old number." All three screens
 * that quote a price read the route in this increment - this one, the public table under
 * Član 14 (`components/PriceTable.tsx`) and „Moja članarina" (`pages/member/Membership.tsx`,
 * which fills in the IPS QR code) - so the gap closes at RUN TIME and not only in the source.
 *
 * <p><b>WHAT THIS SCREEN COULD NOT DO UNTIL V34, AND BOTH WERE THE SAME MISSING COLUMN.</b>
 * The processing fee had no button and a row whose key this build had no word for was drawn
 * under its key, because the name of a row was not yet a field anywhere this screen could
 * reach: the six a reader saw stood only in `i18n/sr.json`, under `pricing.rows.*`, and the
 * fee had none at all. `price_row.label` closes both at once (PDL P12b, owner 25.09.2026):
 * every row draws its own name now, the fee's own button among them, with its dinar price
 * left optional rather than refused (PDL P12b, 2).
 *
 * <p><b>BOUNDARY, named rather than left to be found:</b> `pricing.rows.*` still stands in
 * `i18n/sr.json`, with no reader left in the portal's own code. It is not deleted here
 * because PR 375 (the English dictionary) carries its own `pricing.rows` block, and deleting
 * now would collide with it over the same keys. Both dictionaries and the guard over them in
 * `i18n/keys.test.ts:170` are cleaned up together once 375 is merged, and not before.
 */
export function AdminPricing() {
  const { locale, t } = useI18n()
  /* The day the portal is being read as, from the one clock it all reads
     (src/clock). One thing on this screen depends on it: whether the amount a
     referral brings may still be set for the season about to be renewed. */
  const today = useToday()
  /** The row being changed, and never „a new one": see {@link saveOne}. */
  const [editing, setEditing] = useState<{ record: Record<string, unknown> } | null>(null)
  const state = usePricing()

  /**
   * WHAT THIS VISIT HAS WRITTEN, ON TOP OF WHAT THE SERVER ANSWERED WITH.
   *
   * <p>The same three-part overlay the session keeps, over a different store, and merged by
   * the same `recordsOf` - the arrangement `admin/AdminLeagues.tsx` settled on 25.09.2026
   * and the reason it gives: writing a second merge here would be a second answer to „what
   * does this list show".
   *
   * <p><b>Two of the three can never hold anything here, and that is the entity rather
   * than an oversight.</b> `PRICING` is `fixed`: „Periodi su stalni: redovi se ne dodaju i
   * ne brisu" (owner, 30.07.2026), and `PricingWriteApi` has no `POST` and no `DELETE` to
   * call. So only `edits` is ever written, and it is written only inside the branch that ran
   * because an answer said the write went through.
   *
   * <p><b>Why anything is held at all, when the server now knows.</b> A screen that is
   * still mounted never asks its resource again - `useResource`'s effect runs once, on the
   * name, which does not change while this stands - so there is nothing here to re-read the
   * moment a write comes back.
   */
  const [written, setWritten] = useState<Overlay>(NOTHING_YET)

  /** What just happened, for whoever is not watching the table. */
  const [said, setSaid] = useState('')

  /**
   * CHANGING ONE ROW'S TWO AMOUNTS, AND THE REASON A REFUSAL GIVES IS THE ROUTE'S.
   *
   * <p><b>`PUT` and nothing else, addressed by the KEY.</b> `GET /api/pricing` answers no
   * `id` at all - a price row has one and no reader has ever needed it - and this screen
   * keeps its rows under the key already (`entityForms.ts`, `idField: 'key'`). So there is
   * no identity to read off the answer, which is where this parts from
   * `AdminLeagues.saveOne`.
   *
   * <p><b>Nothing of the answer is read.</b> `PricingWriteApi` answers 200 with the row as
   * `numeric(10,2)` now holds it, and what goes into the table is what was typed, which this
   * screen already holds. Reading the record back would make this a second home for the
   * amount; what the column really kept is the next mount's business, and the next mount
   * asks the server because the cache is cleared below.
   *
   * <p><b>The key is handed in and is never worked out here, which is a consequence of what
   * this screen can do rather than a style.</b> `Editing` is a union - a record being changed
   * or a new one - and nothing on this screen can open the second: „Periodi su stalni: redovi
   * se ne dodaju i ne brisu" (owner, 30.07.2026), so `EntityBar` is not drawn and
   * `PricingWriteApi` has no `POST` to call. Asked to read the key out of that union, this
   * function needed two branches for states no press can reach, and a branch nothing reaches
   * is what the 100 per cent threshold exists to find. The state this screen keeps is
   * therefore the narrow one, and the key is read where the row is known.
   */
  async function saveOne(
    key: string,
    values: FormValues,
    text: Record<string, string>,
  ): Promise<Saving> {
    const answer = await askTheServer(`/api/pricing/${key}`, amountsFrom(values), 'PUT')

    if (answer.got !== 'done') {
      return { said: saying(answer) }
    }

    /* THE NEXT MOUNT READS THE SERVER AND NOT THIS VISIT'S FIRST ANSWER. The fault this
       closes was measured on the competitions a day earlier: the overlay above does not
       survive the router unmounting this screen, while `data/client.ts` caches the served
       list for the whole visit, so a price changed here was gone the moment a reader walked
       away and came back - and the PUBLIC table, which reads the same cache entry, would
       have gone on showing the old amount for the rest of the visit even though the write
       had reached the database. */
    clearResourceCache('pricing')
    setSaid(t('admin.priceSaved'))
    setWritten((was) => ({
      ...was,
      edits: { ...was.edits, [recordKey(PRICING.id, key)]: text },
    }))

    return { written: key }
  }

  /** The words for an answer that was not „it was done". */
  function saying(answer: Exclude<Answer, { got: 'done' }>) {
    return <ServerSaid answer={answer} refusals={WHEN_WRITING_A_PRICE} />
  }

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.pricing')}</h1>

      <Resource state={state}>
        {(served) => {
          if (editing !== null) {
            return (
              <EntityEditor
                entity={PRICING}
                editing={{ mode: 'one', record: editing.record }}
                /* The key read where the row is in hand, so `saveOne` has no state to
                   guess at. */
                save={(values, text) =>
                  saveOne(String(editing.record[PRICING.idField]), values, text)
                }
                onDone={() => setEditing(null)}
              />
            )
          }

          /* THE LABEL COMES OFF THE ANSWER NOW, SINCE V34, and no longer off the dictionary:
             `label` is a field of `Price` itself, so every row already carries it and there
             is nothing left here to add before the tables draw it - it used to be built by
             looking the key up in `pricing.rows.*`. */
          /* ONE PASS OVER THE OVERLAY FOR ALL SEVEN, BEFORE `pricedInBoth` SPLITS THEM BY
             WHETHER THERE IS A DINAR SIDE, so an edit typed into any of them is read back
             the same way. **This order is now load-bearing and not merely tidy**: the fee
             has no dinar side (`price_row_only_fee_has_no_rsd`) and `pricedInBoth` drops
             exactly that row, so merging it after the split would mean nothing typed into
             the fee's own button ever reached the overlay at all. */
          const all = recordsOf(PRICING, served, written)
          const bothCurrencies = pricedInBoth(all)
          /* By KIND and no longer by key (`data/priceList.ts`). Held as four separate
             constants, the portal could not draw a row it had no constant for, so the
             eighth row somebody adds arrives on no screen at all. */
          const rows = bothCurrencies.filter((row) => row.kind === A_PERIOD || row.kind === A_LEVEL)
          const referral = ofKind(bothCurrencies, A_REFERRAL)
          /* THE ONE ROW `pricedInBoth` DROPS, so it is read off the merge directly and
             never off `bothCurrencies`. Walked as a list of none or one, so an answer
             carrying no fee draws no fee section, the same idiom the referral above uses. */
          const fee = ofKind(all, A_FEE)
          /* Whether the amount one referral brings may still be set for the season that
             is about to be renewed. One place decides it, beside the rest of the year's
             dates (data/season.ts), because the moment is the same one the renewal window
             opens on and a second copy of a date is a date that drifts.

             **This is the screen being helpful and NOT the rule being enforced**, which is
             the division ADL A8 sets and PDL P12c restated for the ceiling: the route
             refuses a referral written after 1 October whatever this says, and the sentence
             a reader then sees is the route's answer (`WHEN_WRITING_A_PRICE`). */
          const maySet = referralMayBeSet(today)
          /* The season that is running today, where one is. Before the first season of the
             league there is none, and „the amount for the season now running changes too"
             is then a warning about nothing. */
          const running = seasonRunning(today)

          return (
            <>
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
                        <td>{windowOf(row) ?? t('admin.everyPayment')}</td>
                        <td>{money(row.eur, locale)}</td>
                        <td>{money(row.rsd, locale)}</td>
                        <td>
                          {ranksByPeriod(row) ? t('admin.rankingByPeriod') : null}
                          {ranksByPeriod(row) ? null : row.ranking ? t('admin.yes') : t('admin.no')}
                        </td>
                        <td>
                          <OpenRecord
                            name={row.label}
                            onOpen={() => setEditing({ record: row })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {referral.map((row) => (
                <section
                  className="member__panel"
                  aria-labelledby="pricing-referral"
                  key={row.key}
                >
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
                              describedBy="referral-season"
                              onOpen={() => setEditing({ record: row })}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Which season the amount belongs to, either way. Said once, under the
                      table, rather than inside the cell, because it is a fact about the
                      amount and not about the button (owner, 16.08.2026: „podešava do
                      1.10. u 00 po CET za predstojeću godinu").
                    *
                      Open, it says what saving does, and that is not only „sets the
                      coming season": the portal keeps one amount and no history, so the
                      same save also moves the amount that is standing right now. The rule
                      cannot be enforced against that until an amount can be held per
                      season, which the owner accepted on 25.09.2026 as its own later
                      increment (PDL P12b point 3, „zapisano kao imenovana granica").
                      Until then the admin is told, because a screen that shuts up about it
                      lets the rule be broken by somebody who believes they are keeping
                      it.
                    *
                      The second half of that, „and the season now running had its own
                      amount settled by its own 1 October", is said only where a season is
                      actually running. Written unconditionally it was false for the whole
                      of 2026: the first season of the league is 2027 (data/season.ts), so
                      on 30 September 2026 there was no running season to disturb, and a
                      review measured the screen saying there was. */}
                  <p id="referral-season" className="rate__hint">
                    {maySet
                      ? t('admin.referralOpen', { season: seasonBeingRenewed(today) })
                      : t('admin.referralSettled', { season: seasonBeingRenewed(today) })}
                    {maySet &&
                      running !== null &&
                      ` ${t('admin.referralRunning', { season: running })}`}
                  </p>
                </section>
              ))}

              {/* THE FEE'S OWN BUTTON, SINCE V34 AND PDL P12b, 2 (owner, 25.09.2026): „Taksa
                  dobija svoje dugme, sa dinarskom cenom kao neobaveznom." Until the column
                  existed the fee had no name a screen could put on a button at all, so it
                  drew as a note alone; the name and the button arrive together, the same
                  wave `b102-ime-reda-cenovnika` was written for.

                  What arrives on the statement is the fee plus the fee for processing it,
                  where the money comes from abroad (PDL P8, 03.08.2026). Whoever records a
                  payment has to be able to tell three euro of processing from three euro of
                  overpayment, and the table above quotes membership alone.

                  Walked as a list of none or one, so an answer that carries no fee draws no
                  section about one, the same idiom the referral above uses. */}
              {fee.map((row) => (
                <section
                  className="member__panel"
                  aria-labelledby="pricing-fee"
                  key={row.key}
                >
                  <h2 className="profile__section" id="pricing-fee">
                    {t('admin.processingFeeHeading')}
                  </h2>
                  <p className="member__note">{t('admin.processingFee')}</p>

                  <div className="table-scroll">
                    <table className="table">
                      <caption className="visually-hidden">
                        {t('admin.processingFeeHeading')}
                      </caption>
                      <thead>
                        <tr>
                          {/* No RSD column: the fee is the one row with no dinar side
                              (`price_row_only_fee_has_no_rsd`), because there is no
                              payment intermediary there to pay (PDL, owner 04.08.2026). A
                              column it can never answer is a column that reads as data
                              gone missing rather than a price that does not exist, the
                              same reason the public table leaves this row out of its own
                              two-currency table entirely (`components/PriceTable.tsx`). */}
                          <th scope="col">{t('admin.field.rowLabel')}</th>
                          <th scope="col">EUR</th>
                          <th scope="col">{t('admin.form.record')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{row.label}</td>
                          <td>{money(row.eur, locale)}</td>
                          <td>
                            <OpenRecord
                              name={row.label}
                              onOpen={() => setEditing({ record: row })}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}

              {/* Said once and politely: the table beside it has already changed, and a
                  reader who is not looking at it gets the one sentence that says so. The
                  same shape the competitions use. */}
              <p aria-live="polite" className="visually-hidden">
                {said}
              </p>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
