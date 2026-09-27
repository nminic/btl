import { useEffect, useMemo, useState } from 'react'
import type { DucatFamily } from './ducatRule'
import { useSession } from '../session/useSession'
import type { Message } from '../session/context'
import { arrivedResource, clearResourceCache, loadResource, type ResourceName } from './client'
import type {
  Attending,
  BtlEvent,
  Competitor,
  EventComment,
  InboxLine,
  League,
  Moderator,
  Outstanding,
  Price,
  Race,
  RacingPair,
  Result,
  ServedMessage,
  StaticPage,
  Team,
} from './types'

export type ResourceState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: Error }

/**
 * A resource, ready from the first render once this visit has already read it.
 *
 * The wait is real only the first time. Everything after it was a wait for
 * nothing: the value was in hand, and the screen still drew a loading box for a
 * render because the only way to reach the value was through a promise. What
 * that cost was not a flash but the scroll: the router puts a reader back where
 * they were as soon as the screen commits, and a screen that is one loading box
 * tall at that moment has nowhere to be put back to (owner, 04.08.2026).
 */
export function useResource<T>(name: ResourceName): ResourceState<T> {
  /* Read once, as this mounts, and never again while it is mounted.
   *
   * Once is all that is wanted: what the first render of a screen holds is what
   * decides whether the router has a page to put a scroll position back into.
   * Reading it on every render would be reading a value nothing here is
   * subscribed to.
   *
   * Which means this is written for a name that does not change, and every
   * caller passes a literal one: the nine wrappers at the foot of this file, and
   * `usePending`, which reads the queue, and `useComments`, which reads what
   * has been published and must never read the queue (see its own doc below).
   * Handed a name that changes, the first render under the new one
   * would draw the old resource's data as though it were ready, and only the
   * effect would put it right. Making that correct is not a line in the effect,
   * which runs after that render: it is the state being adjusted during the
   * render itself. Worth writing on the day a caller needs it, and not before. */
  const [state, setState] = useState<ResourceState<T>>(() => atHand<T>(name))

  useEffect(() => {
    /* Asked for even when the value is already in hand, and that is what closes
       the window: a value landing between the render and this effect is seen by
       neither, and a version of this that returned early here left the screen
       waiting for ever with nothing scheduled to take it off (there is a test for
       that, in useResource.test.tsx). `loadResource` answers from the promise it
       is already holding, so what it costs is a render nobody sees. */
    let active = true

    loadResource<T>(name).then(
      (data) => {
        if (active) {
          setState({ status: 'ready', data })
        }
      },
      (error: Error) => {
        if (active) {
          setState({ status: 'error', error })
        }
      },
    )

    return () => {
      active = false
    }
  }, [name])

  return state
}

/** What this visit already holds for a resource, as a state a screen can draw. */
function atHand<T>(name: ResourceName): ResourceState<T> {
  const known = arrivedResource<T>(name)

  return known === undefined ? { status: 'loading' } : { status: 'ready', data: known }
}

/**
 * What a resource holds, or a stand-in until it does.
 *
 * For the places that must not wait and must not turn into an error message: the
 * count beside Verification in the header sits above every screen on the portal,
 * and the list of queues has seven rows of which any one file feeds two at most.
 * A number one short is better than a header that holds up the page, or a whole
 * screen refusing to draw over a file none of its rows come from. Everywhere
 * else <Resource> is the answer, because a screen showing half its data as if it
 * were all of it is worse than a screen saying it is broken.
 */
export function dataOr<T>(state: ResourceState<T>, fallback: T): T {
  return state.status === 'ready' ? state.data : fallback
}

/** Whether a resource failed, for the screens that carry on without it and have
 *  to say so rather than quietly counting it as empty. */
export function failed(...states: ResourceState<unknown>[]): boolean {
  return states.some((state) => state.status === 'error')
}

/**
 * The failure of the first resource that has one, as a state of its own.
 *
 * Written to give back the error state rather than the state that carries it,
 * because an error state says nothing about the shape of the data that never
 * arrived: this one fits the combined type without anything being asserted
 * about it, and `find` would have handed back a state of one resource's type
 * for all three to be called (ADL A14).
 */
function firstError(
  states: ResourceState<unknown>[],
): { status: 'error'; error: Error } | undefined {
  for (const state of states) {
    if (state.status === 'error') {
      return state
    }
  }

  return undefined
}

/* One screen usually needs several resources at once, and it has to show one
 * loading state and one error, not three. Error wins over loading, because a
 * screen that is partly broken is broken. */
export function combineResources<A, B, C>(
  first: ResourceState<A>,
  second: ResourceState<B>,
  third: ResourceState<C>,
): ResourceState<[A, B, C]> {
  const failure = firstError([first, second, third])

  if (failure !== undefined) {
    return failure
  }

  if (first.status !== 'ready' || second.status !== 'ready' || third.status !== 'ready') {
    return { status: 'loading' }
  }

  return { status: 'ready', data: [first.data, second.data, third.data] }
}

/** Four of them, for the front page, which reads competitors, events, results
 *  and races. */
export function combineFour<A, B, C, D>(
  first: ResourceState<A>,
  second: ResourceState<B>,
  third: ResourceState<C>,
  fourth: ResourceState<D>,
): ResourceState<[A, B, C, D]> {
  const failure = firstError([first, second, third, fourth])

  if (failure !== undefined) {
    return failure
  }

  if (
    first.status !== 'ready' ||
    second.status !== 'ready' ||
    third.status !== 'ready' ||
    fourth.status !== 'ready'
  ) {
    return { status: 'loading' }
  }

  return { status: 'ready', data: [first.data, second.data, third.data, fourth.data] }
}

/** The same idea for the common case of exactly two resources. */
export function combinePair<A, B>(
  first: ResourceState<A>,
  second: ResourceState<B>,
): ResourceState<[A, B]> {
  const failure = firstError([first, second])

  if (failure !== undefined) {
    return failure
  }

  if (first.status !== 'ready' || second.status !== 'ready') {
    return { status: 'loading' }
  }

  return { status: 'ready', data: [first.data, second.data] }
}

/**
 * A list read from the disc with what this visit deleted taken out of it.
 *
 * The prototype has no database, so a deletion is remembered in the session and
 * every screen has to read past it. The administration's own lists always did,
 * through `recordsOf`; the public screens read the file straight and did not,
 * which nobody noticed while deleting was something only the administration
 * could do to a record only the administration showed.
 *
 * Deleting an event is not that. The owner asked for a button on the event's own
 * page that removes the event and its races (03.08.2026), and the first thing
 * anybody does after pressing it is look at the calendar. An event that is still
 * there reads as a portal that did not do what it said.
 *
 * Three of them are read this way today: the events, their races, and the
 * results, because deleting an event takes all three. Teams, leagues and the
 * rest still read the file straight on their public screens, which is the same
 * hole and is older than this; closing it properly means the whole of
 * `recordsOf` moving down here, together with what an entity is, and that is a
 * change of its own rather than a line in this one.
 */
function useLive<T>(state: ResourceState<T[]>, entity: string, idField: keyof T): ResourceState<T[]> {
  const { deletions } = useSession()
  const gone = deletions[entity]

  return useMemo(() => {
    if (state.status !== 'ready' || gone === undefined || gone.length === 0) {
      return state
    }

    return {
      status: 'ready',
      data: state.data.filter((one) => !gone.includes(String(one[idField]))),
    }
  }, [state, gone, idField])
}

export const useDucats = () => useResource<DucatFamily[]>('ducats')
/**
 * What is published under an event: what the file carries, and what a moderator
 * has let out during this visit.
 *
 * Merged here rather than at the screen, for the reason `usePending` gives about
 * proposals: one place decides what "published" means, so the event page cannot
 * disagree with the queue that published it. Without this a moderator approved a
 * comment and nothing appeared anywhere, which is the whole of what approving one
 * is for (owner, 06.08.2026).
 *
 * What it reads is the session and not the queue. Reading the queue here worked
 * and was wrong: the event page is public, so every visitor's browser fetched
 * the whole moderation queue, which carries pending members' addresses and the
 * bodies of comments nobody has approved. The queue is administration's to read;
 * what comes out of it is written down when it comes out (`publish`), and this
 * side only ever sees what was let out.
 */
export function useComments(): ResourceState<EventComment[]> {
  const state = useResource<EventComment[]>('comments')
  const { decisions, published } = useSession()

  return useMemo(() => {
    if (state.status !== 'ready') {
      return state
    }

    /* Read through the decisions rather than trusted as a list of what is out:
       a comment let out and then taken down again is a decision changed, and
       the screen must follow the change without the moderator having to be
       standing on it. */
    const letOut = published
      /* By the QUEUE ITEM it came out of and not by the comment's own identity.
         The two were one value until 20.09.2026, when a comment became something
         identified by a number (`/api/comments`) while a queue item is still
         identified by the text the file gives it; read by the comment's number
         this finds no decision at all and nothing a moderator let out is ever
         drawn. */
      .filter((one) => decisions[one.from]?.status === 'approved')
      .map((one) => one.comment)
    /* By id, because the two sides can name the same comment. Nothing does
       today: what the session hands out is numbered below nought and a
       `bigserial` never is (`SessionProvider`, `publish`). It stands for the day
       a backend hands back an approved comment under an id the file also holds,
       which the event page would otherwise draw twice with a repeated React key
       underneath. */
    const already = new Set(state.data.map((one) => one.id))

    return {
      status: 'ready',
      data: [...state.data, ...letOut.filter((one) => !already.has(one.id))],
    }
  }, [state, published, decisions])
}

export const useCompetitors = () => useResource<Competitor[]>('competitors')
export const useEvents = () => useLive(useResource<BtlEvent[]>('events'), 'events', 'id')
export const useAttendance = () => useResource<Attending[]>('attendance')
export const useLeagues = () => useResource<League[]>('leagues')
export const useModerators = () => useResource<Moderator[]>('moderators')
export const usePages = () => useResource<StaticPage[]>('pages')
/**
 * The price list, in the order the server gave it.
 *
 * **Read through no `useLive` and through no session overlay, which is what tells it
 * from the other fourteen.** Nothing on this portal deletes a row of the price list -
 * „Periodi su stalni: redovi se ne dodaju i ne brisu" (owner, 30.07.2026, PDL:827), and
 * `PricingWriteApi` has no `POST` and no `DELETE` to answer with - so there is no
 * deletion to read past. What an administrator CHANGES is held by the screen that changed
 * it and cleared out of the cache in the same breath (`admin/AdminPricing.tsx`,
 * `clearResourceCache('pricing')`), rather than laid over this as an overlay; the overlay
 * was how the price list worked until 26.09.2026, and it never reached the server at all.
 */
export const usePricing = () => useResource<Price[]>('pricing')
/**
 * WHOSE MEMBERSHIP FOR THE SEASON IS NOT ACTIVE, worked out by the server on every read.
 *
 * **Through no `useLive` and through no session overlay, and the reason is stronger here
 * than it is for the price list.** This answer is DERIVED: a row is on it because no
 * `membership` row exists for that person and that season, so there is nothing about it a
 * visit could hold that would still be true. An overlay would be the portal remembering a
 * decision, and the whole of the owner's decision of 27.09.2026 is that there is no
 * decision to remember - „Reda za verifikaciju uplate NEMA". The screen writes to the
 * route, clears this name, and reads the derived answer again.
 *
 * **It is the whole answer and not the list**, because the season is on the answer rather
 * than on any row (`Outstanding`). A hook that unwrapped it to the array here would throw
 * the season away and force the screen to work the year out for itself, which is the one
 * thing `data/season.ts` cannot do correctly.
 */
export const usePaymentsDue = () => useResource<Outstanding>('payments')
export const useRaces = () => useLive(useResource<Race[]>('races'), 'races', 'id')
/** What a deletion of results is filed under. Named here, where the results
 *  are read, rather than spelled out at the screen that deletes them. */
export const RESULTS = 'results'

/**
 * The counted results, as they stand at this moment of this visit.
 *
 * Two layers over the file, and both are the session's: what has been taken back
 * (`useLive`), and what a moderator has agreed to change.
 *
 * The second arrived on 28.08.2026 with the owner's choice about a correction: the
 * old result stays in the standing while the correction waits, and changes when
 * somebody agrees with it (PDL, inkrement 132). Until then the result left the
 * standing the moment the correction was sent, so a refusal lost the points for
 * good.
 *
 * Here rather than on the screen that draws it, for the reason `useLive` gives
 * about deletions: the standing, the profile, the boards and the league all read
 * this one function, and a correction that reached one of them and not the others
 * would be a portal disagreeing with itself about who ran what.
 *
 * By identity, so the corrected record takes the place of the one it replaces
 * rather than standing beside it, and so a result corrected twice in one visit is
 * still one result.
 */
export const useResults = (): ResourceState<Result[]> => {
  const live = useLive(useResource<Result[]>('results'), RESULTS, 'id')
  const { corrected } = useSession()

  return useMemo(() => {
    if (live.status !== 'ready' || Object.keys(corrected).length === 0) {
      return live
    }

    return { status: 'ready', data: live.data.map((one) => corrected[one.id] ?? one) }
  }, [live, corrected])
}
export const usePairs = () => useResource<RacingPair[]>('pairs')
export const useTeams = () => useResource<Team[]>('teams')

/**
 * WHOEVER THE INBOX IN THE CACHE WAS FETCHED FOR, kept beside the cache rather than
 * inside any one component.
 *
 * **This is the one resource whose answer differs per caller, and the cache above is keyed
 * by name with nobody in the key** (`data/client.ts` says so in its own words). What makes
 * that a fault rather than a note is measured: signing out and in again happens IN PLACE.
 * `AccountMenu` calls `signOutOfTheServer()` and `signOut()`, `SignIn` calls `signInWith`
 * and `navigate`, and not one of the four reloads the page - so one visit can hold two
 * different people, and a cache keyed by name alone would hand the second one the first
 * one's mail.
 *
 * Module scope and not a ref, because two components read this list at once - the panel in
 * the header and the screen behind it - and a ref each would mean two of them deciding to
 * drop the same cache, which throws away the request the other one had already started.
 * One home, one decision, one request.
 *
 * **AND THE LIMIT, because this closes one of the two things it could have closed.** The same
 * member signing out and back in within one visit is served what the visit already fetched:
 * nothing calls this while nobody is signed in, so the name it holds does not change and the
 * answer is not dropped. That is the portal's own rule for all seventeen names („One request
 * per resource per visit", `data/client.ts`) rather than anything about this one, and what is
 * closed here is the half that is not a staleness but a LEAK: one caller's mail reaching the
 * next. `pages/member/inboxFromTheServer.test.tsx` says which of the two each of its cases
 * measures.
 */
let inboxAnsweredFor: string | undefined

/**
 * Drops the answer the moment it stops being this caller's.
 *
 * Called while rendering rather than from an effect, and that is the whole point: an effect
 * runs AFTER the render that read the cache, so the first paint after signing in as
 * somebody else would draw their predecessor's subjects and then correct itself. There is
 * nothing to correct if the answer is gone before it is read.
 */
function theInboxNowBelongsTo(whose: string): void {
  if (inboxAnsweredFor !== whose) {
    inboxAnsweredFor = whose
    clearResourceCache('inbox')
  }
}

/**
 * THE INBOX: WHAT THE SERVER HAS KEPT, AND THEN WHAT HAS BEEN SAID DURING THIS VISIT.
 *
 * **The shape is `event/GoingToEvent.tsx`'s, word for word - „what the file says, and then
 * what has been said during this visit" - and it is here rather than there because three
 * screens read it.** The server is the source: seven routes in `backend/src/main` write
 * into `message`, and until today not one of their rows was ever drawn. The nine screens
 * that call `notify` still write nowhere but the browser, so leaving them out would take a
 * team's invitation, a pair's invitation and a moderator's reason off the one screen a
 * member can answer them on - and no route carries any of the three.
 *
 * **Why two sources cannot show one message twice, measured rather than hoped.** The one
 * pair that could collide is a moderator's decision: `PendingQueue` posts it to
 * `/api/verification/{id}/decision`, which writes the row, AND calls `notify` beside it.
 * Nothing clears this resource after that write, so the served list a visit holds is the
 * one it fetched when the panel first mounted and the new row is not in it; on the next
 * visit the browser's copy is gone and only the served row is left. So the member sees it
 * once either way, and the day something does clear this name after a decision, that is
 * the day the `notify` beside it goes.
 *
 * **Newest first, and the served half's own order is not touched.** `InboxApi` orders by
 * `sent_at desc, m.id desc`, and what leaves the server is the calendar DAY - the time is
 * gone - so sorting the two halves together on the day would shuffle everything the server
 * sent on one day into an order it did not choose. Sorted on the day alone with a STABLE
 * sort, two messages of one day keep the order they arrived in, which for the served half
 * is the server's.
 */
export function useInbox(mine: string): ResourceState<InboxLine[]> {
  const { inbox: held } = useSession()

  /* **WHOSE MAIL IS AN ARGUMENT AND NOT SOMETHING THIS HOOK WORKS OUT, and that is a
     measurement rather than a preference.** Written as „read `signedIn` and answer nothing
     where it names no member", the second half was a branch NOTHING COULD REACH: all three
     callers gate on the same fact before they draw the part that asks (`Messages.tsx` says
     why), so the hook is only ever called for somebody the league has given a number. A
     branch nothing reaches is a branch that hides what it would have done, and the coverage
     floor of 100 per cent on branches is what says so out loud.

     So the caller hands over the number it already holds - `who.memberNumber` on the two
     screens, `signedIn.memberNumber` in the panel - and the signature is what keeps the
     question from being asked twice and answered two ways. */
  theInboxNowBelongsTo(mine)

  const served = useResource<ServedMessage[]>('inbox')

  return useMemo(() => {
    if (served.status !== 'ready') {
      return served
    }

    return { status: 'ready', data: newestFirst([...held.map(asALine), ...served.data.map(asServed)]) }
  }, [served, held])
}

/** A record the browser is holding, as a line. Its read mark is the portal's own, because
 *  for it the portal IS the store. */
function asALine(one: Message): InboxLine {
  return {
    id: one.id,
    from: one.from,
    subject: one.subject,
    body: one.body,
    date: one.date,
    read: one.read,
    invitation: one.invitation,
    pairInvite: one.pairInvite,
    canBeMarkedRead: true,
  }
}

/**
 * A row the server answered, as a line.
 *
 * `String(...)` on the key and not the other way about, because the address of one message
 * is text and a number put through `Number(id)` would answer `NaN` for every key the
 * browser's own half holds.
 *
 * **AND THE TWO QUESTION KEYS DO NOT COME ACROSS, which is a refusal and not an oversight.**
 * `GET /api/inbox` answers `teamInvitationId` and `pairInviteId`, and the routes that answer
 * such a question exist too - `PUT /api/teams/{id}/invitations/{invitation}` and
 * `PUT /api/pairs/{id}`. What does not exist is any screen that calls either: measured
 * 27.09.2026, the only write the frontend sends anywhere near them is `POST /api/teams` from
 * `member/ProposeTeam.tsx`, and `InvitationAnswer` answers by looking the invitation up in the
 * session's own `invitations` and writing the member's record there.
 *
 * So handing a served key to that screen would not leave it short of a button - it would make
 * it say something false. `InvitationAnswer` treats an invitation it cannot find as one that is
 * OVER („teams.inviteClosed", and the file says why in its own words), so a member would be told
 * a question was closed while `team_invitation` on the server still held it open. Absent, the
 * message is drawn as what it is - a subject, a sender and a body - and nothing is claimed about
 * an answer. **That leaves a served invitation unanswerable on this portal, which is the boundary
 * this increment ends on and not something it hides.**
 */
function asServed(one: ServedMessage): InboxLine {
  return {
    id: String(one.id),
    from: one.from,
    subject: one.subject,
    body: one.body,
    date: one.date,
    read: one.read,
    /* NO ROUTE WRITES `message_read`. Measured 27.09.2026: `backend/src/main` maps
       `GET /api/inbox` and `POST /api/inbox` and nothing else on this resource, and the
       second sends a message rather than marking one read. See `InboxLine` for what the
       screens do with that. */
    canBeMarkedRead: false,
  }
}

/** Sorted on the day, stably, so that whatever order each half arrived in survives inside
 *  a day. `localeCompare` is not needed and would be wrong: these are ISO days, where
 *  plain string order IS date order. */
function newestFirst(lines: InboxLine[]): InboxLine[] {
  return [...lines].sort((left, right) => (left.date < right.date ? 1 : left.date > right.date ? -1 : 0))
}
