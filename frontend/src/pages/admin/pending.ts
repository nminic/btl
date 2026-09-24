import { useMemo } from 'react'
import type { PendingItem, ServedPendingItem } from '../../data/types'
import { NO_RATING } from '../../data/types'
import { WHOLE } from '../../components/crop'
import { useResource, type ResourceState } from '../../data/useResource'
import type { Decisions } from '../../session/context'
import { useSession } from '../../session/useSession'

/* What is waiting in the six queues that are read from a file.
 *
 * Results are the seventh and are not here: a competitor sends those in during
 * the visit, so they live in the session.
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
 * One shape for all seven, with every field always present and empty where it
 * does not apply. The alternative is seven shapes and a screen that asks which
 * one it is holding, to show the same three lines either way.
 */
/**
 * Everything waiting for a decision: what is on the disc, and what this visit
 * has added to it.
 *
 * A competitor may propose a team, and a proposal is not a different kind of
 * thing from the teams already in the queue. Merged here rather than at each of
 * the seven screens, so the counters in the navigation, the queue itself and the
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
 * **`picture` is the empty string and this is the one that matters**, because the
 * card asks `one.picture !== ''` before it draws a frame. Left undefined - which is
 * what reading a field the answer has not got gives you - that test passes and the
 * frame is drawn around nothing. The emptiness has to be a VALUE.
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
 * quarter of the picture leaves every case green. The one thing that reads it is
 * `CropWindow`, and a card only draws that where `one.picture !== ''` - so while ADL
 * A60 keeps a waiting picture out of every address the portal could ask for it at,
 * there is nothing for a square to be a square OF. It is `WHOLE` because that is what
 * `cropIn` answers for a record with no square of its own, and the day A60 is
 * revisited the two come back together and this boundary goes with them.
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

function itemFrom({ photoId: _photoId, ...served }: ServedPendingItem): PendingItem {
  /* WHAT DID NOT ARRIVE IS FILLED IN; WHAT DID ARRIVE WINS. The spread order is the
     whole rule and it is written this way round on purpose: the day the server starts
     answering one of the six, nothing here changes and the value simply comes through.
     Written the other way round, this file would have to be edited to stop overwriting
     a field that had just been decided, and nothing would fail if somebody forgot. */
  return {
    ...ABSENT,
    ...served,
    id: String(served.id),
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

/** Everything in one queue that nobody has decided on yet. The queues screen,
 *  the counters and the navigation all count through this, so they cannot
 *  disagree. */
export function waitingIn(
  items: PendingItem[],
  decisions: Decisions,
  queue: string,
): PendingItem[] {
  return items.filter((one) => one.queue === queue && decisions[one.id] === undefined)
}

/* A decision about a membership fee used to be remembered under a key of its own,
 * "pay-000012", because the queue was read off the member list and a member
 * number and the id of an item from this file shared one record: 000012 must
 * never have meant two things. A registration now carries an id from the same
 * file as everything else, so there is nothing left to keep apart and the key is
 * the id, on all six queues alike. */
