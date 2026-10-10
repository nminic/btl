import { useMemo } from 'react'
import type { PendingItem, ServedPendingItem, WaitingRun } from '../../data/types'
import { NO_RATING } from '../../data/types'
import { WHOLE } from '../../components/crop'
import { useResource, type ResourceState } from '../../data/useResource'
import type { Decisions } from '../../session/context'
import { useSession } from '../../session/useSession'

/* What is waiting in the five queues `/api/verification` answers for.
 *
 * Results are among them since R1 of the results flows. Until then a competitor's
 * result waited in the browser's session and nowhere else, so the moderator's queue,
 * its counters and the decision all lived there too, and a decision taken in one
 * browser was a decision nobody else ever heard of. The server answers a waiting run
 * with the run itself now (`useWaitingRuns` below).
 *
 * Payments were not here either, and are now. A membership waiting to be
 * activated used to be read off the list of members, as the member who was not
 * active yet. It cannot be any more: a member number is handed out the moment the
 * fee is recorded (PDL P8, 30.07.2026), so somebody who has not paid has no
 * number, and without one they are not a row in the member list at all. They are
 * a registration waiting for a decision, which is what this file holds.
 *
 * That also keeps them off every public screen by construction rather than by
 * remembering to filter: three of them used to be on the front page under the
 * newest members, with numbers they should never have had, because everything
 * that reads the member list reads all of it (PDL P8, P11).
 *
 * One shape for all five, with every field always present and empty where it
 * does not apply. The alternative is five shapes and a screen that asks which
 * one it is holding, to show the same three lines either way.
 */
/**
 * Everything waiting for a decision: what is on the disc, and what this visit
 * has added to it.
 *
 * A competitor may propose a team, and a proposal is not a different kind of
 * thing from the teams already in the queue. Merged here rather than at each of
 * the five screens, so the counters in the navigation, the queue itself and the
 * door that decides whether a section is empty all count the same items. One of
 * the three forgetting to merge is a moderator who is told there is nothing
 * waiting on a screen that is about to show them something.
 */
/** The family the queue's own waiting items are filed under in the overlay.
 *  Not an `EntityDef`: nothing serves a waiting item as a record, and its identity
 *  is the text the file gives it rather than a number out of a sequence. */
export const WAITING = 'waiting'

/**
 * ONE WAITING ITEM AS THE SCREEN NEEDS IT, out of the one the server gives.
 *
 * **The six it fills are not invented, they are the portal's own word for „not
 * here".** `PendingItem` says it of itself - „One shape for all seven, with every
 * field always present and empty where it does not apply" - and every queue has
 * always carried the five or six that are not its own as empty. What is new is only
 * that the emptiness now arrives from this side, because the server has nowhere to
 * read these six from (`ServedPendingItem` names each one and why).
 *
 * **The absent values are the ones the portal already reads as absent**, and never a
 * plausible-looking stand-in: `NO_RATING` is „nobody has given a mark", which the card
 * draws with the event page's own words for a comment nobody marked, and `WHOLE` is what
 * `cropIn` returns for a record with no square of its own. Three of the six are held to
 * that by a case; `crop` is `WHOLE` and cannot be, which is the paragraph at the bottom
 * of this one, and `currentDate`/`proposedDate` need no case at all any more - see below.
 *
 * **`picture` is the empty string, and it is STILL NOTHING READS IT, past the day this
 * paragraph expected that to change.** It mattered while the card asked
 * `one.picture !== ''` before drawing a frame: left undefined - which is what reading a
 * field the answer has not got gives you - that test passed and the frame was drawn
 * around nothing, so the emptiness had to be a VALUE. That drawing is gone, and
 * `admin/PendingQueue.tsx` carries the whole of why in the comment where it stood: the only
 * thing that ever filled this was the row `member/ProfilePicture.tsx` minted in the session
 * beside the server's, and that twin went with the fault it caused.
 *
 * **The number of the picture IS served out to the screen now, and the frame DID come
 * back (`photoId` below; ADL A60 dopuna 27.09.2026, PR 399/400;
 * `admin/PendingQueue.tsx`'s `WaitingPicture`) - and this field gained no reader even
 * so, because the frame has nothing to read it FOR.** It is fed straight from the
 * address `photoId` names (`GET /api/verification/{id}/photo`), never from a literal
 * the item itself might carry, so a second source read ahead of that address would be
 * two roads to one picture answering a question nobody asked - „which wins" - which is
 * exactly the class of fault this portal has been measuring against all week. **Checked
 * rather than assumed before this sentence was written:** both callers of `propose`
 * (`pages/member/ProfileBio.tsx`, `pages/member/EditTeam.tsx`) send `picture: ''`, and
 * `ServedPendingItem` omits the field outright - two producers, and neither has ever
 * written anything else. So this field goes on being written and never read, which
 * stays a loose end named here on purpose rather than solved in passing: `crop` below
 * it is in the identical position, for a related but separate reason of its own.
 *
 * **It fills what is missing rather than overwriting what is there, and the
 * difference is not academic.** The answers this portal is fed do not all come off
 * `VerificationApi`: the file under `public/mock` is a richer stand-in and is what
 * every screen case is driven by, so a queue whose fields the server cannot reach is
 * still exercised end to end there. Blanking them would take real cases over the
 * owner's own decisions - the address a registration is known by (PDL P8) and the
 * marks a comment carries (PDL P6) - and leave nothing measuring them.
 *
 * **What keeps that from being a lie is that the gap is measured elsewhere and not
 * excused here**: `ServedPendingItem` names `picture`, `crop` and `email` and why the
 * schema cannot reach them, `servedShape.test.ts` holds the declared answer against
 * `PendingItem` and prints exactly these three as the difference, and `PENDING.md`
 * carries each with the table that has nowhere to hold it. A screen fed by the server
 * shows them empty today, and that is a decision the owner has yet to take rather than
 * something this function hides.
 *
 * **AND `picture`, `email` AND `rating` ARE MEASURED ON A SCREEN, which they were not
 * until 22.09.2026 and which is why the paragraph above could have said anything it
 * liked.** Every moderation case is fed `public/mock/verification.json`, and that file
 * carries all three with values of its own, so nothing here decided anything and any
 * value at all was green. `data/theRealAnswer.test.tsx` walks the queue screens
 * through the answer the server really gives, and each of the three set to something
 * plausible instead of empty turns exactly one case red.
 *
 * **`crop` HAS NO READER AT ALL, and that is written here rather than left to be
 * found.** Measured the same day `picture`/`email`/`rating` were: `crop` set to a
 * quarter of the picture leaves every case green. The one thing that read it was
 * `CropWindow`, drawn on a card until 27.09.2026 - so while ADL
 * A60 kept a waiting picture out of every address the portal could ask for it at,
 * there was nothing for a square to be a square OF. It is `WHOLE` because that is what
 * `cropIn` answers for a record with no square of its own.
 *
 * **THE DAY A60 WAS REVISITED THIS BOUNDARY DID NOT GO WITH IT, and the sentence that
 * used to stand here saying it would was a guess rather than a measurement.**
 * `PhotoApi.waitingOn`'s own comment settles why, and it is a decision the route forces
 * rather than a style this screen chose: the moderator is shown the WHOLE original and
 * never the member's circle - „the circle is the MEMBER's choice... not part of the
 * one being taken here" - so the route carries no crop for this caller to draw one
 * from. `admin/PendingQueue.tsx` therefore draws a plain picture and never
 * `CropWindow`, `crop` stays exactly as unread as it always was, and this paragraph is
 * corrected rather than left standing to tell the next reader to go finish it.
 *
 * **`currentDate` AND `proposedDate` ARE THE OTHER TWO, AND THEY ARE NOT AN OPEN
 * QUESTION LIKE THE REST.** Both answered for real off the schedule tab, from V30
 * until PDL P10a, 22.09.2026 took the tab away the same day: „Redova je pet, ne šest."
 * Where `picture`, `email` and `crop` wait on a decision the owner may yet take, these
 * two wait on nothing - the queue that would carry a value for either is gone, not
 * merely unbuilt - so the case that once proved the fill-in inert
 * (`draws both days of a reported change of term now that the server answers them`)
 * left with the tab it was about rather than standing here proving a permanent blank.
 */
const ABSENT = {
  picture: '',
  crop: WHOLE,
  currentDate: '',
  proposedDate: '',
  rating: NO_RATING,
  email: '',
}

function itemFrom(served: ServedPendingItem): PendingItem {
  /* WHAT DID NOT ARRIVE IS FILLED IN; WHAT DID ARRIVE WINS. The spread order is the
     whole rule and it is written this way round on purpose: the day the server starts
     answering one of the six, nothing here changes and the value simply comes through.
     Written the other way round, this file would have to be edited to stop overwriting
     a field that had just been decided, and nothing would fail if somebody forgot. */
  return {
    ...ABSENT,
    ...served,
    id: String(served.id),
    /* NORMALISED HERE RATHER THAN TRUSTED FROM THE SPREAD ABOVE, and that is a
       measurement and not caution for its own sake. `test/setup.ts` answers most
       cases straight off `src/test/mock/verification.json`, a file written before
       this name existed, so `served.photoId` arrives `undefined` there - a state the
       type `number | null` denies and the real server never sends. Read past the
       `?? null`, `undefined !== null` is true and `WaitingPicture` would try the
       address on every card the default harness draws, photograph or not. Written
       the identical way `memberNumber` further below already is, for the same
       reason: what the server never omits is still made proof against a harness
       that predates it. */
    photoId: served.photoId ?? null,
    /* AND THE TWO NAMES THE SERVER ANSWERS IN ANOTHER SORT, which is a different thing
       from the six above and is why they are written after the spread rather than
       before it: those are absent, these arrive and arrive as something else.

       The number is text here because a waiting item is also made up during a visit
       and never came out of a sequence. The member number is text OR NOTHING there
       (`ServedPendingItem` says why twice over) and is always text here, and the empty
       string is the portal's own word for the nothing: „Who sent it in, or empty"
       (`PendingItem.memberNumber`), with PDL P10 and the decision of 30.07.2026 for
       the two ways of there being nobody.

       **IT HAS TO BE TURNED HERE AND NOWHERE ELSE.** `canSendBack` refuses to hand an
       item back where there is no member to hand it to, and it asks
       `item.memberNumber !== ''` - which a null PASSES. What is on the other side of
       that door is not a missing name on a card: an empty recipient in this portal is
       the WHOLE LEAGUE (`session/context.ts`, `Message.to`), so a refusal addressed to
       null would either reach nobody or, one instruction away, reach everybody. The
       comment over that door has said since it was written that this is „exactly the
       kind of safety that lasts until the backend hands over the first row that does
       not" carry a number, and this is that row. */
    memberNumber: served.memberNumber ?? '',
  }
}

export function usePending(): ResourceState<PendingItem[]> {
  const state = useResource<ServedPendingItem[]>('verification')
  const { proposals } = useSession()

  return useMemo(
    () =>
      state.status === 'ready'
        ? { status: 'ready', data: [...state.data.map(itemFrom), ...proposals] }
        : state,
    [state, proposals],
  )
}

/**
 * THE RUNS WAITING IN THE RESULTS TAB, out of the same answer every other tab is read from.
 *
 * <p><b>The same resource and not a second request</b>: `usePending` above and this read one
 * `verification` answer, which the data layer keeps for the visit, so the number beside the
 * tab, the number in the header and the table cannot be counted off two different answers.
 * What this adds is only the run each item carries (`WaitingRunFields`), which `PendingItem`
 * has no place for because nothing a visit proposes is a run (`data/types.ts` says why).
 *
 * <p>No proposals are merged in, for the same reason: the results tab is fed by the server
 * alone, and a session holds no run a moderator could decide.
 */
export function useWaitingRuns(): ResourceState<WaitingRun[]> {
  const state = useResource<ServedPendingItem[]>('verification')

  return useMemo(
    () =>
      state.status === 'ready'
        ? { status: 'ready', data: state.data.filter((one) => one.queue === 'results').map(runFrom) }
        : state,
    [state],
  )
}

/** One waiting run: the item as every tab reads it, and the eight names of its run taken
 *  across by name rather than by a spread, so the type says what the screen holds. */
function runFrom(served: ServedPendingItem): WaitingRun {
  const { raceId, raceDate, raceKind, distanceKm, ascentM, descentM, seconds, link } = served

  return {
    ...itemFrom(served),
    raceId,
    raceDate,
    raceKind,
    distanceKm,
    ascentM,
    descentM,
    seconds,
    link,
  }
}

/** Everything in one queue that nobody has decided on yet. The queues screen,
 *  the counters and the navigation all count through this, so they cannot
 *  disagree. Generic so the results tab, which holds runs, keeps them as runs. */
export function waitingIn<T extends PendingItem>(items: T[], decisions: Decisions, queue: string): T[] {
  return items.filter((one) => one.queue === queue && decisions[one.id] === undefined)
}

/* A decision about a membership fee used to be remembered under a key of its own,
 * "pay-000012", because the queue was read off the member list and a member
 * number and the id of an item from this file shared one record: 000012 must
 * never have meant two things. A registration now carries an id from the same
 * file as everything else, so there is nothing left to keep apart and the key is
 * the id, on all five queues alike. */
