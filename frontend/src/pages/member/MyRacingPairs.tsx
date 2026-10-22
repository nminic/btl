import { Fragment, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { Unreadable } from '../../components/Unreadable'
import { pairsFrom, pairsNow } from '../../data/derive'
import { combinePair, useCompetitors, usePairs, useWhatIsWaiting } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useProfileLink } from '../profile/useProfileLink'
import { useSession } from '../../session/useSession'
import { ServerSaid } from '../account/ServerSaid'
import type { Answer } from '../account/askTheServer'
import { MEMBERS, recordsOf } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { theServerWasToldToBreakUp } from './pairWrites'
import type { Competitor, RacingPair } from '../../data/types'

/**
 * THE MEMBER'S OWN RACING PAIRS ON „MOJA ČLANARINA", with the way to end each and the questions still
 * standing, read for him and drawn to nobody else.
 *
 * <p><b>Here since 18.10.2026, and moved rather than written anew.</b> PDL P11, owner, 18.10.2026:
 * „Dugme „Raskini" i pozivi u par koji čekaju sele na „Moja članarina", ispod prelaznog roka", and
 * „Na profilu ostaje samo „Trkački par: [ime]" u liniji" (`profile/ProfileHead.tsx`). Everything below
 * was `profile/RacingPairLine.tsx` on the reader's own profile, behaviour for behaviour; what changed
 * is that the page is always his own, so the `mine` it asked on every row is gone, and that „Nije u
 * trkačkom paru." went with the profile's half (same decision: „Na profilnoj strani ne treba da piše
 * Nije u trkačkom paru"). With no pair and no question the panel is not drawn at all.
 *
 * <p><b>Every pair that still counts, the next season's too</b>: the line under the name carries only
 * the running season's (PDL P11, „Samo tekući"), and this is where a pair made for the season after is
 * seen and can be ended, the owner's 24.09.2026 „Par sme da raskine svaka strana, bilo kad" standing as
 * it was. The partner's name is said on each row, because here it is in no line above.
 *
 * <p>Reads the list of members and the pairs for itself: `Membership.tsx` reads neither (its own row
 * comes off `GET /api/me`), and a member whose fee has lapsed is on no list and in no pair
 * (`PairApi`, both halves active), so for him this draws nothing.
 */
export function MyRacingPairs({ memberNumber }: { memberNumber: string }) {
  const { pairsMade, pairsBroken } = useSession()
  const overlay = useOverlay()
  const state = combinePair(useCompetitors(), usePairs())

  return (
    <Resource state={state} inline>
      {([everybody, fromFile]) => {
        const competitors = recordsOf(MEMBERS, everybody, overlay)
        const me = competitors.find((one) => one.memberNumber === memberNumber)

        return me === undefined ? null : (
          <PairsOf
            competitor={me}
            competitors={competitors}
            pairs={pairsNow(fromFile, pairsMade, pairsBroken)}
          />
        )
      }}
    </Resource>
  )
}

/**
 * The panel itself: who he is paired with, how to end it, and what questions are still standing.
 *
 * **Every pair that still counts, and not the one of the furthest season** (review, 07.09.2026). A
 * member can hold two at once: on 2 January, the pair they are running this season in, and one made
 * for the season after. Answered with one of them, the other vanished from their own page and there
 * was no way left to end it, while the person on the far side of it went on being told they were
 * paired. A season that is over is history and is not drawn here at all.
 *
 * **„RASKINI" REACHES THE SERVER SINCE 28.09.2026, AND IT CHOOSES WHICH STORE BY ASKING WHICH ONE
 * HOLDS THE PAIR.** Owner, PDL, 24.09.2026: „Par sme da raskine **svaka strana, bilo kad**", and
 * `DELETE /api/pairs/{id}` was written for it on that day. A pair drawn here comes from one of
 * exactly two places, by the construction of `data/derive.ts`'s `pairsNow`: the file the server
 * served, or `pairsMade`, what this visit confirmed through `member/PairInviteAnswer.tsx`. The second
 * has no row on the server at all - `admin/raceIds.ts` numbers it counting DOWN from nought - so a
 * „Raskini" that always sent would send `DELETE /api/pairs/-1`, be answered 404, and leave the pair
 * on the screen. **It is asked of `pairsMade` and not of the sign of the number**: the numeric test
 * infers the answer from a convention about how identities are minted, this one reads the list that
 * actually knows.
 *
 * **AND THE MESSAGE TO THE OTHER HALF IS THE SERVER'S ON ONE PATH AND THIS SCREEN'S ON THE OTHER,
 * which is one message either way rather than two.** PDL, 07.09.2026: „„Raskini" obaveštava drugu
 * polovinu". `PairWriteApi.end` pays that itself, with `tell(...)`, in the same transaction as the
 * delete, and the sentence it writes is this portal's own `pair.endedBody` read out of the dictionary.
 * On the session path nothing else writes it, so there it stays.
 *
 * **Where the partner's name leads is not decided here** (security review, 08.09.2026):
 * `profile/useProfileLink.ts` is the one place that turns „may this reader reach this member" into an
 * address, and when it answers with nothing the name stays, as words.
 */
function PairsOf({
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
  const { pairsMade, breakPair, notify } = useSession()
  const waiting = useWhatIsWaiting(competitor.memberNumber)
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
   * is `member/inboxRead.ts`'s rule in its own words: a portal that dropped the row on the asking
   * would draw a member out of a pair the server still has him in, and he would have no button
   * left to try again with.
   *
   * <p><b>The break is written into the visit LAST and on both paths</b>, because the drop of
   * the `pairs` cache inside `theServerWasToldToBreakUp` is for the next mount and this screen
   * is already mounted (`data/useResource.ts`: „dropped without the bump, nothing re-reads").
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
        /* The verb follows the sex of whoever PRESSED, who is the reader on his own page, and
           never of the half who is told (PDL P18, 18.10.2026, "Raskid para: ime u nominativu"):
           a racing pair is one man and one woman, so the other half is always the other sex. */
        body: t(competitor.gender === 'F' ? 'pair.endedBodyFemale' : 'pair.endedBody', {
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

  /* THE QUESTIONS STILL STANDING, read off the server (P2, 10.10.2026). A question whose other
     member is no longer named is not drawn (see `QuestionsStanding`), so what is counted here is
     what would be drawn: a panel with no pair and nothing to draw is no panel at all. While the
     read is out nothing of it is drawn, and a read that failed says so. */
  const asked =
    waiting.status === 'ready'
      ? waiting.data.pairInvites.flatMap(({ id, memberNumber, sentByMe }) =>
          memberNumber === null ? [] : [{ id, other: memberNumber, sentByMe }],
        )
      : []

  if (held.length === 0 && asked.length === 0 && waiting.status !== 'error') {
    return null
  }

  return (
    <section className="member__panel" aria-labelledby="membership-pair">
      <h2 className="profile__section" id="membership-pair">
        {t('pair.mine')}
      </h2>
      {held.map((pair) => {
        const other = pair.memberNumbers.filter((one) => one !== competitor.memberNumber).join('')
        const partner = competitors.find((one) => one.memberNumber === other)
        /* Nothing where this reader may not reach that profile, and nothing where the portal no
           longer has the member at all: one answer, because on the screen they are the same. */
        const to = partner === undefined ? undefined : linkTo(partner)

        return (
          /* A FRAGMENT AROUND THE ROW SINCE 28.09.2026, BECAUSE WHAT THE SERVER SAID CANNOT STAND
             INSIDE IT. `ServerSaid` draws `<p class="field__error" role="alert">`, and a `<p>`
             inside a `<p>` is closed by the parser rather than nested. */
          <Fragment key={pair.id}>
            <p className="profile__pair">
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
                  pair was made: it „se ne prikazuje nikome". */}
              <span className="profile__pair-since">
                {t('pair.forSeason', { season: pair.season })}
              </span>
              {/* NO „RASKINI" WHERE THE OTHER HALF IS NOT IN THE ROSTER, BECAUSE THE SERVER ANSWERS
                  IT 404 EVERY TIME (PENDING stavka 316): `PairWriteApi.pairHeIsHalfOf` asks BOTH
                  halves to be active. **The reasoning of the author of the branch that wrote it, not
                  a recorded decision**; the owner's own words about such a pair are P13,
                  11.08.2026, „Ne postoji par onda, raskida se." */}
              {partner !== undefined && (
                <>
                  {' '}
                  {/* **`aria-disabled` AND NEVER `disabled`** (`member/ProfilePicture.tsx`,
                      `event/RateEvent.tsx`): `disabled` takes the button out of the tab order, so a
                      member ending a pair by keyboard would be dropped to the top of the document
                      in the instant it is switched off. */}
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
                drawn beside it: a break the server refused has not happened. */}
            {refused !== null && refused.id === pair.id && (
              <ServerSaid
                answer={refused.answer}
                refusals={WHEN_BREAKING_A_PAIR}
                numbers={WHAT_THE_NUMBER_SAYS_WHEN_BREAKING_A_PAIR}
              />
            )}
          </Fragment>
        )
      })}
      {waiting.status === 'error' ? (
        <Unreadable said={t('data.error')} reading={waiting.reading} onRetry={waiting.readAgain} />
      ) : (
        <QuestionsStanding asked={asked} competitors={competitors} />
      )}
    </section>
  )
}

/**
 * THE REFUSALS `DELETE /api/pairs/{id}` CAN NAME, AND THERE ARE NONE.
 *
 * <p><b>Read off the route rather than remembered, and empty is what it really answers.</b>
 * `PairWriteApi.end` reaches for `nothingIsHere()` and never for `no(...)`, so the only two
 * answers that route gives are 204 and a 404 with no reason in it - and the 404 is deliberately
 * four callers at once (a pair that is not there, one that is not his, one of a season that is
 * over, one whose half has lapsed), because telling them apart would answer which pairs exist and
 * who is in them to anybody walking the keys.
 *
 * <p><b>Named as a constant rather than written `{}` at the call site</b>, so that the day the
 * route does name one there is a place for its sentence to go.
 */
const WHEN_BREAKING_A_PAIR: Record<string, string> = {}

/**
 * WHAT THAT 404 MEANS, SAID IN THE ROUTE'S OWN WORDS (PENDING stavka 316).
 *
 * <p>None of the four causes is answered by pressing again, so the portal's general sentence for a
 * 404 („pokusaj ponovo za koji minut") is advice a member who has just pressed this button can never
 * use; `ServerSaid` is handed this table and says `pair.breakRefused.notHeld` instead.
 *
 * <p><b>THE WORDS OF THAT SENTENCE ARE A PROPOSAL OF THE AUTHOR OF THE BRANCH THAT WROTE IT AND NOT
 * THE OWNER'S.</b> It is one sentence for all four causes on purpose: a sentence that named the cause
 * would be the answer to „which pairs exist and who is in them" that the bare 404 is written not to
 * give (`PairWriteApi.end`).
 */
const WHAT_THE_NUMBER_SAYS_WHEN_BREAKING_A_PAIR: Record<number, string> = {
  404: 'pair.breakRefused.notHeld',
}

/**
 * THE QUESTIONS STILL STANDING, SENT AND RECEIVED, read off the server by the panel above.
 *
 * <p>PDL, 07.09.2026: „Sopstveni profil nosi stanje: tekući trkački par sa linkom, pozive koji
 * čekaju (i poslate i primljene) i dugme „Raskini"" - which since 18.10.2026 stands on „Moja
 * članarina" (PDL P11). `GET /api/me/applications` answers both directions with `sentByMe`, names
 * the OTHER member of each by number (`MyApplicationsApi.pairInvites`), and lists them oldest first.
 *
 * <p><b>A question whose other member has let the fee lapse is not drawn</b> (derived on 10.10.2026,
 * not the owner's word, and put to him among that day's derivations): the server names nobody there,
 * and a row standing without a name would tell the member who asked that the fee of the one he asked
 * has lapsed, which section 3 of the privacy policy shuts. The panel drops those before they reach here.
 *
 * <p><b>A number the list of members does not carry is said as the number</b>, which is
 * `TeamQueue.tsx`'s answer: the two reads are made at different moments.
 *
 * <p><b>And no day</b>: PDL, 02.10.2026, „Poziv u par ne nosi datum".
 */
function QuestionsStanding({
  asked,
  competitors,
}: {
  asked: { id: number; other: string; sentByMe: boolean }[]
  competitors: Competitor[]
}) {
  const { t } = useI18n()

  if (asked.length === 0) {
    return null
  }

  const said = (number: string): string => {
    const found = competitors.find((one) => one.memberNumber === number)

    return found === undefined ? number : `${found.firstName} ${found.lastName}`
  }

  return (
    <p className="profile__pair">
      {asked.map((one) => (
        <span key={one.id} className="profile__pair-waiting">
          {' '}
          {one.sentByMe
            ? t('pair.sent', { who: said(one.other) })
            : t('pair.received', { who: said(one.other) })}
        </span>
      ))}
    </p>
  )
}
