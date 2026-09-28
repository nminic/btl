import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { DucatFamily } from './ducatRule'
import { useSession } from '../session/useSession'
import type { Message } from '../session/context'
import {
  addressOf,
  arrivedResource,
  clearResourceCache,
  loadResource,
  type ResourceName,
} from './client'
import { useI18n } from '../i18n/useI18n'
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
 *
 * @param owner **Written the day a caller needed it, which is `useInbox` and no other**
 * (review of PR 406). Fourteen callers never pass this and are exactly as they were: every
 * one of them reads a resource whose answer is the same for anybody asking, so there is
 * nobody it could be owned by. `useInbox` is the one resource whose answer differs per
 * caller (its own doc says so), and the owner it passes is the member asking - except on
 * `member/MessageDetail.tsx`, which asks `useInbox` for `{ reactive: false }` and so never
 * changes this hook's owner at all; its own doc has the measurement of why.
 *
 * **Read by the effect below, not adjusted here during the render.** A version that also
 * reset `state` the moment `owner` changed - during the render itself, before the effect
 * even runs - was written first, on the theory that a render showing the previous owner's
 * answer for one frame was worth closing on its own. Measured against every case this
 * change has (`inboxFromTheServer.test.tsx`): none of them can tell the two apart, because
 * `act` already carries a click through the effect and the fetch it starts before handing
 * control back, so by the time a case reads anything the effect has already run either way.
 * A guard that cannot be told from its own absence is not a guard (ADL A2), so the simpler
 * form is what stayed; naming the one-frame case this does not independently cover is more
 * honest than a `useState` nothing here exercises.
 *
 * **Two forms that DID fail on `teamInvite.test.tsx` with `MessageDetail.tsx` reacting,
 * kept apart from what this file actually runs so the next reader does not reach for a
 * mechanism already measured against the wrong one.** A `key` on the caller was tried first
 * (review of PR 406, second round): it forces a fresh read by tearing the whole subtree
 * down, `MessageDetail.tsx`'s `useCompetitors`/`useTeams`/`usePairs`/`useOverlay` included.
 * The render-time state adjustment described two paragraphs up - an earlier draft of this
 * very hook - was tried next. Both reached `TheMessage` finding no message, both correctly
 * returned `<NotFound />`, and both lost to it: `NotFound`'s own `<Navigate replace>` fired
 * from an effect that can land after a DIFFERENT navigation the caller already started
 * (`router.navigate` to the team page, in that file), and the router heard the redirect
 * last - three cases, same twenty second timeout, `TeamDetail` never called, both times.
 *
 * **What ships today - `owner` read only through this effect's `[name, owner]`, nothing
 * adjusted during render at all - is neither of those two, and a later review of this fix
 * measured it separately rather than carrying the verdict over: with `MessageDetail.tsx`
 * reacting, `teamInvite.test.tsx` ran twice at 34 passed, 0 failed, and the whole frontend
 * package once at 3396 passed, 1 failed - the one case built to require the narrower
 * behaviour `member/MessageDetail.tsx` still chooses.** An earlier draft of this doc
 * attached the first two mechanisms' failure to this one; that was wrong about which
 * mechanism it was describing, and is corrected here rather than left for the next reader
 * to disprove again.
 *
 * **That green run is not the same claim as a closed race, and is not why
 * `member/MessageDetail.tsx` still opts out.** `NotFound.tsx` is still `<Navigate replace>`
 * fired from an effect nothing here controls; a package that does not happen to hit this
 * timing on one machine says something about that machine's scheduling, not about whether
 * the window can still open under a slower fetch or a busier event loop. The doc on
 * `TheMessageAsked` has the full measurement and names what closing that gap for good
 * would need.
 *
 * @param revision **Written the day the portal gained a write that changes what a resource
 * ALREADY MOUNTED would answer, which is `POST /api/inbox/{id}/read` and no other** (PDL 27a,
 * 27.09.2026). `clearResourceCache` on its own drops the promise and says nothing to anybody
 * holding a state that came out of it: the panel in the header never unmounts while somebody
 * is signed in (`app/Shell.tsx` keeps it beside the outlet), so the envelope would have gone
 * on drawing the count it read at mount until the next sign in. Bumping this is what asks
 * again.
 *
 * **Optional, and the fifteen callers that do not pass it are byte-for-byte as they were**:
 * `undefined` on every render is one dependency that never changes, which is the same
 * nothing they had before this parameter existed. That is deliberate - the alternative
 * considered was making `clearResourceCache` itself notify every mounted reader, and it was
 * refused for its blast radius: `admin/AdminMembers.tsx` alone clears eight names in one
 * breath, and turning each of those into a re-read of a mounted screen is a change to every
 * administrative flow on the portal in a branch about an envelope.
 */
export type HowToRead = {
  owner?: string
  revision?: number
  /**
   * The language to ask this resource for, absent on the fourteen that have no language.
   *
   * <p>It reaches the address through `client.ts`'s `addressOf` and reaches the effect below
   * through that same address, so the language that is FETCHED and the language the effect
   * re-runs FOR are one value read once. Written as one field rather than as a language here
   * and an owner there for exactly that reason: those were the two halves the review of
   * 28.09.2026 named as the shape that tells each half and never tells the join.
   */
  language?: string
}

export function useResource<T>(name: ResourceName, how: HowToRead = {}): ResourceState<T> {
  const { owner, revision, language } = how

  /* THE ADDRESS, WHICH IS WHAT THIS HOOK IS REALLY ABOUT, and the effect's dependency
     instead of `name`. For the fourteen names that pass no language it IS the name, one for
     one (`/api/<name>`), so nothing about them moves; for `pages` it is what makes a reader
     who switches language ask again, because the address he is on is not the address he had.
     Read from `client.ts` rather than built here, so there is no second place that decides
     what a language does to an address. */
  const address = addressOf(name, language)
  /* Read once, as this mounts, and never again while it is mounted - UNLESS `owner` or
   * `revision` changes, which the effect below now also answers to.
   *
   * Once is all that is wanted: what the first render of a screen holds is what
   * decides whether the router has a page to put a scroll position back into.
   * Reading it on every render would be reading a value nothing here is
   * subscribed to. */
  const [state, setState] = useState<ResourceState<T>>(() => atHand<T>(name, language))

  useEffect(() => {
    /* Asked for even when the value is already in hand, and that is what closes
       the window: a value landing between the render and this effect is seen by
       neither, and a version of this that returned early here left the screen
       waiting for ever with nothing scheduled to take it off (there is a test for
       that, in useResource.test.tsx). `loadResource` answers from the promise it
       is already holding, so what it costs is a render nobody sees. */
    let active = true

    loadResource<T>(name, language).then(
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
    /* `address` and not `name`: it carries the name and the language together, and for the
       fourteen callers that pass no language the two are the same value in a different sort.
       `language` is read inside and is not listed, which the linter would otherwise ask for -
       it cannot change without `address` changing, because `address` is built from it. */
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [address, owner, revision])

  return state
}

/** What this visit already holds for a resource, as a state a screen can draw. */
function atHand<T>(name: ResourceName, language?: string): ResourceState<T> {
  const known = arrivedResource<T>(name, language)

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
/**
 * THE WRITTEN PAGES, IN THE LANGUAGE OF THE ADDRESS THE READER IS ON.
 *
 * <p><b>The only one of the seventeen that asks for a language, and the day it started is
 * 28.09.2026.</b> `GET /api/pages?lang=en` has answered in English since V43 put the words in
 * the tables, and this portal sent no parameter at all, so every reader on `/en` was served
 * the SERBIAN rulebook, terms of use and privacy policy. Measured before the change on
 * `/en/uslovi-koriscenja`: `/api/pages` asked for with no parameter, „Uslovi korišćenja"
 * drawn, and `document.documentElement.lang` saying `en` over every word of it - which
 * `i18n/config.ts` names as the one thing that must not happen, „`lang="en"` over Serbian
 * text makes a screen reader read it with English phonetics, which is unintelligible".
 *
 * <p><b>Why the locale of the ADDRESS and not `dictionaryLocale(locale)`.</b> Those two
 * answer different questions and `PageApi` says so in as many words: that table knows „the
 * language of a SWITCH", and what is wanted here is the language the reader ASKED FOR. The
 * server decides what it can answer with and says which language each page really came back
 * in, per page; asking in the dictionary's language instead would hand the server an answer
 * it had already worked out, and would ask in Serbian for a locale that has a translation of
 * the pages but not of the interface.
 *
 * <p><b>What happens to a page that has no translation is the owner's decision and not this
 * hook's</b> (ADL, 18.09.2026, his own choice among outcomes he was priced: „Kad prevoda nema,
 * vraca se na srpski, BEZ napomene. Citalac uvek dobije tekst i portal nema rupu"). So nothing
 * here checks, nothing falls back and nothing apologises: the route serves the original whole
 * (`PageApi.pagesIn`, „whole or nothing") and the screen draws what came. The one thing the
 * screens do add is the `lang` attribute of the element the words are drawn in, read off the
 * page's own `language` field - which is not a notice to anybody, and is what keeps that
 * decision from being read aloud in the wrong phonetics.
 */
export function usePages(): ResourceState<StaticPage[]> {
  const { locale } = useI18n()

  return useResource<StaticPage[]>('pages', { language: locale })
}
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
 * HOW MANY TIMES THE SERVER'S OWN ANSWER ABOUT THIS INBOX HAS STOPPED BEING TRUE.
 *
 * <p><b>Module scope and beside {@link inboxAnsweredFor}, for the reason written over it</b> -
 * two components read this list at once and one home means one decision. The difference
 * between the two is which question they answer: that one says „this answer is somebody
 * else's", this one says „this answer is his and is out of date".
 *
 * <p><b>Why a number rather than dropping the cache alone.</b> `clearResourceCache('inbox')`
 * throws the promise away, and a component that already put the old answer into its own
 * `useState` never hears about it. The panel in the header is exactly that component: it
 * stands beside the outlet in `app/Shell.tsx` and does not come down while somebody is signed
 * in, which is the very thing `MessagesMenu.tsx` says about itself in its own words. So the
 * count would have fallen on the next sign in and not on the reading.
 */
let inboxRevision = 0

/** Everybody currently drawing this inbox. A `Set`, so the same listener subscribing twice
 *  is one listener, and so unsubscribing is by identity rather than by index. */
const whoIsDrawingTheInbox = new Set<() => void>()

/**
 * THE INBOX HAS CHANGED ON THE SERVER, SAID BY WHOEVER CHANGED IT.
 *
 * <p>Called by `pages/member/inboxRead.ts` once the route has answered, and deliberately not
 * before it: a count that fell on the asking rather than on the answering would be the portal
 * telling the member something the server had not agreed to, and the one axis this increment
 * cannot get wrong is „the route failed, and then the counter must not lie".
 *
 * <p><b>The cache is dropped and the number bumped in one breath</b>, because either alone is
 * a half: dropped without the bump, nothing re-reads; bumped without the drop, everything
 * re-reads and `loadResource` hands back the very promise that held the stale answer.
 */
export function theInboxHasChanged(): void {
  clearResourceCache('inbox')
  inboxRevision += 1

  for (const listener of whoIsDrawingTheInbox) {
    listener()
  }
}

/** `useSyncExternalStore`'s two halves. Returned as stable module-level functions rather than
 *  built per render, because a new `subscribe` on every render makes React tear the
 *  subscription down and set it up again after each one. */
function whileDrawingTheInbox(listener: () => void): () => void {
  whoIsDrawingTheInbox.add(listener)

  return () => {
    whoIsDrawingTheInbox.delete(listener)
  }
}

function theInboxRevisionNow(): number {
  return inboxRevision
}

/*
 * AND NEITHER OF THE TWO FACTS ABOVE IS RESET BETWEEN TESTS, which was written first and
 * measured to be both impossible and unnecessary (27.09.2026).
 *
 * **Impossible from where it belonged.** `test/setup.ts` runs before every test MODULE, so
 * importing this file there loads `data/client.ts` for real and caches it; a test whose
 * `vi.mock('./client')` comes afterwards registers a mock this module never sees.
 * `data/useResource.test.tsx` is that test - its mock answers three names and stages an answer
 * that arrives between a render and its effect - and it hung for twenty seconds on a real
 * `fetch` nothing in it had asked for.
 *
 * **And unnecessary.** `clearResourceCache()` there drops the answer, so a stale
 * `inboxAnsweredFor` can only cause one more drop of a cache that is already empty; and
 * `inboxRevision` is read as a `useResource` dependency, where what matters is that it CHANGES
 * during a case, never what it started at. The listeners need no help either:
 * `useSyncExternalStore` removes each one as its component unmounts.
 */

/**
 * THE INBOX: WHAT THE SERVER HAS KEPT, AND THEN WHAT HAS BEEN SAID DURING THIS VISIT.
 *
 * **The shape is `event/GoingToEvent.tsx`'s, word for word - „what the file says, and then
 * what has been said during this visit" - and it is here rather than there because three
 * screens read it.** The server is the source: seven places in six classes under
 * `backend/src/main` write into `message`, and until today not one of their rows was ever
 * drawn. The nine screens that call `notify` still write nowhere but the browser, so leaving
 * them out would take a team's invitation, a pair's invitation and a moderator's reason off
 * the one screen a member can answer them on - and no screen sends any of the three.
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
 *
 * @param reactive Defaults to true: `useResource` is given `mine` as its owner, so an
 * already-mounted caller reads fresh the moment it changes rather than going on drawing
 * whoever it answered for at mount (review of PR 406). `member/MessageDetail.tsx` is the one
 * caller that passes `false`, and its own doc on `TheMessageAsked` has the full measurement
 * of why: on that one screen, reacting to the switch correctly reaches `NotFound`, and
 * `NotFound`'s own redirect then races a navigation the caller may already have started,
 * which cost `teamInvite.test.tsx` three cases before this parameter existed.
 */
export function useInbox(
  mine: string,
  { reactive = true }: { reactive?: boolean } = {},
): ResourceState<InboxLine[]> {
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
     question from being asked twice and answered two ways.

     Called unconditionally, whatever `reactive` is: this clears the one shared cache all
     three callers read, and `member/MessageDetail.tsx` not reacting itself does not mean
     the answer it eventually reads on its own next mount should still be whoever asked
     before. */
  theInboxNowBelongsTo(mine)

  /* **AND HOW MANY TIMES IT HAS GONE OUT OF DATE, read by every caller whatever `reactive`
     is.** This is not the same question `reactive` answers and is not gated by it: that one is
     about WHOSE mail this is and carries the race with `NotFound`'s redirect that
     `member/MessageDetail.tsx` opts out of, while this one cannot reach that race at all - the
     owner does not change, so the message this screen is drawing is still his and still there.
     What re-reading buys the detail screen is the mark it has just written, which is what
     stops its own effect asking a second time. */
  const revision = useSyncExternalStore(whileDrawingTheInbox, theInboxRevisionNow)

  /* `mine` again, as `useResource`'s owner - UNLESS this caller asked not to, in which case
     `undefined` is what every other one of `useResource`'s fourteen callers already passes,
     and this instance goes back to reading the cache once, at mount, same as they do. */
  const served = useResource<ServedMessage[]>('inbox', {
    owner: reactive ? mine : undefined,
    revision,
  })

  return useMemo(() => {
    if (served.status !== 'ready') {
      return served
    }

    return { status: 'ready', data: newestFirst([...held.map(asALine), ...served.data.map(asServed)]) }
  }, [served, held])
}

/** A record the browser is holding, as a line. Its read mark is the portal's own, because
 *  for it the portal IS the store - there is no row on the server this key names, so opening
 *  it writes into `session/SessionProvider.tsx` and nowhere else. */
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
    readMarkIsTheServers: false,
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
 *
 * **AND IT IS A BOUNDARY WITH A DECISION AGAINST IT RATHER THAN AN OPEN QUESTION, which is the
 * one thing that changed on 27.09.2026 without this function changing.** PDL 27b has the owner
 * asking „Pod 1 ako to podrazumeva da clan moze klikom na dugme da prihvati ili odbije poziv?"
 * and the answer being yes, so the two keys above are owed a screen. What that screen needs and
 * this branch does not build is measured and worth writing down here rather than rediscovering:
 * `PUT /api/pairs/{id}` takes a `pair_invite.id`, which is exactly `pairInviteId`, so the pair
 * half wants nothing further; but `PUT /api/teams/{id}/invitations/{invitation}` needs the TEAM
 * as well, and no field here carries it. The one route that hands the invited member both
 * halves is `GET /api/me/applications`, whose `TeamInvitation(id, teamId, date)`
 * (`MyApplicationsApi`) nothing in `frontend/src` reads yet - and being absent from that list
 * is also how the server says a question is CLOSED, which is the honest answer to the trap
 * named above rather than a second guess at it.
 */
function asServed(one: ServedMessage): InboxLine {
  return {
    id: String(one.id),
    from: one.from,
    subject: one.subject,
    body: one.body,
    date: one.date,
    read: one.read,
    /* AND THE MARK ON IT IS THE SERVER'S TO WRITE, since `POST /api/inbox/{id}/read`
       (`InboxReadApi`, PDL 27a). This key names a row in `message`, so opening it writes
       `message_read` there and the answer survives signing out - which is the whole of what
       27a is for. See `InboxLine` for what the one screen that opens a message does with
       this. */
    readMarkIsTheServers: true,
  }
}

/** Sorted on the day, stably, so that whatever order each half arrived in survives inside
 *  a day. `localeCompare` is not needed and would be wrong: these are ISO days, where
 *  plain string order IS date order. */
function newestFirst(lines: InboxLine[]): InboxLine[] {
  return [...lines].sort((left, right) => (left.date < right.date ? 1 : left.date > right.date ? -1 : 0))
}
