import type { Gender, Member, MembershipBasis } from '../../data/types'
import { WHEN_RECORDING_ON_THE_ROW, type RowBooking } from './memberPayment'

/**
 * WHAT THE MEMBER'S ROW OFFERS FOR THE SEASON ON SALE, AND WHAT EACH OFFER SENDS.
 *
 * The owner, 18.10.2026 (PDL P8, the section „Osnov članstva ima jedan dom”): „Osnov se menja i uplata
 * stornira opcijama na redu člana u moderaciji članova, ne posebnim ekranom.” And, each chosen with the
 * recommendation: „Promene osnova na redu člana idu u oba smera. Oslobođenje se može povući (storno) i
 * preko njega se može upisati uplata; aktivacija iz balansa se može stornirati”, and „Iz aktivacije iz
 * balansa se na redu ne prelazi direktno u uplatu ni u oslobođenje: storno (balans se vraća
 * protivstavkom), pa nova radnja.”
 *
 * Its own module rather than functions beside the row, for the reason `memberPayment.ts` gives: a test
 * that has to mount React to ask which options a basis leads to measures a render, not a decision.
 *
 * **THE BASIS IS THE ONE OF THE SEASON ON SALE, `membershipBasis`, AND NOTHING ELSE.** PDL P8, „Koje
 * sezone: do 14.10. samo tekuća, od 15.10. samo naredna”: `GET /api/members` answers the basis of exactly
 * that season, and `seasons` carries every season he ever held, the last of which need not be it. So
 * an older season on a payment offers nothing of that season here. A member who holds no season on sale
 * is offered the payment (`MemberPaymentSheet.tsx`) and the exemption: „Oslobođenje ostaje izbor na redu
 * člana” (PDL P8, 18.10.2026), with a window the owner chose on 20.10.2026 between the outcomes put to
 * him, with the recommendation: „Odobri oslobođenje od članarine za sezonu [godina]?”. Since 22.10.2026
 * the exemption is granted by ticking the season on sale in the row's list of seasons
 * (`MemberSeasons.tsx`).
 */

/**
 * What the row offers BESIDE „Storniraj”, worked out from the basis of the season on sale. „Storniraj”
 * itself needs no field: every basis may be cancelled, and a row with no basis has nothing to cancel.
 * Nor does the exemption: it is offered exactly where no basis is held, as the box of the season on sale
 * that is not ticked (`MemberSeasons.tsx`).
 */
export type Offered = {
  /** „Promeni osnov u oslobođenje”: from a payment only. */
  toTheExemption: boolean
  /** „Upiši uplatu” over the exemption: from an exemption only. */
  paymentOverTheExemption: boolean
}

export function offeredFor(basis: MembershipBasis | undefined): Offered {
  return {
    toTheExemption: basis === 'payment',
    paymentOverTheExemption: basis === 'feeExempt',
  }
}

/** The address of every act of this file, built in one place so a test cannot agree with a typo. */
export function membershipOnTheRow(memberNumber: string): string {
  return `/api/members/${memberNumber}/membership`
}

/**
 * `MemberMembershipApi.Cancelling`: the basis the screen showed, which the route compares with the
 * season as it stands and refuses when they differ (PDL P8, [IZVEDENO 18.10.2026] „Zahtev za storno ili
 * promenu nosi osnov koji je ekran pokazao”), and the season of the box, which is the season the route
 * cancels (owner, 22.10.2026: „da dodam ili oduzmem neku štikliranu unazad”). The route reads no season
 * off its clock for this, so the body is the only place the season is said.
 */
export function cancelling(basis: MembershipBasis, season: number): { basis: MembershipBasis; season: number } {
  return { basis, season }
}

/** `MemberMembershipApi.Granting`: the one basis a season he holds none of may be granted, and the season. */
export function granting(season: number): { basis: 'feeExempt'; season: number } {
  return { basis: 'feeExempt', season }
}

/**
 * WHETHER THE BOX OF A SEASON ACTS, which is the route's own answer (`MemberMembershipApi.whyNot`): the
 * season on sale, and a season the freeze has written down (`GET /api/frozen-seasons`, the row and never
 * the clock, ADL 08.11.2026). The owner, 24.11.2026, chosen with the recommendation: „Sezona koja se
 * završila ne dira se od 15.10. do zamrzavanja 1.1. u 16:00: njena kućica je u tom prozoru neaktivna, a
 * posle zamrzavanja se sme štiklirati i odštiklirati.” So a season between the two is drawn and does not
 * act, and a season the screen has not yet read as frozen does not act either: the route would refuse it.
 */
export function actsOn(seasonOnSale: number, season: number, frozen: readonly number[]): boolean {
  return season === seasonOnSale || frozen.includes(season)
}

/** `MemberMembershipApi.Changing` from a payment to the exemption. */
export const TO_THE_EXEMPTION: { from: 'payment'; to: 'feeExempt' } = { from: 'payment', to: 'feeExempt' }

/** `MemberMembershipApi.Changing` from the exemption to a payment, with what arrived and how. */
export function overTheExemption(booking: RowBooking): RowBooking & { from: 'feeExempt'; to: 'payment' } {
  return { from: 'feeExempt', to: 'payment', ...booking }
}

/**
 * THE QUESTION BEFORE A CANCELLATION, in the owner's words by basis (PDL P8, chosen with the
 * recommendation, 18.10.2026): „Storniraj uplatu za sezonu [godina]?”, „Storniraj oslobođenje za sezonu
 * [godina]?”, „Storniraj aktivaciju iz balansa za sezonu [godina]?”.
 */
export function askingToCancel(basis: MembershipBasis): string {
  return `admin.askCancel.${basis}`
}

/** Four of the five reasons `MemberMembershipApi` declares, in this screen's words; the fifth is below. */
const THE_ROWS_OWN: Record<string, string> = {
  theFormIsNotComplete: 'admin.membershipRefused.theFormIsNotComplete',
  theBasisIsNotKnown: 'admin.membershipRefused.theBasisIsNotKnown',
  thisChangeIsNotOffered: 'admin.membershipRefused.thisChangeIsNotOffered',
  theBasisHasChanged: 'admin.membershipRefused.theBasisHasChanged',
}

/**
 * The fifth reason, which only the two acts that name a season meet: a season the box may not name now
 * (`MemberMembershipApi.THE_SEASON_IS_NOT_OFFERED`), in the owner's words of 24.11.2026: „Ova sezona se
 * sada ne može menjati.” `PUT` names no season, so the change and the payment over the exemption never
 * meet it.
 */
const THE_BOXES_OWN: Record<string, string> = {
  theSeasonIsNotOffered: 'admin.membershipRefused.theSeasonIsNotOffered',
}

/**
 * WHAT A CANCELLATION CAN BE REFUSED WITH: three of the four, and the season's. `thisChangeIsNotOffered`
 * is the change's alone, because `DELETE` names no change.
 */
export const WHEN_CANCELLING: Record<string, string> = {
  ...Object.fromEntries(Object.entries(THE_ROWS_OWN).filter(([reason]) => reason !== 'thisChangeIsNotOffered')),
  ...THE_BOXES_OWN,
}

/** WHAT A CHANGE TO THE EXEMPTION CAN BE REFUSED WITH: all four, and nothing of a booking. */
export const WHEN_CHANGING_TO_THE_EXEMPTION: Record<string, string> = THE_ROWS_OWN

/**
 * WHAT A GRANT CAN BE REFUSED WITH: all four as well, because `POST` names a basis and refuses any
 * but the exemption with `thisChangeIsNotOffered`, and a season that stands by then on another basis
 * with `theBasisHasChanged`; and the season's, because it names a season.
 */
export const WHEN_GRANTING_AN_EXEMPTION: Record<string, string> = { ...THE_ROWS_OWN, ...THE_BOXES_OWN }

/**
 * WHAT A PAYMENT OVER THE EXEMPTION CAN BE REFUSED WITH: the four, and every reason the row's own
 * payment can meet, because the route checks the money and books it the way `MemberPaymentApi` does
 * and answers in `PaymentApi`'s words. `theFormIsNotComplete` is in both and means one thing, so the
 * row's own sentence is the one kept.
 */
export const WHEN_PAYING_OVER_THE_EXEMPTION: Record<string, string> = {
  ...WHEN_RECORDING_ON_THE_ROW,
  ...THE_ROWS_OWN,
}

/** What a box of the list asks the row to put to the moderator, and of which season. */
export type SeasonAsk =
  | { act: 'grant'; season: number }
  | { act: 'cancel'; basis: MembershipBasis; season: number }
  | { act: 'toTheExemption' }

/**
 * THE BASIS A SEASON OF THE LIST STANDS ON, or nothing where he holds none of it.
 *
 * <p><b>The season on sale is read off `membershipBasis`</b>, the basis the column „Osnov" draws and the
 * one a request names back to the route (PDL P8, [IZVEDENO 18.10.2026] „Zahtev za storno ili promenu
 * nosi osnov koji je ekran pokazao"). <b>Every other season is read off `seasons`</b>, which is the only
 * answer that says anything about it. For the season on sale the two are the same row of `membership`
 * (`MembersApi`), so which of them is read cannot be told apart from outside: that is a boundary, said
 * here, and not a guard.
 */
export function heldIn(one: Member, season: number): MembershipBasis | undefined {
  return season === one.seasonOnSale
    ? one.membershipBasis
    : one.seasons.find((held) => held.season === season)?.basis
}

/**
 * THE WORD OF THE COLUMN „OSNOV" (owner, 22.10.2026, chosen with the recommendation: „Uplata",
 * „Oslobođen", for a woman „Oslobođena", „Balans"), as the key of the dictionary that says it.
 */
export function basisWordOf(basis: MembershipBasis, gender: Gender): string {
  return basis === 'feeExempt' ? `admin.basisWord.feeExempt${gender}` : `admin.basisWord.${basis}`
}
