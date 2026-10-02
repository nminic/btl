import { Fragment, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useToday } from '../../clock/useClock'
import { pairsFrom } from '../../data/derive'
import { useI18n } from '../../i18n/useI18n'
import { useProfileLink } from './useProfileLink'
import { useSession } from '../../session/useSession'
import { ServerSaid } from '../account/ServerSaid'
import type { Answer } from '../account/askTheServer'
import { theServerWasToldToBreakUp } from '../member/pairWrites'
import type { Competitor, RacingPair } from '../../data/types'

/**
 * „Trkački par" on a profile: who they are paired with, and, on your own page, how to end it and
 * what questions are still standing.
 *
 * PDL says a profile shows „tim i par sa linkovima", and until 07.09.2026 it showed only the team,
 * because nothing made a pair.
 *
 * **Every pair that still counts, and not the one of the furthest season** (review, 07.09.2026). A
 * member can hold two at once: on 2 January, the pair they are running this season in, and one made
 * for the season after. Answered with one of them, the other vanished from their own page and there
 * was no way left to end it, while the person on the far side of it went on being told they were
 * paired. „The furthest wins" was a rule I invented while fixing something else and wrote into no
 * journal, which is how it survived three rounds. A season that is over is history and is not drawn
 * here at all.
 *
 * **Ending one is only ever your own.** „Raskini" stands on the reader's own page and nowhere else:
 * a pair is two people confirming each other, so a third person ending it would be somebody else's
 * decision, and the person being read has their own page to end it from.
 *
 * **The questions still standing are the reader's own, and only on their own page.** Whether
 * somebody else has been asked, and by whom, is their business (odluka 07.09.2026).
 *
 * **„RASKINI" REACHES THE SERVER SINCE 28.09.2026, AND IT CHOOSES WHICH STORE BY ASKING WHICH ONE
 * HOLDS THE PAIR.** Owner, PDL, 24.09.2026: „Par sme da raskine **svaka strana, bilo kad**", and
 * `DELETE /api/pairs/{id}` was written for it on that day. Nothing called it: this line wrote
 * `breakPair` into `session/SessionProvider.tsx`, which is a `useState` in the browser, so the
 * pair came back on the next reload and the other half was told inside the presser's own tab.
 *
 * **The two stores are real and the choice between them is not a precaution.** A pair drawn here
 * comes from one of exactly two places, by the construction of `data/derive.ts`'s `pairsNow`: the
 * file the server served, or `pairsMade`, what this visit confirmed through
 * `member/PairInviteAnswer.tsx`. The second has no row on the server at all - `admin/raceIds.ts`
 * numbers it counting DOWN from nought so that nothing it hands out can collide with a
 * `bigserial` - so a „Raskini" that always sent would send `DELETE /api/pairs/-1`, be answered 404,
 * and leave the pair on the screen. That is the fault `admin/teamWrites.ts#standsOnTheServer` was
 * written for one resource along, in its own words: „a delete pressed on its row without this would
 * send `DELETE /api/teams/-1`".
 *
 * **It is asked of `pairsMade` and not of the sign of the number, which is the stronger of the two
 * and the reason is a mutation.** The numeric test infers the answer from a convention about how
 * identities are minted; this one reads the list that actually knows. `nextIdentity` changed to
 * count upwards would break the inference silently and leave this reading true. <b>The one home for
 * the numeric form is `admin/teamWrites.ts`, and it is not imported here because that file is held
 * by another branch in flight</b>, so widening its javadoc - which says „WHETHER THIS TEAM IS ONE
 * THE DATABASE HANDED OUT" - would be an edit to a file in somebody else's diff. The day it lands,
 * these two are one question in two shapes and the cheaper one wins.
 *
 * **AND THE MESSAGE TO THE OTHER HALF IS THE SERVER'S ON ONE PATH AND THIS SCREEN'S ON THE OTHER,
 * which is one message either way rather than two.** PDL, 07.09.2026: „„Raskini" obaveštava drugu
 * polovinu... Bez toga je portal javljao kroz jedna vrata a ćutao kroz druga." `PairWriteApi.end`
 * pays that itself, with `tell(...)`, in the same transaction as the delete, and the sentence it
 * writes is this portal's own `pair.endedBody` read out of the dictionary
 * (`PairWriteApi.theBrokenPairReads`). So a `notify` beside the send would be the same fact in two
 * homes: one durable row and one copy that dies with the tab. On the session path nothing else
 * writes it, so there it stays.
 *
 * **Where the partner's name leads is not decided here** (security review, 08.09.2026). It was, for
 * one commit: the address was spelt out by hand, and a visitor reading somebody's profile got a
 * live link to their partner even when that partner had hidden their profile, or had let their fee
 * run out. What the visitor got out of it is exactly what P23 hides: a full name, a member number,
 * and the knowledge that the page is there to be hidden. `profile/useProfileLink.ts` is the one
 * place that turns „may this reader reach this member" into an address, and it reads the member
 * again through this visit's overlay, because hiding is chosen during a visit. When it answers with
 * nothing the name stays, as words.
 */
export function RacingPairLine({
  competitor,
  competitors,
  pairs,
}: {
  competitor: Competitor
  competitors: Competitor[]
  /** The pairs that hold now, the file and this visit together (`data/derive.ts`, `pairsNow`). */
  pairs: RacingPair[]
}) {
  const { t } = useI18n()
  const today = useToday()
  const linkTo = useProfileLink()
  const { memberNumber: reader, pairInvites, pairsMade, breakPair, notify } = useSession()
  /**
   * WHAT THE SERVER SAID ABOUT ONE ROW, AND WHICH ROW, because a member may hold two.
   *
   * <p>Kept as a pair rather than as a bare answer for the reason `admin/AdminTeams.tsx` keeps
   * its own the same way: told without the key, a refusal about the pair for 2027 would print
   * itself under the pair for 2028 as well, and the member would read that both had failed.
   */
  const [refused, setRefused] = useState<{
    id: number
    answer: Exclude<Answer, { got: 'done' }>
  } | null>(null)
  const [sending, setSending] = useState(false)
  /**
   * A SECOND PRESS WHILE THE FIRST IS STILL OUT, and it is a ref rather than the state beside it.
   *
   * <p>`member/ServedPairInvite.tsx`'s own guard, which is `Registration.tsx`'s, and the reason
   * is the same: `setSending(true)` is applied on the next render, so two presses dispatched
   * inside one task both read `sending === false` and both send. A ref is written in the same
   * tick it is read.
   *
   * <p><b>It refuses a press on ANY row while one is out, not only on the row that is out</b>,
   * and that is deliberate: ending two pairs is two decisions, and the second is taken against a
   * screen that is about to change under it. `aria-disabled` is therefore put on every „Raskini"
   * rather than on the one pressed, so the button that will refuse says so beforehand.
   */
  const outstanding = useRef(false)
  const mine = reader === competitor.memberNumber
  const named = (who: string) =>
    competitors
      .filter((one) => one.memberNumber === who)
      .map((one) => `${one.firstName} ${one.lastName}`)
      .join('')

  const held = pairsFrom(pairs, competitor.memberNumber, Number(today.slice(0, 4)))

  /**
   * ENDING ONE, WHEREVER IT IS KEPT.
   *
   * <p><b>Nothing is written anywhere until the store that holds the pair has agreed</b>, which
   * is `member/inboxRead.ts`'s rule in its own words and the axis this function cannot get
   * wrong: a portal that dropped the row on the asking would draw a member out of a pair the
   * server still has him in, and he would have no button left to try again with.
   *
   * <p><b>The break is written into the visit LAST and on both paths</b>, because the drop of
   * the `pairs` cache inside `theServerWasToldToBreakUp` is for the next mount and this screen
   * is already mounted (`data/useResource.ts`: „dropped without the bump, nothing re-reads").
   * `admin/AdminTeams.tsx` pairs the same two writes for the same reason.
   *
   * @param pair  the row „Raskini" stands beside
   * @param other the half who is told, which is read off the pair rather than off the reader
   */
  async function endIt(pair: RacingPair, other: string): Promise<void> {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setSending(true)
    setRefused(null)

    if (pairsMade.some((one) => one.id === pair.id)) {
      /* A pair this visit confirmed and no server has: there is no row to ask about, and the
         message to the other half has nowhere else to come from. */
      notify({
        from: t('app.name'),
        to: other,
        subject: t('pair.brokenSubject'),
        body: t('pair.endedBody', {
          who: named(competitor.memberNumber),
          season: pair.season,
        }),
        date: today,
      })
    } else {
      const came = await theServerWasToldToBreakUp(pair.id)

      if (came.got !== 'done') {
        outstanding.current = false
        setSending(false)
        setRefused({ id: pair.id, answer: came })

        return
      }
    }

    outstanding.current = false
    setSending(false)
    breakPair(pair.id)
  }

  const waiting = mine
    ? pairInvites
        .filter((one) => one.from === reader || one.to === reader)
        .map((one) => (
          <span key={one.id} className="profile__pair-waiting">
            {' '}
            {one.from === reader
              ? t('pair.sent', { who: named(one.to) })
              : t('pair.received', { who: named(one.from) })}
          </span>
        ))
    : []

  if (held.length === 0) {
    /* On somebody else's page, nothing at all. On the reader's own, that there is no pair and what
       is still standing: an empty space answers nothing. */
    return mine ? (
      <p className="profile__pair">
        <span>{t('pair.none')}</span>
        {waiting}
      </p>
    ) : null
  }

  return (
    <>
      {held.map((pair) => {
        const other = pair.memberNumbers.filter((one) => one !== competitor.memberNumber).join('')
        const partner = competitors.find((one) => one.memberNumber === other)
        /* Nothing where this reader may not reach that profile, and nothing where the portal no
           longer has the member at all: one answer, because on the screen they are the same. */
        const to = partner === undefined ? undefined : linkTo(partner)

        return (
          /* A FRAGMENT AROUND THE ROW SINCE 28.09.2026, BECAUSE WHAT THE SERVER SAID CANNOT STAND
             INSIDE IT. `ServerSaid` draws `<p class="field__error" role="alert">`, and a `<p>`
             inside a `<p>` is closed by the parser rather than nested, so the alert would land
             outside the row it belongs to and the rest of the line after it. The row's own markup
             and its class are untouched. */
          <Fragment key={pair.id}>
            <p className="profile__pair">
              <span className="profile__pair-label">{t('pair.mine')}: </span>
              {partner === undefined ? (
                /* A member the portal no longer has: the pair is still a fact and is still said,
                   but there is nothing to open. */
                <span>{other}</span>
              ) : to === undefined ? (
                <span>
                  {partner.firstName} {partner.lastName}
                </span>
              ) : (
                <Link to={to}>
                  {partner.firstName} {partner.lastName}
                </Link>
              )}{' '}
              {/* THE SEASON AND NOT THE DAY, SINCE 21.09.2026. Owner, 13.09.2026, of the day a
                  pair was made: it „se ne prikazuje nikome", and when the mock was switched off it
                  „sklanja se i sa ekrana". `/api/pairs` answers `id`, `season` and the two member
                  numbers, so there is no day here to draw even if anybody wanted one. What the
                  sentence said besides the day it still says: which season this pair runs in. */}
              <span className="profile__pair-since">
                {t('pair.forSeason', { season: pair.season })}
              </span>
              {/* NO „RASKINI" WHERE THE OTHER HALF IS NOT IN THE ROSTER, BECAUSE THE SERVER ANSWERS
                  IT 404 EVERY TIME (PENDING stavka 316). The roster is what `GET /api/competitors`
                  serves and `CompetitorApi` ends it `where c.active`, so a half who is not in it is a
                  member whose fee has lapsed; `PairWriteApi.pairHeIsHalfOf` asks BOTH halves to be
                  active, so `DELETE /api/pairs/{id}` answers this pair with an empty 404 whoever
                  presses and however often. The pair is still drawn and still said, as it was, with
                  the number where the name would be: what is not offered is a press that cannot
                  work. **This is the reasoning of the author of this branch, not a recorded
                  decision**; the owner's own words about such a pair are P13, 11.08.2026, „Ne
                  postoji par onda, raskida se.", which says that it is not the member's to end. */}
              {mine && partner !== undefined && (
                <>
                  {' '}
                  {/* **`aria-disabled` AND NEVER `disabled`**, which is the portal's own answer
                      given with its reason in `member/ProfilePicture.tsx` and again in
                      `event/RateEvent.tsx`: `disabled` takes the button out of the tab order, so a
                      member ending a pair by keyboard has focus ON it in the instant it is switched
                      off and the browser drops him to the top of the document. Told off instead, he
                      stays where he is and `endIt` refuses the press off the ref. */}
                  <button
                    type="button"
                    className="button button--secondary"
                    aria-disabled={sending}
                    onClick={() => {
                      void endIt(pair, other)
                    }}
                  >
                    {t('pair.breakUp')}
                  </button>
                </>
              )}
            </p>
            {/* WHAT THE SERVER SAID, UNDER THE ROW IT IS ABOUT AND UNDER NO OTHER. The pair stays
                drawn beside it: a break the server refused has not happened, so a line that went
                anyway would tell the member the opposite of what the server holds.

                AND ONLY ON THE READER'S OWN PAGE, guarded by `mine` same as the button above it
                (review, 28.09.2026). `refused` is keyed by `pair.id` and not remounted between
                profiles (`app/routeObjects.tsx` carries no `key` on this route), so a refusal from
                the reader's own „Raskini" outlived a navigation to the held pair's OTHER half and
                read out on arrival there, about a press that page never made. */}
            {mine && refused !== null && refused.id === pair.id && (
              <ServerSaid
                answer={refused.answer}
                refusals={WHEN_BREAKING_A_PAIR}
                numbers={WHAT_THE_NUMBER_SAYS_WHEN_BREAKING_A_PAIR}
              />
            )}
          </Fragment>
        )
      })}
      {waiting.length > 0 && <p className="profile__pair">{waiting}</p>}
    </>
  )
}

/**
 * THE REFUSALS `DELETE /api/pairs/{id}` CAN NAME, AND THERE ARE NONE.
 *
 * <p><b>Read off the route rather than remembered, and empty is what it really answers.</b>
 * `PairWriteApi.end` reaches for `away()` and never for `no(...)`, so the only two answers that
 * route gives are 204 and an empty 404 - and the 404 is deliberately four callers at once (a pair
 * that is not there, one that is not his, one of a season that is over, one whose half has
 * lapsed), because telling them apart would answer which pairs exist and who is in them to
 * anybody walking the keys.
 *
 * <p><b>Named as a constant rather than written `{}` at the call site</b>, so that the day the
 * route does name one there is a place for its sentence to go, and so that the reason it is empty
 * is written once beside the emptiness instead of being a puzzle at the call site.
 */
const WHEN_BREAKING_A_PAIR: Record<string, string> = {}

/**
 * WHAT THAT 404 MEANS, SAID IN THE ROUTE'S OWN WORDS (PENDING stavka 316).
 *
 * <p><b>The 404 is the whole of what this route says when it refuses, and it is four callers at
 * once</b>: a pair that is not there, one that is not his, one of a season that is over, and one
 * whose half has stopped paying. None of the four is answered by pressing again. Said with the
 * portal's general sentence for a 404 it told her „pokusaj ponovo za koji minut", which is advice
 * a member who has just pressed this button can never use, so `ServerSaid` is handed this table
 * and says `pair.breakRefused.notHeld` instead.
 *
 * <p><b>THE WORDS OF THAT SENTENCE ARE A PROPOSAL OF THE AUTHOR OF THIS BRANCH AND NOT THE
 * OWNER'S.</b> What was asked of it is that it may not promise that a second try will work. It is
 * one sentence for all four causes on purpose, saying only what holds for every one of them: a
 * sentence that named the cause would be the answer to „which pairs exist and who is in them" that
 * the empty 404 is written not to give (`PairWriteApi.end`). It names the one thing that does
 * help, which is to read the page again.
 */
const WHAT_THE_NUMBER_SAYS_WHEN_BREAKING_A_PAIR: Record<number, string> = {
  404: 'pair.breakRefused.notHeld',
}
