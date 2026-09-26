import type { Price } from './types'

/**
 * HOW THE SERVED PRICE LIST IS READ, IN ONE PLACE FOR THE THREE SCREENS THAT READ IT.
 *
 * <p><b>Three screens quote a price and until 26.09.2026 all three read a constant
 * compiled into the bundle</b> (`data/pricing.ts`): the administration's own screen, the
 * public table under Član 14 of the rulebook, and „Moja članarina" - which also fills in
 * the IPS QR code a member scans to pay. They read `GET /api/pricing` now, and this is
 * the one module that knows how that answer is taken apart, for the reason the price list
 * has always been one file: „the screen that sets prices and the page that publishes them
 * saying different things is the fault this file exists to prevent".
 *
 * <p><b>Beside `data/pricing.ts` rather than inside it, and that is measured rather than
 * tidy.</b> That file still holds the calendar of the selling year and the rules of who
 * pays what - `priceOn`, `juniorInSeason`, `seasonBeingRenewed`, `REGISTRATION_OPENS` -
 * and eighteen files read it for those. What moved to the server is the AMOUNT and
 * nothing else, so what moved into a new file is the reading of an amount and nothing
 * else. Folded together, every one of those eighteen would have gained a reason to know
 * about a resource.
 *
 * <p><b>Nothing here sorts anything.</b> `PricingApi` answers in `sort_order` and says
 * why the order is the answer rather than a field: „a position said twice - once by where
 * a row is and once by a number on it - is two things to keep equal, and the day they
 * disagree there is nothing to say which of them the reader should believe." The selling
 * year opens on 1 October and the last of the four periods is the one that follows the
 * new year, so the order is a decision somebody took and a screen that re-sorted it would
 * be taking it again.
 */

/**
 * THE FOUR KINDS OF ROW, WHICH IS WHAT TELLS THEM APART (ADL A36 O12).
 *
 * <p><b>The kind and never the key, and that is the whole reason this module exists.</b>
 * The portal used to split the list by holding four separate constants - `PRICES`,
 * `JUNIOR_ROW`, `REFERRAL_ROW` and `PROCESSING_FEE_EUR` - so a row it had no constant for
 * could not be drawn at all, and the eighth row somebody adds tomorrow would have arrived
 * on no screen. `price_row_kind_known` is V4's own list of the four there are, and
 * `MembershipPrice` on the server asks the same question the same way
 * ({@code "period".equals(row.kind())}).
 */
export const A_PERIOD = 'period'

export const A_LEVEL = 'level'

export const A_FEE = 'fee'

export const A_REFERRAL = 'referral'

/**
 * A row that carries BOTH amounts, which is what a screen showing two currencies needs.
 *
 * <p><b>Six of the seven rows have both and the seventh has only euro</b>, and that is
 * V4's own equivalence rather than a looseness: `price_row_only_fee_has_no_rsd` reads
 * {@code (rsd is null) = (kind = 'fee')}, because there is no payment intermediary on the
 * dinar side to pay (PDL, owner 04.08.2026). The fee is therefore quoted as its own line
 * and never as a row of a two-column table, which is what both tables already did when
 * the figures were constants.
 */
export type PricedInBoth = Price & { rsd: number }

/**
 * The rows that can be shown in both currencies, in the order they arrived.
 *
 * <p><b>A filter and not an assertion (ADL A14).</b> `rsd` is `number | null` on the wire
 * because the answer really carries a null, and the one honest way to hand a screen a
 * number is to look at it. A row that has no dinar price is not drawn by a table with a
 * dinar column: it has nothing to put in one of its two cells, and an empty cell there
 * reads as data that went missing rather than as a price that does not exist.
 */
export function pricedInBoth(rows: Price[]): PricedInBoth[] {
  return rows.flatMap((row) => (row.rsd === null ? [] : [{ ...row, rsd: row.rsd }]))
}

/**
 * Every row of one kind, as a list.
 *
 * <p><b>A list even where exactly one row is expected, which is the portal's own idiom
 * for this</b> (`admin/AdminPricing.tsx`, on the referral: „a list of one rather than one
 * row, because a row found is a row that might not be, and neither `!` nor `as` is
 * written on this portal. Walked as a list, the case where it is missing is the empty list
 * and needs no guard at all."). An answer that carries no referral draws no referral
 * section, rather than drawing one about nothing.
 */
export function ofKind<T extends Price>(rows: T[], kind: string): T[] {
  return rows.filter((row) => row.kind === kind)
}

/**
 * WHAT MEMBERSHIP COSTS ON A GIVEN DAY, off the served list.
 *
 * <p>The same question `priceOn` in `data/pricing.ts` answers over the bundled constant,
 * and asked the same way: <b>the last period whose first day has passed</b>, rather than
 * the one whose window contains today. „The two are the same answer, and this one cannot
 * fail to have one: the year begins inside a period."
 *
 * <p><b>Except that here it CAN answer nothing, and that difference is the point.</b>
 * The constant was four rows that tile the year, held to it by a test. What arrives over
 * the wire is whatever the table holds, and a table with no period in it is a state this
 * side cannot rule out - so the answer is a list of none or one, and a screen with no
 * price to quote says so instead of quoting the wrong one. The four rows are still held
 * to tiling the year, on the side that can hold them: `PriceListRowsTest` on the server.
 *
 * <p><b>Sorted by the day the window opens and NOT read in the answer's order</b>, which
 * is the one place this module does look at an order. That is not a re-sort of the list: it
 * is the same walk `priceOn` makes, over the same days of the year, and the answer's order
 * is what a reader reads the TABLE in rather than the order the year runs in. The two
 * differ today - the served list opens with 1 October and the year opens on 1 January -
 * which is exactly why the walk cannot use it.
 */
export function inForceOn(rows: PricedInBoth[], today: string): PricedInBoth[] {
  const day = today.slice(5)
  /* A PERIOD WITH NO WINDOW IS NOT A CANDIDATE, and it is dropped rather than read as one
     opening on the first day of the year. V4 forbids the state - a period is the only kind
     sold in a window and is never sold outside one (`price_row_period_has_days`) - so this
     is about what THIS side does when it arrives all the same. Standing in for the missing
     day with `''` was the first draft and it is worse than dropping the row: `'' <= day` is
     true of every day there is, so a period that had lost its window would have become the
     price in force on every morning of the year, ahead of the four that really tile it. */
  const byStart = ofKind(rows, A_PERIOD)
    .flatMap((row) => (row.from === null ? [] : [{ row, from: row.from }]))
    .sort((left, right) => left.from.localeCompare(right.from))

  return byStart.reduce<PricedInBoth[]>(
    (inForce, one) => (one.from <= day ? [one.row] : inForce),
    [],
  )
}

/**
 * The window a row is sold in, as the two days of the year it runs between, or nothing
 * where the row has no window at all.
 *
 * <p><b>Nothing means nothing here, and the answer's null is what says so.</b> The
 * bundled type wrote `''` in that place - „an artefact of a TypeScript field nobody made
 * optional and not a decision anybody took" (`PricingApi`) - and the two screens that draw
 * this cell tested for exactly that empty string. Read against a null they both drew
 * „undefined - undefined", which is how two spellings of absence part company.
 *
 * <p><b>Both days are asked about and not only the first</b>, although V4 ties them
 * together ({@code price_row_period_has_days}, {@code (day_from is not null) = (kind =
 * 'period')} and the same for {@code day_to}): a cell reading „1.10. - undefined" is what
 * one of the two answers alone would draw, and the schema being right is not a reason for
 * this to be wrong if it ever is not.
 */
export function windowOf(row: Price): string | null {
  return row.from === null || row.to === null ? null : `${day(row.from)} - ${day(row.to)}`
}

/** mm-dd as a day is read: 10-05 is the fifth of October. */
function day(monthDay: string): string {
  const [month, date] = monthDay.split('-')

  return `${Number(date)}.${Number(month)}.`
}

/**
 * Whether a row has no answer of its own to the ranking column and points at the periods
 * instead.
 *
 * <p><b>Asked of the ANSWER's null and no longer of the key.</b> It was
 * {@code row.key === 'junior'}, which is a claim that the junior level is the only row
 * that will ever be in that position; read off the null it is a claim about the row in
 * hand. Whether a season is ranked follows the day the fee is paid (Član 11 of the
 * rulebook), for a junior exactly as for anybody else, so a level answers the question
 * with „it does not apply to me" - and V4 holds that in both directions
 * ({@code price_row_only_period_is_ranked}, {@code (ranking is not null) = (kind =
 * 'period')}).
 *
 * <p>Both tables said „Da" outright once: the public one until 20.08.2026 and the
 * administrator's one after it, which is worse, because that is the screen where somebody
 * decides.
 */
export function ranksByPeriod(row: Price): boolean {
  return row.ranking === null
}
