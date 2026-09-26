import { Resource } from './Resource'
import { A_LEVEL, A_PERIOD, pricedInBoth, ranksByPeriod, windowOf } from '../data/priceList'
import type { Price } from '../data/types'
import { usePricing } from '../data/useResource'
import { money } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
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
 * **THE ROWS COME OFF `GET /api/pricing` SINCE 26.09.2026, AND UNTIL THAT DAY THEY CAME
 * OFF A CONSTANT COMPILED INTO THE BUNDLE.** `data/pricing.ts` was the home, with the
 * administrator's changes laid over it out of the session - which never reached a server,
 * so „the administrator's changes" lasted exactly as long as one visit in one browser. What
 * that cost once the route existed is the boundary `PricingWriteApi` names in its own
 * heading: an administrator raised a price, the next member was CHARGED the new one, and
 * this table - the one the rulebook publishes - went on showing the old. Read from the
 * route, the page under Član 14 says what the association really decided.
 *
 * The figures and nothing else. Three notes stood around this table until
 * 21.08.2026, saying who sets the fee, what a payment from abroad costs to
 * process, and that the board may free a member of the fee. All three were
 * sentences the rulebook already carries, and while the table stood at the foot
 * of the whole section they read as a summary of it. Since the owner moved the
 * table up under Član 14 they stand a line away from the prose they copy: the
 * first was word for word the sentence above it. The words are the article's,
 * the figures are this table's, and neither says the other's part.
 *
 * **THE FIRST COLUMN READS `row.label` SINCE V34 (26.09.2026), AND UNTIL THAT DAY IT READ
 * `pricing.rows.*` OUT OF THE BUNDLE.** The name of a row is a column an administrator
 * edits now (PDL P12b, owner 25.09.2026), served by the same route as the amounts beside
 * it, so a name changed through `PUT /api/pricing/{key}` reaches this table the moment the
 * next visitor reads it rather than waiting for a build.
 *
 * **BOUNDARY, named rather than left to be found:** `pricing.rows.*` still stands in
 * `i18n/sr.json`, with no reader left in the portal's own code. It is not deleted here
 * because PR 375 (the English dictionary) carries its own `pricing.rows` block, and
 * deleting now would collide with it over the same keys. The six keys, their English
 * twin and the guard over both in `i18n/keys.test.ts:170` are removed together once 375
 * is merged, and not before.
 */

/**
 * What the ranking column says for a band.
 *
 * The row that has no answer of its own points at the periods above it; see
 * `ranksByPeriod` in `data/priceList.ts`, which both this table and the administrator's
 * read, so the page that publishes a price and the screen that sets it cannot say
 * different things about it.
 */
function ranks(row: Price, say: (key: string) => string): string {
  if (ranksByPeriod(row)) {
    return say('pricing.rankingByPeriod')
  }

  return row.ranking ? say('pricing.yes') : say('pricing.no')
}

export function PriceTable() {
  const { t, locale } = useI18n()
  const state = usePricing()

  /* `inline`, because this is a part of a page rather than a page: the rulebook
     around it is already drawn, and a sheet over the whole screen while the prices
     arrive would take the article away from somebody reading it. The same reason
     `DucatGallery` gives, and the ducats are the other gallery of this same page. */
  return (
    <Resource state={state} inline label={t('pricing.title')}>
      {(served) => {
        /* By KIND, which is what tells the rows apart (ADL A36 O12). The fee is left out
           because it has no dinar side and this table has a dinar column - „a member who
           pays 40 and 3 has paid the same membership as a member who paid 4.800 dinars"
           (PDL P8) - and the referral because nobody pays it at all: it is credited, and a
           credit has no window in the year and no bearing on the right to be ranked.
           Both were left out by being absent from a constant before this; now they are
           left out by name, which is the same table for a reason somebody can read. */
        const rows = pricedInBoth(served).filter(
          (row) => row.kind === A_PERIOD || row.kind === A_LEVEL,
        )

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
                    <td>{row.label}</td>
                    <td>{windowOf(row) ?? t('pricing.everyPayment')}</td>
                    <td>{money(row.eur, locale)}</td>
                    <td>{money(row.rsd, locale)}</td>
                    <td>{ranks(row, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }}
    </Resource>
  )
}
