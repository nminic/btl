import { useEffect } from 'react'
import { useParams } from 'react-router'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { combineResources, useCompetitors, useInbox, usePairs, useTeams } from '../../data/useResource'
import type { InboxLine } from '../../data/types'
import { MEMBERS, TEAMS, recordsOf } from '../admin/entityForms'
import { pairsNow } from '../../data/derive'
import { useOverlay } from '../admin/overlay'
import { InvitationAnswer } from './InvitationAnswer'
import { PairInviteAnswer } from './PairInviteAnswer'
import { ServedPairInvite } from './ServedPairInvite'
import { ServedTeamInvite } from './ServedTeamInvite'
import { NotFound } from '../NotFound'
import { Resource } from '../../components/Resource'
import { useMemberScreen } from './memberScreen'
import { theServerHasSeenThisOpened } from './inboxRead'
import './Member.css'

/* Where a subject in the header panel leads: the message, opened out, on its
 * own address that can be kept and shared (PDL P28a). Opening it is what marks
 * it read; asking someone to press a button to say they have read what is on
 * the screen in front of them is asking for nothing.
 *
 * This is the one detail screen that deliberately does NOT name the page after
 * the record it shows, so there is no <PageMeta> here. The subject of a message
 * is personal data (PDL P23), and a document title is the least private thing
 * on a computer: it goes into the browser tab, into history, into a bookmark and
 * into whatever a shared screen shows. The generic name for this address is set
 * once, in EXTRA_ADDRESSES in src/app/routes.ts. */
export function MessageDetail() {
  const who = useMemberScreen()

  /* The gate before the asking, for the reason written over `Messages.tsx`: an account that
     races for nobody is told `/api/inbox` is not there, so asking first would spend a refused
     request and hand this screen an error to draw over a sentence that is already right. */
  return who.memberNumber === null ? (
    who.instead
  ) : (
    <TheMessageAsked mine={who.memberNumber} />
  )
}

/**
 * The inbox, waited for.
 *
 * **Waited for and not read through `dataOr`, which is the opposite of what the panel in the
 * header does and for a reason that is this screen's alone:** an address that names no message
 * of this member's answers with the not found page, and „it has not arrived yet" looks exactly
 * like „there is no such message" to anything reading the list. Read with a fallback, every
 * visit to a real message would show the not found page first and correct itself after.
 *
 * **`{ reactive: false }`, and this is the one caller of `useInbox` that asks for it - out of
 * caution in front of an unresolved race, not because every reacting form was measured to
 * fail (review of PR 406, third round corrects the second's overreach here).** A caller who
 * switches here without navigating away should in principle meet the same fate as on the
 * panel - a fresh read, and this screen's own message gone if it is no longer theirs. Two
 * forms that give it that fate were built and both lost the same race, measured on
 * `teamInvite.test.tsx` (untouched, and it is right to insist on that): a `key` on this
 * element, and `useResource`'s own render-time state adjustment, an earlier draft of the
 * hook this file no longer carries. Both correctly reach `TheMessage` finding no message,
 * correctly return `<NotFound />`, and both then lose to `<NotFound />`'s own
 * `<Navigate replace>`, fired from an effect that lands OUTSIDE the click that triggered the
 * switch: `teamInvite.test.tsx` switches identity on THIS screen and immediately calls
 * `router.navigate` to a different address of its own, and both times the redirect from
 * `NotFound` won it - `Unable to find … Dunavski trkači`, a screen that was never about a
 * message at all, timing out at twenty seconds because `TeamDetail` was never even called.
 *
 * **What `useInbox` actually carries today - `owner` read only through the effect's own
 * `[name, owner]`, nothing adjusted during render - was NOT among those two, and measured
 * the same way it does not fail.** A later review of this fix ran `teamInvite.test.tsx`
 * twice with this screen reacting (34 passed, 0 failed, both times) and the whole frontend
 * package once (3396 passed, 1 failed - the one case built to require the narrower
 * behaviour below). That is a reproduced number, and an earlier draft of this comment said
 * otherwise about this exact mechanism; it does not anymore.
 *
 * **A green package is not the same claim as a closed race, which is why `{ reactive: false }`
 * stays regardless.** `NotFound.tsx` is still `<Navigate replace>` fired from an effect
 * neither this file nor `useResource` controls, and a run that does not happen to hit the
 * timing on one machine says something about that machine's scheduling, not about whether
 * the window can still open under a slower fetch, a busier event loop, or a future React.
 * Reacting here is withheld on that uncertainty, not on a measurement that it fails.
 *
 * **What makes withholding it defensible rather than a shrug.** Measured over what
 * `theServerSignedMeIn` is - the one function `member/SignIn.tsx` calls after
 * `GET /api/me` - it is reachable from exactly one screen, `/sr/prijava`, which this address
 * is not. `app/routeObjects.tsx` puts every route including that one under the same `<Outlet />`
 * `app/Shell.tsx` holds, so reaching the sign in screen and coming back BOTH unmount this
 * component - the very thing `MessagesMenu.tsx` cannot say, since it sits beside the outlet
 * and never comes down. So the shared-laptop road this increment closes (owner, 27.09.2026)
 * is closed here already, by routing, exactly as PR 406's own review measured before asking
 * for a key on this element in the first place: „the detail screen mounts again and reads
 * again." What `{ reactive: false }` does NOT close is a switch reached by calling
 * `theServerSignedMeIn` directly without going through that screen at all, which is not a
 * road production has - it is how `pictureIsOneRow.test.tsx` and this file's own
 * `inboxFromTheServer.test.tsx` reach it, on purpose, to measure the general case. That gap
 * is real, is narrower than it was, and is written down rather than hidden: closing it for
 * good needs either a change to the shared `NotFound.tsx` or a new, non-redirecting answer
 * for „not yours any more" as opposed to „never was anybody's" - both of which are product
 * decisions this increment does not carry a mandate for.
 */
function TheMessageAsked({ mine }: { mine: string }) {
  return (
    <Resource state={useInbox(mine, { reactive: false })}>
      {/* `mine` goes through as well as into the read above, and it is needed for one thing
          only: `GET /api/me/applications` is answered per caller, so the hook that reads it
          drops its cache when the caller changes and has to be told who is asking
          (`data/useResource.ts`, `useWhatIsWaiting`). Threaded rather than read again here,
          because two readings of „who is asking" on one screen is the fault this portal
          calls „dva doma jedne činjenice". */}
      {(lines) => <TheMessage lines={lines} mine={mine} />}
    </Resource>
  )
}

function TheMessage({ lines, mine }: { lines: InboxLine[]; mine: string }) {
  const { locale } = useI18n()
  const { id } = useParams()
  const { markRead, pairsMade, pairsBroken } = useSession()
  const state = combineResources(useCompetitors(), useTeams(), usePairs())
  const overlay = useOverlay()
  /* Out of the inbox rather than out of the store, so an address that names
   * somebody else's message answers with the not found page instead of showing
   * it. Whose a message is was decided before it got here: by the route's own
   * `where` clause for a served line (`InboxApi`: „his own, or everybody's"),
   * and by the provider's filter for one the browser is holding. */
  const message = lines.find((one) => one.id === id)
  /* Read out once, so the block below asks about a value rather than about a
     property: written as `message.invitation ?? ''` inside it, the fallback is a
     branch nothing can reach, and a branch nothing reaches is a branch that hides
     what it would have done. */
  const invitation = message?.invitation
  /* The same, for the one that asks about a racing pair. Two fields rather than one with a kind
     beside it, so the compiler keeps the two answers apart (`session/context.ts`). */
  const pairInvite = message?.pairInvite
  /* AND THE SAME QUESTION WHEN THE SERVER IS THE ONE HOLDING IT, which is a third field and not
     a second state of the one above. The two are answered by two different screens writing to
     two different stores, and the key is a number here against text there, so the compiler is
     what keeps them apart (`data/types.ts`, `pairInviteOnTheServer`). Read out into a value for
     the reason the two lines above give. */
  const pairInviteOnTheServer = message?.pairInviteOnTheServer
  /* AND THE FOURTH, which is the TEAM's question when the server is the one holding it. Four
     fields rather than two with a kind beside each, so the compiler keeps all four answers
     apart: the two the browser holds are text and the two the server holds are numbers, and
     each of the four reaches a different screen writing to a different store. Read out into a
     value for the reason the three lines above give. */
  const teamInvitationOnTheServer = message?.teamInvitationOnTheServer
  /* **AND OPENING IT IS THE ONLY THING THAT EVER MARKS IT, since PDL 27a (27.09.2026).** The
     owner's own narrowing: „Ne treba mi dugme da se nesto oznaci kao procitano ili
     neprocitano." There is no control for this anywhere on the portal - not on this screen and
     not on the list behind it - so this effect is the whole of the mechanism. */
  const unread = message !== undefined && !message.read
  /* **WHICH STORE the mark goes into is decided in one place and carried on the line**
     (`data/types.ts`, `readMarkIsTheServers`). Read out into a value rather than asked inside
     the effect below, for the reason the two lines above it give about `invitation`: asked as a
     property of a possibly absent record, the fallback is a branch nothing can reach. */
  const theServerKeepsThisOne = message?.readMarkIsTheServers === true

  useEffect(() => {
    if (unread && id !== undefined) {
      if (theServerKeepsThisOne) {
        /* `void`, because nothing on this screen waits for it: the message is already drawn
           and what the answer changes is a number in the header. The function refuses to ask
           twice about one key, which is what keeps this effect from a loop when the route
           refuses - `inboxRead.ts` has the measurement. */
        void theServerHasSeenThisOpened(id)
      } else {
        markRead(id)
      }
    }
  }, [unread, id, markRead, theServerKeepsThisOne])

  if (message === undefined) {
    return <NotFound />
  }

  return (
    <div className="member">
      <h1>{message.subject}</h1>

      <p className="messages__from">
        {message.from} · {formatShortDate(message.date, locale)}
      </p>

      <p className="messages__body">{message.body}</p>

      {/* The one message that asks. Everything the answer depends on is read
          when it is drawn rather than remembered on the message, so the two
          resources are loaded only for the message that has an invitation on it
          (member/InvitationAnswer.tsx). */}
      {invitation !== undefined && (
        <Resource state={state}>
          {([everybody, allTeams]) => (
            <InvitationAnswer
              invitation={invitation}
              /* Through the overlay, because the answer is held against where the
                 member is **now**: pressing „Prihvati" writes the team on their
                 record, and read off the file this screen would go on offering the
                 same button to somebody who has just used it. The two profile pages
                 read the same records for the same reason (PR 199). */
              competitors={recordsOf(MEMBERS, everybody, overlay)}
              /* And the teams through it too: a team deleted during this visit is
                 gone from the records and still in the file, and the invitation it
                 sent is answered by asking which team it was. */
              teams={recordsOf(TEAMS, allTeams, overlay)}
            />
          )}
        </Resource>
      )}

      {/* And the message that asks about a racing pair, answered the same way and from the same
          resources. The pairs are read through what this visit has made and broken, so the answer
          is held against where the two of them stand **now**: accepted once, the button is gone
          rather than offered again (`data/derive.ts`, `pairsNow`). */}
      {pairInvite !== undefined && (
        <Resource state={state}>
          {([everybody, , fromFile]) => (
            <PairInviteAnswer
              pairInvite={pairInvite}
              competitors={recordsOf(MEMBERS, everybody, overlay)}
              pairs={pairsNow(fromFile, pairsMade, pairsBroken)}
            />
          )}
        </Resource>
      )}

      {/* AND THE SAME QUESTION WHEN THE SERVER IS KEEPING IT (PDL 27b, 27.09.2026). Outside the
          `Resource` above and holding nothing but the key, which is the whole difference: the
          screen above answers by writing records this visit is holding, so it has to be held
          against every one of them, while this one hands a key to `PUT /api/pairs/{id}` and the
          route reads both halves again itself, in the transaction that makes the pair. So there
          is nothing here to wait for and no loader between the message and its buttons. */}
      {pairInviteOnTheServer !== undefined && (
        <ServedPairInvite invite={pairInviteOnTheServer} />
      )}

      {/* AND THE TEAM'S QUESTION WHEN THE SERVER IS KEEPING IT (PDL, 05.09.2026: „Poziv u tim
          prihvata pozvani član."). It has a `Resource` of its own, inside itself, which is the
          one way it differs from the pair screen above and is a fact about the two ROUTES
          rather than a choice: `PUT /api/pairs/{id}` is satisfied by the key this line
          already carries, while `PUT /api/teams/{id}/invitations/{invitation}` needs the team
          as well and no field of `GET /api/inbox` carries one. So that screen waits for
          `GET /api/me/applications`, and it waits INLINE, beside the message rather than over
          it.

          Outside the `Resource` above and holding nothing of it, for the same reason the pair
          screen stands outside: the screen above answers by writing records this visit is
          holding, so it has to be held against every one of them, while this one hands two
          keys to a route that reads everything else again itself, in the transaction that
          writes the membership. */}
      {teamInvitationOnTheServer !== undefined && (
        <ServedTeamInvite invitation={teamInvitationOnTheServer} mine={mine} />
      )}
    </div>
  )
}
