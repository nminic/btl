/**
 * WHAT THE PRICE SCREEN SENDS, AND WHAT EVERY REFUSAL OF IT IS CALLED.
 *
 * <p>Its own module rather than a constant beside the screen, which is the arrangement
 * `admin/leagueWrites.ts` and `member/myAccount.ts` already have and the reason they give:
 * `react/only-export-components` asks for it, and a test reading a component file to get at
 * a table is a test that mounts React to ask a question about a list.
 */

/**
 * WHAT `PUT /api/pricing/{key}` TAKES, which is `PricingWriteApi.Amounts` and nothing
 * besides.
 *
 * <p><b>Two amounts and never one with a rate on it.</b> Owner, 25.09.2026 (PDL P12d),
 * refusing the recommendation that the route work the dinar price out: „Evri i dinari se
 * kucaju <b>slobodno i nezavisno</b>. Kurs iz `PDL.md:833` je bio <b>nacin da se cene prvi
 * put izracunaju</b>, ne odnos koji portal cuva." So nothing here or on the screen
 * multiplies anything by anything, and the seven rows all sitting at 120 dinars to the euro
 * today is how the numbers were first worked out rather than a rule anybody enforces.
 *
 * <p><b>There is no third field, and its absence is a PLAN.</b>
 * `admin-cena.form.json` asks for `label` as well and it has nowhere to go: `price_row` has
 * no column for a name yet, and the six names a reader sees stand in `i18n/sr.json` under
 * `pricing.rows.*`. Owner, 25.09.2026 (PDL P12b): the name becomes a column he edits from
 * the administration, and it arrives together with this screen rather than before it -
 * `b102-ime-reda-cenovnika` is that branch, and this gains a third field on the day it
 * lands.
 */
export type Amounts = {
  /**
   * Nothing where the field was left empty, and never nought.
   *
   * <p><b>Null and not `Number('')`, which is the one thing that had to be got right
   * here.</b> `Number('')` is `0`, and nought is a PRICE this route accepts -
   * `price_row_eur_not_negative` reads `eur >= 0`, and a membership the league gives away
   * is a real state of the product (Pravilnik član 15). So a form that lost its euro field
   * on the way would have set the fee to nothing at all, silently, where a null gets
   * `theFormIsNotComplete` back and the administrator is told.
   *
   * <p>`leagueWrites.upsertFrom` makes the opposite choice for the same reason: a missing
   * name becomes the empty string, because `''` is what THAT route refuses. Each sends the
   * value its own route will not take.
   */
  eur: number | null
  rsd: number | null
}

/**
 * The two amounts read off the form.
 *
 * <p><b>Whether the form can really send a blank is not this function's business.</b>
 * `admin-cena.form.json` marks both required and `forms/validate.ts` refuses an empty
 * required field before anything is sent, so the null above is normally unreachable from
 * the screen. It is written all the same, and the precedent says why in as many words
 * (`WHEN_WRITING_A_LEAGUE`, on `theFormIsNotComplete`): „nearly unreachable from the form,
 * which refuses an empty required field before it sends, and answered because the request
 * can still lose a race against what the screen believes stands."
 *
 * <p><b>`Number.isFinite` and not `!Number.isNaN`</b>, so that a field holding `Infinity`
 * is nothing rather than an amount the route is asked to keep exactly.
 */
export function amountsFrom(values: Record<string, string | boolean>): Amounts {
  return { eur: amount(values.eur), rsd: amount(values.rsd) }
}

function amount(typed: string | boolean | undefined): number | null {
  if (typeof typed !== 'string' || typed.trim() === '') {
    return null
  }

  const read = Number(typed)

  return Number.isFinite(read) ? read : null
}

/**
 * THE FIVE REFUSALS A PRICE BEING WRITTEN CAN MEET, each to a sentence in the dictionary.
 *
 * <p><b>Written out by hand and held to the server in the same commit</b>, which is what
 * `CLAUDE.md` asks of any list a guard depends on: `pages/account/refusals.test.ts` reads
 * `PricingWriteApi.java`, takes every reason constant it declares, and fails when one is
 * not here or when one here is not there. A sixth reason added on the server is therefore a
 * red gate on the day it is written rather than a reader shown a code he cannot read.
 *
 * <p><b>Two of the five cannot be reached from this screen TODAY, and both are answered
 * anyway.</b> `theFeeHasNoDinarPrice` needs the processing fee to have a button, and it has
 * none until it has a name (PDL P12b, `b102-ime-reda-cenovnika`);
 * `theAmountIsMoreThanARowMayCost` is the ceiling `admin-cena.form.json` already carries as
 * `max`, so the form turns it back first. Neither is a reason to leave a sentence out: the
 * form is the floor and the route decides (PDL P12c), and a request that goes round the
 * screen or loses a race meets the route with nothing in between.
 *
 * <p><b>`theReferralIsSettledForTheComingSeason` arrives under 409 and the rest under
 * 400, and this table does not know which.</b> `askTheServer` reads both numbers the same
 * way because both carry a named reason. A table keyed by number would have to be right
 * about which refusal got which, and it has no way to be.
 */
export const WHEN_WRITING_A_PRICE: Record<string, string> = {
  theFormIsNotComplete: 'admin.priceRefused.theFormIsNotComplete',
  /* An amount with more para than `numeric(10,2)` keeps, or a negative one. Its own
     sentence and not the ceiling's, because the two send an administrator to two different
     places: this says „take a para off it" and that says „that is more than a membership
     may cost". PostgreSQL would not refuse 41,125 at all - it ROUNDS it - so the route
     refuses it rather than quietly charging a price nobody typed. */
  theAmountIsNotKeptExactly: 'admin.priceRefused.theAmountIsNotKeptExactly',
  theAmountIsMoreThanARowMayCost: 'admin.priceRefused.theAmountIsMoreThanARowMayCost',
  theFeeHasNoDinarPrice: 'admin.priceRefused.theFeeHasNoDinarPrice',
  /* PDL P16, owner 16.08.2026: „administrator podesava do 1.10. u 00 po CET za predstojecu
     godinu", and after it „iznos za tu godinu stoji". The screen tells the button off
     before this is ever reached (`OpenRecord`, `settled`), and the sentence exists because
     that guard is the SCREEN's and ADL A8 puts the rule on the route: a request sent past
     the screen is refused by the one that decides, and the words a reader sees then are the
     route's answer rather than the screen's own reading of the calendar. */
  theReferralIsSettledForTheComingSeason: 'admin.priceRefused.theReferralIsSettled',
}
