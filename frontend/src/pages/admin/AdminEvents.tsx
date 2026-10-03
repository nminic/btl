import { useEffect, useRef, useState, type RefObject } from 'react'
import { useToday } from '../../clock/useClock'
import { daysBetween, fieldDate, isoDate, shiftDate } from '../../forms/dateField'
import { copyOf } from '../event/copyOf'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import type { BtlEvent } from '../../data/types'
import {
  RESULTS,
  combinePair,
  dataOr,
  failed,
  useEvents,
  useRaces,
  useResults,
} from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { wordsFor } from '../account/serverWords'
import { EntityBar, EntityEditor, RowActions, type Saving } from './EntityEditor'
import {
  EVENTS,
  RACES,
  eventClash,
  recordsOf,
  type Editing,
  type Overlay,
} from './entityForms'
import { recordKey } from '../../session/context'
import { dogadjaj } from '../../forms/definitions'
import type { FormDef, FormValues } from '../../forms/types'

import { categoryOf } from '../../data/raceCategory'
import { EventRaces } from './EventRaces'
import { raceKind } from '../../data/raceKind'
import { allFinished, rowsOf, storedRow, type RaceOfRow, type RaceRow } from './raceRows'
import { nextSeason } from './nextSeason'
import {
  WHEN_WRITING_AN_EVENT,
  WHEN_WRITING_A_RACE,
  raceUpsertFrom,
  raceWrittenIn,
  upsertFrom,
  writtenIn,
} from './eventWrites'
import '../member/Member.css'
import { useFilterParams } from '../../app/useFilterParams'

/** An overlay holding nothing, which is what this screen starts every visit with. */
const NOTHING_YET: Overlay = { edits: {}, creations: {}, deletions: {} }

/**
 * WHAT A PRESS ENDS IN WHEN THE FORM IT BEGAN IN HAS LEFT THE SCREEN: no sentence and no confirmation.
 *
 * <p>An editor that is handed „written" tells the screen it made an event (`onCreated`), which is the
 * one thing a form that has left must not say; and a sentence is for a form somebody is reading
 * (`theRacesOf`).
 */
const NOTHING_SAID: Saving = { said: null }

/**
 * ONE RACE A PRESS DID NOT SAVE, AND THE ANSWER THAT SAID SO.
 *
 * <p>Either a row of the table that the press tried to make or change a race out of, found again
 * later by its OBJECT (`EventRaces.tsx`, `NotSaved`), or a race the press tried to take away,
 * which has no row left and is named by its own name and day.
 */
type RaceRefusal =
  | { row: RaceRow; answer: Exclude<Answer, { got: 'done' }> }
  | { race: { name: string; date: string }; answer: Exclude<Answer, { got: 'done' }> }

/**
 * The event form as a copy is asked it: without the town, the country and the
 * kind.
 *
 * A copy has all three out of the event it came from and none of them is in
 * question (owner, 23.08.2026: „ne treba da se pominju Mesto, Država, Vrsta
 * događaja nego se kopiraju po default-u"). „Istaknuto" stays, because being
 * singled out is a choice about this running of the race.
 *
 * Left off the form rather than filled in and hidden: a save writes the fields the
 * form carries, so what is not asked keeps what the record already had. The town
 * carries the country, so taking the town takes both.
 */
const copyOfEvent: FormDef = {
  ...dogadjaj,
  fields: dogadjaj.fields.filter((one) => one.name !== 'city' && one.name !== 'kind'),
}

/**
 * The races of one event, read off the overlaid list.
 *
 * `recordsOf` answers with records of whatever shape an entity keeps; the rows
 * need races. Read field by field rather than asserted into a `Race`, so a record
 * missing one of them comes out as a row that says so rather than as a race with
 * `undefined` inside it.
 *
 * What a row reads and no more (`RaceOfRow`), which since 30.08.2026 includes the
 * kind a race is and its limit. The table draws and sets both, and saving the event
 * writes every row back over the race it came from, so a field left out here is a
 * field that save deletes even where nobody typed into it.
 */
function racesUnder(all: Record<string, unknown>[], event: string): RaceOfRow[] {
  return all
    .filter((one) => String(one.eventId) === event)
    .map((one) => ({
      id: Number(one.id),
      eventId: Number(one.eventId),
      /* Read straight, like the day beside it and for the same reason: both places
         a race can come from write it. One out of the file carries it, and one
         entered here is written by `storedRow`, which never leaves it out. A
         fallback here would be a second answer to a question that has one. */
      name: String(one.name),
      /* True either as the flag the file carries or as the one word that means it,
         because a race reaches here in both shapes: out of the served file it is a
         boolean (`/api/races`), and out of a creation it is text, since every value
         the store keeps is text (`session/context.ts`) and a boolean written into it
         comes back as the string „false", which is true. */
      renamed: one.renamed === true || one.renamed === 'true',
      date: String(one.date),
      /* Read against the list of kinds that exist, because the row does act on the
         word: a race that does not fix its length is not asked for one
         (`raceRows.whatIsMissing`), so a word this portal does not know would put
         the table into a state where it refuses a length that race has not got.
         The store keeps every value as text (`session/context.ts`), and a record
         written before this field existed carries none. */
      kind: raceKind(String(one.kind)),
      limitSeconds: Number(one.limitSeconds) || 0,
      distanceKm: Number(one.distanceKm),
      ascentM: Number(one.ascentM),
      descentM: Number(one.descentM),
      category: categoryOf(Number(one.distanceKm)),
    }))
}

/**
 * THE END OF A VISIT, said by the form leaving the screen, whichever way it goes.
 *
 * <p>Drawn beside the editor and for exactly as long as it is, so what it does when this screen takes
 * the form off - the button, a link to this list, the browser's Back - is the one moment a form can be
 * said to be over. It moves a number and says nothing else (`visits`, in `AdminEvents`, says what the
 * number is for).
 *
 * <p>The number rides in a ref handed down rather than in state: nothing is drawn from it, and a state
 * set while the form is being taken away would draw this screen once more for nothing.
 */
function EndsTheVisit({ visits }: { visits: RefObject<number> }) {
  useEffect(
    () => () => {
      visits.current += 1
    },
    [visits],
  )

  return null
}

/* The calendar from the other side. Between 15 and 30 September this is the
 * screen the owner spends the period of looking around on, filling the season
 * in, so it opens on what is still ahead rather than on the whole archive. */
export function AdminEvents() {
  const { locale, t } = useI18n()
  /**
   * WHAT THIS VISIT HAS WRITTEN, HELD HERE AND NO LONGER IN THE SESSION.
   *
   * <p><b>This is the whole of the fault this screen was carrying.</b> Every one of its
   * actions used to write into the session overlay (`session/context.ts`), which is what a
   * portal without a database did: the row appeared, the confirmation said „Sačuvano", and
   * all of it went on the next F5 while the database had never heard of it. Worse in one
   * direction than the others - a deletion filed there is read by `useLive`
   * (`data/useResource.ts`), which every screen that draws an event goes through, so
   * deleting an event took it off the PUBLIC calendar for the rest of that visit while the
   * row stood in the database and every other visitor still saw it.
   *
   * <p><b>Why anything is held at all, now that the server knows.</b> A screen that is
   * still mounted never asks its resource again - `useResource`'s effect runs once, on the
   * name - so there is nothing here to re-read the moment a write comes back. What is held
   * is therefore what the server has just ACCEPTED, never what this screen hopes it did:
   * every write below happens inside the branch that ran only because an answer said so.
   * That is the arrangement `admin/AdminLeagues.tsx` already uses and gives its reason for.
   *
   * <p><b>And the cache does not outlive a successful write either.</b> This overlay dies
   * with the component while the served array does not, so without
   * `clearResourceCache('events')` an event entered here was gone the instant the router
   * carried the reader to another screen and back - the row was never lost, only what this
   * component remembered.
   */
  const [written, setWritten] = useState<Overlay>(NOTHING_YET)
  const overlay = written
  const [search, setSearch] = useState('')
  /* And what was opened by pressing something somewhere else. The calendar
     sends a date here (`?nov=2027-05-08`), which is a `+` pressed on that day
     (owner, 12.08.2026). Read once, into the same state a press on this screen
     writes, so there is one way of being open and not two.

     A date that is not a date opens an empty form rather than nothing: a
     mistyped address is not worth a screen that refuses to work. Round trip and
     not a shape test, because „2027-13-45" has the shape of a date and is not
     one: `isoDate` gives back only what a calendar really holds, so a day that
     survives the journey there and back is a day that exists. */
  const [params, setParams] = useFilterParams()
  const askedDate = params.get('nov')
  const askedDay = askedDate === null ? '' : fieldDate(askedDate)
  const [chosen, setChosen] = useState<Editing | null>(
    askedDate === null ? null : { mode: 'new', start: { date: isoDate(askedDay) === askedDate ? askedDay : '' } },
  )
  /* The event entered a moment ago, so its races can be added under it while
     the confirmation of the save is still on screen. */
  const [justMade, setJustMade] = useState<string | null>(null)
  /**
   * The races of the open event as they stand, before anything is saved.
   *
   * Held here and not in the table, because the one button under the table writes
   * them (owner, 23.08.2026): the event and the mornings it runs on are one
   * question, asked once and refused once.
   *
   * Keyed by the event they were read off, so opening another event lines them up
   * again. Held as state rather than worked out on every render, because they are
   * what somebody is typing into.
   */
  const [held, setHeld] = useState<{ of: string; rows: RaceRow[] }>({ of: '', rows: [] })
  /** Whether the last press was refused over a row, which is when the rows start
   *  saying what is missing. */
  const [refused, setRefused] = useState(false)
  const state = combinePair(useEvents(), useRaces())
  /* Read for what it is worth rather than waited for. No row here shows a
     result: they are read only to take them down with the event they belong to.
     Waited for, a results file that failed replaced this whole screen with "the
     data cannot be loaded", and with it every way of editing an event or a race,
     over a file nothing on it draws.

     What the deletion needs is waited for instead, in the one row that offers
     it: until the results are here there is nothing to take along, and an event
     deleted in that window leaves its results pointing at an event that is gone,
     each still counting in the standing and linking to a page that says it does
     not exist. The event's own page holds the same two buttons back altogether
     until both files are ready (EventDetail.tsx); here the screen is the work
     itself, so only the deletion waits.

     Three states, because `dataOr` answers the same for a file on its way and a
     file that failed. Told to wait for something that never arrives, an
     administrator who holds the right is refused it for good, and the row says
     it is waiting: the same conflation this whole change is about, one row
     further in. */
  const resultsState = useResults()
  const results = dataOr(resultsState, null)
  const resultsFailed = failed(resultsState)
  const today = useToday()
  /*
   * `?zapis=<id>` WAS READ HERE AND IS NOT ANY MORE, because nothing produces it.
   *
   * It named the record this screen was sent to open, and the copy was its only
   * writer: the press made the copy first and sent this screen its identity
   * (`event/EventActions.tsx`). The press writes nothing now and the address names the
   * event being copied FROM, so no screen, no link and no test builds a `?zapis=` any
   * more and the branch that read it could not be reached through any of them.
   *
   * Removed rather than given a case that reaches it sideways, which is what the
   * coverage floor is for: a branch nothing can get to is a branch nothing can be
   * wrong about, and a test written to touch it would be measuring itself.
   */
  /**
   * WHICH EVENT IS BEING COPIED, NAMED BY ITS OWN IDENTITY RATHER THAN BY A FLAG.
   *
   * <p><b>It was `?kopija=1` beside `?zapis=<id>` until this, and the difference is where
   * the copy LIVES.</b> `pages/event/EventActions.tsx` used to make the copy the moment the
   * button was pressed - a record and a race apiece, written into the session with
   * identities counted down from nought (`admin/raceIds.ts`) - and send the reader here to
   * edit a thing that already existed. Nothing of that survived an F5, and nothing of it
   * was ever on the server.
   *
   * <p><b>So the press now writes nothing at all, and the address carries the question
   * instead of the answer.</b> What arrives here is „copy THIS event", and the form opens
   * as a NEW event holding what a copy holds (`event/copyOf.ts`) with the source's mornings
   * beneath it, moved by the same number of days. Nothing exists anywhere until Sačuvaj,
   * which is what the reader already believed was happening.
   *
   * <p><b>What this loses, and it is written down rather than quietly dropped:</b> a copy
   * no longer records which event it came out of. `copyOf` fills `copiedFrom` and
   * `EventWriteApi.Upsert` has no such field - the route says so in as many words, „no
   * {@code copiedFrom}, which belongs to a screen this increment does not build" - so the
   * chain `data/editions.ts` walks is not written by this path. It was not written before
   * either: a session creation never reached a public screen, which is the only place that
   * chain is read.
   */
  const copiedFrom = params.get('kopija')
  /**
   * WHICH EVENT IS BEING CHANGED, NAMED BY ITS OWN IDENTITY THE WAY `?kopija=` NAMES THE ONE
   * BEING COPIED.
   *
   * <p><b>The event's own page sends the reader here with it</b> (`event/EventActions.tsx`,
   * `change`; owner, 29.09.2026: the form the administration already has is the one that
   * opens, and not a second one drawn on that page). Nothing is written by the press and
   * nothing is copied: the form opens on the event as it stands, in the mode a row of the
   * list opens it in, with the event's own races beneath it.
   *
   * <p>Read on every render, like `copiedFrom` and for the same reason: the list is not
   * here when the address is, so the event can only be looked for inside the `Resource`
   * below. What somebody pressed wins over it (`chosen`), a copy asked for in the same
   * address wins over it (an address that meant something before this one existed goes on
   * meaning it), and leaving the form empties the address (`onDone`).
   */
  const changedId = params.get('izmena')
  /**
   * THE EVENT THIS EDITOR HAS ALREADY SAVED WHILE SOME OF ITS RACES STILL WAIT, so the next press
   * sends the races and nothing else.
   *
   * <p><b>Owner, 03.10.2026, chosen between offered outcomes:</b> „Događaj ostaje, trke čekaju:
   * kad čuvanje trka ne uspe, događaj ostaje sačuvan, a obrazac ostaje otvoren sa trkama i
   * jasnom porukom šta nije prošlo; ponovni pokušaj šalje samo trke, nikad drugi događaj."
   *
   * <p><b>It replaced `madeHere`, which answered a different question.</b> That ref remembered the
   * event a NEW form had made, so a second press could `PUT` it instead of `POST`ing a second
   * one; for an event that already stood it was never set, and the second press `PUT` the event
   * again. Under the owner's sentence the second press sends no event at all, new or standing,
   * so the question is no longer „which event do I write" but „is the event already written",
   * and this is set for both. `madeHere` is gone rather than kept beside it: two refs answering
   * nearly the same question are the shape in which one is updated and the other is not.
   *
   * <p>A ref and not state, for the reason `madeHere` was one and `EntityEditor`'s `asking` is
   * one: it is read inside the press that is running, and a value React has not drawn yet is a
   * value the next press would read as it was. `racesWait` below is the same fact for DRAWING
   * (the locked fields), and the two are set in one place only, `waitFor`.
   */
  const waitingFor = useRef<number | null>(null)
  const [racesWait, setRacesWait] = useState(false)
  /** What the last press did not save, row by row, for the list under the table. */
  const [notSaved, setNotSaved] = useState<RaceRefusal[]>([])
  /**
   * WHICH VISIT A PRESS BEGAN IN, as a number that moves each time a form leaves the screen.
   *
   * <p><b>A form has a visit, and a press that is still out when its form is taken off the screen
   * must not write into the next one</b> (review of PR 483, round 2, finding V1). The five things a
   * form holds (`forgetTheForm`) and the wait (`waitingFor`) live on THIS screen, which outlives every
   * form on it, so what a press writes after the server has answered goes into whatever form is
   * drawn when the answer comes. Nothing stops the reader leaving while a press is out („Nazad na
   * spisak" is open, nothing says the press is out, and the request has no deadline), so the answer
   * can come after he has opened another form and typed into it. Measured on `7a4e77f7`, with the
   * press of a copy refused after the reader had opened another event: every field of that event
   * was held, and its first press sent only races, under the COPY's event, took the copy's first
   * race away, never sent the words he had typed, and said „Događaj je sačuvan". The same answer
   * into a new form made it send a race under the copy's event and never its own event, and the
   * screen said „Sačuvano".
   *
   * <p><b>The visit ends when `EndsTheVisit` leaves the screen with the form, and not when a handler
   * runs.</b> `forgetTheForm` is called on the way IN, so it can say nothing about an answer that comes
   * after it, and a form left by its address calls no handler at all. A press takes the number as it
   * begins (`saveOne`) and asks whether it has moved (`left`) before each write it makes after an
   * answer; where it has, it writes NOTHING into any form.
   *
   * <p><b>Three things are written whatever the number says, and each for its own reason.</b> What
   * the server TOOK goes into this screen's list (`setWritten`: the event, and the races made, taken
   * away and changed), and the cache is dropped (`forgetWhatWasRead`), because that is true of the
   * server whoever is looking: a guard on those would lose an event the route has, and the reader
   * would enter it again and be told its address is taken by itself. A refusal or a confirmation
   * goes back to the editor that ASKED, which is the form of this press and, where it has left, gone
   * with nobody to read it. And the row of a race the press has just made learns its identity only
   * if it is found among the rows held (`held`), by the row's own object, which is its own guard: a
   * table that is not this press's does not contain it.
   *
   * <p><b>What a press that has been left does NOT do is stop.</b> It goes on to send what it had
   * begun to send, because stopping at the next request would leave an event saved with some of its
   * races, which is the very report the owner made on 03.10.2026. It is derived and not decided: the
   * owner has said nothing about leaving.
   */
  const visits = useRef(0)

  /** The one place the event's waiting is set and cleared, so the press and the drawing agree. */
  function waitFor(event: number | null): void {
    waitingFor.current = event
    setRacesWait(event !== null)
  }

  /**
   * EVERYTHING A FORM LEAVES BEHIND ON THIS SCREEN, forgotten in the one place, so that no way into
   * the next form can forget less than another.
   *
   * <p>A form holds five things that belong to its visit and to no other: the event it has just
   * made (`justMade`), the table of races it holds (`held`), whether its last press was refused
   * over a row (`refused`), whether its event is saved and its races wait (`waitFor`), and what its
   * last press did not save (`notSaved`). A form opened from the address (`?kopija=`, `?izmena=`)
   * goes away with the address - the browser's Back, a link to this list - and calls nothing of its
   * own, so the way OUT is not where the next form can be given a clean start; the way IN is.
   * `onDone`, `onNew` and `onOpen` are every way into or out of a form on this screen, and each
   * calls this.
   *
   * <p><b>Review of PR 483, round 1, finding V2.</b> `onNew` and `onOpen` forgot two of the five,
   * the table and the sign that the last press was refused: a new form opened after a copy whose
   * races waited held the copy's rows, wrote them under the NEW event, and the event followed the
   * day of the first of them (an event entered for 2027 stood on the day of a race of 2015, and
   * the screen said „Sačuvano"). A copy and a new event are both the table `nov`, which is why the
   * table was taken. The same held where the copy's first race had been taken and the second
   * refused, which the review measured on `main` as well.
   *
   * <p><b>What a reader who leaves gives up</b> is what waited, and none of it is handed to the
   * next form, whichever way he left. The one thing this does not do is forget on the way OUT, so
   * the browser's Back to the very address he left by finds the form as he left it (`saveOne`
   * says what that is).
   *
   * <p><b>This is what the NEXT form inherits, and it cannot answer for what a press that is still
   * out writes LATER</b> (review of PR 483, round 2, finding V1): that comes after the next form is
   * open, and is asked of the press itself at every place it writes (`visits`).
   */
  function forgetTheForm(): void {
    setJustMade(null)
    setHeld({ of: '', rows: [] })
    setRefused(false)
    waitFor(null)
    setNotSaved([])
  }

  /** What just happened, for whoever is not watching the list. */
  const [said, setSaid] = useState('')

  /** Why a deletion did not happen, beside the row it was pressed on. */
  const [refusedDelete, setRefusedDelete] = useState<{
    id: number
    answer: Exclude<Answer, { got: 'done' }>
  } | null>(null)

  /** The words for an answer that was not „it was done". */
  function saying(answer: Exclude<Answer, { got: 'done' }>, refusals: Record<string, string>) {
    return <ServerSaid answer={answer} refusals={refusals} />
  }

  /**
   * AND TAKING ONE AWAY, WITH EVERYTHING THAT HANGS OFF IT.
   *
   * <p>One request, because `DELETE /api/events/{id}` is one statement and the schema
   * cascades the rest: the races from the event, the results from the race, and the
   * attendance and the comments beside them. Owner, 03.08.2026: an event is deleted with
   * all of its races, and that is the only action there is.
   *
   * <p><b>All three names are dropped from the cache, not just the event's.</b> The races
   * and the results this took down are still sitting in the two arrays this visit fetched,
   * and a screen that asked for them again would draw races belonging to an event that is
   * gone. The overlay below only says the EVENT is gone, because that is all it can say
   * honestly: which races went with it is the database's answer, and the next read is
   * where it comes from.
   */
  async function deleteOne(event: BtlEvent): Promise<void> {
    const answer = await askTheServer(`/api/events/${String(event.id)}`, {}, 'DELETE')

    if (answer.got !== 'done') {
      setRefusedDelete({ id: event.id, answer })

      return
    }

    clearResourceCache('events')
    clearResourceCache('races')
    clearResourceCache(RESULTS)
    setRefusedDelete(null)
    setSaid(t('admin.eventGone'))
    setWritten((before) => ({
      ...before,
      /* OUT OF BOTH STORES, because an event entered during this visit is held as a
         CREATION and one that was served is filtered out by a DELETION. Written into the
         second only, the row somebody just made would go on standing and he would press
         Delete on it again, against an event the server has already forgotten. */
      creations: {
        ...before.creations,
        [EVENTS.id]: (before.creations[EVENTS.id] ?? []).filter(
          (made) => made.id !== String(event.id),
        ),
      },
      deletions: {
        ...before.deletions,
        [EVENTS.id]: [...(before.deletions[EVENTS.id] ?? []), String(event.id)],
      },
    }))
  }

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.events')}</h1>

      <Resource state={state}>
        {([events, races]) => {
          const all = recordsOf(EVENTS, events, overlay)
          /* Through the overlay, like the events beside them. Read straight from
             the file the count below said an event copied here had no races,
             while its races were on the next screen along. */
          const allRaces = recordsOf(RACES, races, overlay)
          /* THE RESULTS ARE READ AND NO LONGER LISTED, and the difference is the
             whole of what the cascade took over. This screen used to build records
             of them so that deleting an event or a race could file each one as a
             session deletion by hand; `result_race_fk` cascades from the race, so
             the database does it in the statement that takes the race down.

             What is still read is whether the file is HERE, which is the one thing
             the row's delete button waits for (`whyNoRemove` below). That gate is
             older than this change and is left exactly as it was. */
          /* Worked out rather than copied into state.
           *
             It was an effect that put the record from the address into state,
             and `recordsOf` builds its records fresh on every render, so the
             record was a new object every time, the effect saw a changed value
             every time, and it set state every time: the screen never settled,
             and pressing anything that led away from it left the address changed
             and the old screen still drawn.
           *
             Read here, there is nothing to keep in step. What the address names
             is the form for that record; what somebody pressed wins over it,
             because they pressed it later. */
          /* The event a copy is being made OF, found in the same list the rows are
             drawn from. Undefined on every screen but a copy, and undefined as well
             where the address names an event this list has not got, which opens an
             empty form rather than nothing: a mistyped address is not worth a screen
             that refuses to work, which is the rule `?nov=` beside it already keeps. */
          const copySource =
            copiedFrom === null ? undefined : all.find((one) => String(one.id) === copiedFrom)
          const copying = copySource !== undefined
          /* The event a change is asked for, found in the WHOLE list and not in the sixty
             rows drawn below it: an event of last season is in none of them, and it is the
             very event an administrator is looking at when he presses the button on its
             own page. Found by its identity, compared as text exactly as `copySource` is:
             `86` is the address of an event, and `086` and `86abc` are not.

             Undefined where the address names none this list has, and that draws the list
             and not a form (measured 29.09.2026, and the same for `?kopija=`): a stale link
             is not worth a blank form, and a blank form is a way to make an event nobody
             meant to make. */
          const changeSource =
            changedId === null ? undefined : all.find((one) => String(one.id) === changedId)
          /**
           * WHAT THE COPY'S FORM OPENS HOLDING.
           *
           * <p><b>The day is turned into what a form speaks, and that is not a detail.</b>
           * `copyOf` answers a RECORD (`event/copyOf.ts`), so its day is `gggg-mm-dd`;
           * these values are handed to `FormRenderer` as `initial` and used raw, and a
           * date control given an ISO day holds nothing at all. It never showed while the
           * copy was a record: the editor was opened on it in `one` mode and `valuesFor`
           * did the turning. There is no record now, so this is where it happens.
           *
           * <p><b>The town, the country and the kind ride along although no field asks for
           * them</b>, which is what makes the narrowed form safe. A copy is not asked for
           * the three (owner, 23.08.2026) and `FormRenderer` drops only values whose FIELD
           * is on the form and hidden, so a value with no field at all reaches the save
           * untouched. That is the whole reason `upsertFrom` can send a complete event out
           * of a form that asks seven questions.
           */
          const asCopied = (source: BtlEvent): FormValues => {
            const held = copyOf(source)

            return { ...held, date: fieldDate(held.date) }
          }
          /* Whatever somebody pressed, then a copy the address asks for, then a change it
             asks for. The copy is asked before the change so that an address which meant
             something before `?izmena=` existed goes on meaning it, and a change is the
             one mode in which the form opens on a record that is already on the server:
             saving it writes over that record and makes no other. */
          const editing: Editing | null =
            chosen ??
            (copySource !== undefined
              ? { mode: 'new', start: asCopied(copySource) }
              : changeSource === undefined
                ? null
                : { mode: 'one', record: changeSource })

          /* The record the form is open on, as the event it is, so its races
             can be looked up. Found in the list rather than taken off the form's
             own record: the form carries what was handed to it, and the list is
             what the overlay has since made of it. */
          const openEvent =
            editing === null || editing.mode === 'new'
              ? /* And the one that has just been entered, which is a record with
                   an identity even though the form is still the form that made
                   it: its races are entered under it right away, one by one,
                   rather than after going back to a list of eleven hundred to
                   find it again (owner, 11.08.2026). */
                all.find((one) => String(one.id) === justMade)
              : all.find((one) => String(one.id) === String(editing.record[EVENTS.idField]))

          if (editing !== null) {
            /* The rows this screen is holding, or the event's races lined up as
               rows where it is not holding any yet. Worked out rather than put
               into state by an effect: state that mirrors a list is state that
               falls out of step with it, and this screen has been bitten by an
               effect that copied a record already (see `wanted` above). */
            const under = String(openEvent?.id ?? 'nov')
            /**
             * THE MORNINGS A COPY OPENS HOLDING: the source's, moved by the same number
             * of days, and every one of them a NEW row.
             *
             * <p>Moved by the difference between the two events' days rather than by a
             * year, so the shape of a weekend survives: two races on the Saturday and one
             * on the Sunday stay two and one (owner, 10.08.2026). The same number
             * `event/copiedRace.ts` was handed when the copy was made in the session.
             *
             * <p><b>The identity is blanked, and that is the whole of what makes it a
             * copy rather than an edit.</b> A row carrying the source race's id is a row
             * the save writes over - `PUT /api/races/{id}` - so a copy left holding them
             * would have renamed and moved LAST season's races and made none of its own.
             * The session path could not meet this: it counted fresh identities out for
             * every copied race, which is the same decision said in the other direction.
             */
            const copiedRows = (source: BtlEvent): RaceRow[] => {
              const by = daysBetween(source.date, copyOf(source).date)

              return rowsOf(racesUnder(allRaces, String(source.id)), fieldDate).map((row) => ({
                ...row,
                id: '',
                date: fieldDate(shiftDate(isoDate(row.date), by)),
              }))
            }
            const current =
              held.of === under
                ? held.rows
                : copySource !== undefined
                  ? copiedRows(copySource)
                  : rowsOf(racesUnder(allRaces, under), fieldDate)
            const setCurrent = (next: RaceRow[]) => {
              setHeld({ of: under, rows: next })
            }

            /**
             * THE MORNINGS OF THIS EVENT, WRITTEN ONE AT A TIME, AFTER THE EVENT ITSELF.
             *
             * <p>Three things happen and the order is the order the session write kept, for
             * the same reason: a race taken off the table goes first, so a length deleted and
             * entered again in one sitting does not meet itself at its own address
             * (`theAddressIsTaken`). A race that already exists is written over. A row that is
             * new is created under the identity the event write just handed back.
             *
             * <p><b>What is NOT here, and it is the largest thing this change removed.</b> The
             * session write had to take the results down by hand - by the race that went, and
             * by the event's address where the whole event stopped being a race - because
             * nothing else would have. The database does it: `result_race_fk` cascades from
             * the race (`EventWriteApi`'s own class note names it), so a race deleted here
             * takes its results with it in the same statement. Written again on this side it
             * would be a second answer to a question the schema has already answered, and the
             * day the two disagreed the schema would win silently.
             *
             * <p><b>Nothing is sent for a gathering or a training.</b> Owner, 23.08.2026, on
             * what changing the kind does: „prvo se sakriju sve trke sa ekrana, ali mogu da se
             * vrate ukoliko vratiš da je tip Trka. Ako se sačuva kao neki drugi tip, u to
             * čuvanje spada i brisanje svih trka koje su bile povezane." So the rows stay on
             * the screen, `kept` is empty, and every filed race is deleted.
             *
             * <p><b>A refused race does not stop the press, since 03.10.2026.</b> Every race is
             * judged by the route on its own, so the rest are sent all the same and every
             * refusal comes back, each beside the race it is about (owner, that day: the form
             * stays open „sa trkama i jasnom porukom šta nije prošlo"; coordinator, the same day,
             * on the question whether to stop or go on: go on and report every refused row).
             * Until then the first refusal ended the press, so the races after it were never
             * sent at all, and the sentence said „jedna njegova trka nije" over a press in which
             * none had been saved.
             *
             * <p><b>It goes on whether or not the reader has left</b> (`visits`), and what it writes into
             * a FORM it writes only while he has not: the table below. What the server took it
             * writes into this screen's list either way, which is true of the server whoever is
             * looking.
             *
             * @param left whether the form this press began in has left the screen since
             * @returns every race the route refused, in the order they were sent; nothing where
             *          every one went through
             */
            async function writeTheRaces(
              values: FormValues,
              eventId: string,
              left: () => boolean,
            ): Promise<RaceRefusal[]> {
              const refusals: RaceRefusal[] = []
              const was = allRaces.filter((one) => String(one.eventId) === eventId)
              const kept =
                kindOf(values) === 'race'
                  ? new Set(current.filter((row) => row.id !== '').map((row) => row.id))
                  : new Set<string>()

              /* THE TABLE IS HELD AS THE ROWS THIS PRESS WALKS, before anything is sent. Two things
                 find a row again by its OBJECT afterwards: a refusal (`EventRaces.tsx`, `NotSaved`),
                 and a race this press made, whose identity is written back onto its row below.
                 `current` is worked out afresh on every drawing until `held` holds it: a copy opens
                 on rows nobody has touched (`copiedRows`), and an event that stands opens on rows
                 read off its races, and both are new objects at every drawing. Held here, the
                 objects this loop walks are the ones every later drawing has. Not held, the list
                 of what was not saved named nothing where no race was accepted - measured by a
                 mutation - and the row of a race a copy's first press made never learned its
                 identity, which a fallback inside the loop used to answer for that one case.

                 AND ONLY WHILE THE FORM IS STILL THE ONE THIS PRESS BEGAN IN. A press that writes the
                 event first reaches this line AFTER the answer, and the reader may have gone back and
                 opened a new form by then: a new form and a copy are both the table „nov", so both rows
                 of the copy were handed to it, and the event it made was sent on the day of the first of
                 them (2015-03-15) and not on the day that was typed (measured, `7a4e77f7`). */
              if (!left()) {
                setHeld((before) => (before.of === under ? before : { of: under, rows: current }))
              }

              for (const race of was) {
                if (!kept.has(String(race.id))) {
                  const answer = await askTheServer(`/api/races/${String(race.id)}`, {}, 'DELETE')

                  if (answer.got !== 'done') {
                    refusals.push({
                      race: { name: String(race.name), date: String(race.date) },
                      answer,
                    })

                    continue
                  }

                  setWritten((before) => ({
                    ...before,
                    creations: {
                      ...before.creations,
                      [RACES.id]: (before.creations[RACES.id] ?? []).filter(
                        (made) => made.id !== String(race.id),
                      ),
                    },
                    deletions: {
                      ...before.deletions,
                      [RACES.id]: [...(before.deletions[RACES.id] ?? []), String(race.id)],
                    },
                  }))
                }
              }

              for (const row of kindOf(values) === 'race' ? current : []) {
                /* A row that never was a race is made, and one that is, is written over.
                   Read off the row's own identity rather than off anything counted here:
                   the numbers this screen used to hand out came from `admin/raceIds.ts`,
                   which counts DOWN from nought, and the whole of that is gone - a
                   `bigserial` is what a race is addressed by now. */
                const filed = storedRow(row, eventId)
                const answer =
                  row.id === ''
                    ? await askTheServer('/api/races', raceUpsertFrom(row, eventId))
                    : await askTheServer(
                        `/api/races/${row.id}`,
                        raceUpsertFrom(row, eventId),
                        'PUT',
                      )

                if (answer.got !== 'done') {
                  refusals.push({ row, answer })

                  continue
                }

                /* WHAT WAS WRITTEN GOES INTO THE OVERLAY BESIDE THE EVENT, and leaving it
                   out was measured rather than reasoned: the screen does not remount when
                   the form closes - `setChosen(null)` is a render and not a new mount - so
                   `useRaces()` still answers with the array fetched before any of this.
                   Without these three the copy went back to a list that counted nought
                   races under it and opened on an empty table, over races the route had
                   just accepted.

                   The identity is the one the DATABASE handed out, read off the answer
                   (`eventWrites.ts`, `raceWrittenIn`). A number counted on this side is
                   the fault the whole of this change closes, one table along. */
                if (row.id === '') {
                  const made = raceWrittenIn(answer.body)

                  if (made !== null) {
                    setWritten((before) => ({
                      ...before,
                      creations: {
                        ...before.creations,
                        [RACES.id]: [
                          ...(before.creations[RACES.id] ?? []),
                          { id: String(made), values: filed },
                        ],
                      },
                    }))

                    /* AND THE ROW ON THE TABLE LEARNS THE SAME IDENTITY, not only the
                       overlay above. Left at '', a row already written this way read as
                       a SERVED race no surviving row keeps the moment ANYTHING refused
                       a later row of the same press and the reader pressed again: `was`
                       (above) named it by the id just handed out, `kept` went on saying
                       that id did not exist, and the retry deleted the very race this
                       press had just made and then made it again - a destructive request
                       against a row the route had only just accepted, measured by a
                       nezavisna recenzija.

                       Matched by the row's own OBJECT, the same way `EventRaces.tsx`'s
                       own `change` corrects one row - never by position. This answer
                       comes back after a wait, and `held` can have moved on by then: the
                       reader left for the list (`onDone` empties it) or reopened this
                       table after touching a different event's. A row found by INDEX
                       would then correct whatever happens to occupy that index in
                       whatever `held` holds now, which is nothing this press wrote. A row
                       found by IDENTITY is simply absent once that happens, and `map`
                       leaves every row exactly as it was.

                       AND `held` ALREADY HOLDS THE ROWS THIS LOOP WALKS, because the press
                       held them before it sent anything (the top of this function). Until
                       03.10.2026 it was held HERE, by a fallback to `current` where `held` had
                       not caught up: a copy opens on rows nobody has touched (`copiedRows`),
                       so on its first press `held` was still `{ of: '', rows: [] }`, the map
                       ran over an empty array, the identity this race was given reached
                       nothing, and a retry after a later row's refusal DELETEd the race this
                       press had just made (nezavisna recenzija, 28.09.2026, visok nalaz).
                       Held at the top for every press, that fallback was a branch nothing
                       could take any more - the coverage floor named it - and it is gone
                       rather than kept beside the hold that replaced it. So nothing here
                       writes `of`: where `held` has moved on to another table, or to none,
                       this row is simply not in it.

                       NOT ASKED OF THE VISIT (`left`), AND THAT IS DELIBERATE. Of everything this
                       press writes into the form after an answer this is the one write that cannot
                       reach another form: the row it looks for is the object this press walks, and no
                       table but this press's own holds it. Asked of the visit as well it would do
                       harm where the same table is found again - the browser's Back to the very
                       address the form was left by - because the row of a race the route had taken
                       would never learn it, and the next press would make that race a second time
                       (reasoned, not measured). Held against the one way it could reach another form,
                       a row matched by anything but its object, by the case in which a copy's last
                       race comes back taken while a new form waits (`racesWait.test.tsx`). */
                    setHeld((before) => ({
                      ...before,
                      rows: before.rows.map((each) =>
                        each === row ? { ...each, id: String(made) } : each,
                      ),
                    }))
                  }
                } else {
                  setWritten((before) => ({
                    ...before,
                    edits: {
                      ...before.edits,
                      [recordKey(RACES.id, row.id)]: filed,
                    },
                  }))
                }
              }

              return refusals
            }

            /**
             * THE EVENT AND ITS MORNINGS, IN ONE PRESS, AGAINST THE ROUTES.
             *
             * <p>`POST /api/events` answers 201 with the id AND the address it filed the event
             * under, `PUT` answers 200 with the same pair, and both are read off the answer
             * rather than worked out here. This portal knows the address rule and so does the
             * server (`eventWrites.ts`, `writtenIn`); the route is the one that decides.
             *
             * <p><b>WHAT HAPPENS WHEN THE EVENT GOES THROUGH AND A RACE DOES NOT, which the owner
             * decided on 03.10.2026 between offered outcomes:</b> „Događaj ostaje, trke čekaju:
             * kad čuvanje trka ne uspe, događaj ostaje sačuvan, a obrazac ostaje otvoren sa trkama
             * i jasnom porukom šta nije prošlo; ponovni pokušaj šalje samo trke, nikad drugi
             * događaj." So the event is not taken back; one sentence says it is saved and the
             * races wait, and the list under the table names every race that was refused and why
             * (`EventRaces.tsx`); the form stays open with every row; and from then on a press sends
             * the races and nothing else (`waitingFor`). The event's own fields are held where they
             * were saved while that lasts, because a change typed into one would be a change no
             * press sends (coordinator, 03.10.2026, reasoning from the owner's sentence).
             *
             * <p><b>The event goes into this screen's list the moment the route takes it, and not
             * after its races</b> (the coordinator's reasoning from the same sentence, not the
             * owner's words). A reader who leaves the form while races wait must find the event he
             * saved: until 03.10.2026 it was written into the list only once every race had gone
             * through, so he found nothing, entered it again, and was told by the route that its
             * address is taken - a refusal about a collision with himself.
             *
             * <p><b>And what a reader who leaves loses, written down rather than guarded:</b> the
             * races that were still waiting. The event stays and they do not, and nothing warns
             * him on the way out; the owner has not decided anything about leaving, so nothing new
             * is drawn for it (coordinator, 03.10.2026). What IS guarded is that they are not
             * carried: no form opened afterwards from this list, new or an event's own, is handed
             * any of it, whichever way he left (`forgetTheForm`).
             *
             * <p><b>What is NOT guarded, measured and not assumed (review of PR 483, round 1):</b>
             * the one way back to the very address he left by. A form opened from the address and
             * left by it (a link to this list), then returned to by the browser's Back, is drawn
             * again from its address, and nothing forgot on the way out: the fields are held, the
             * table and the list of what was not saved are as he left them, and the sentence over
             * the form is gone, because that lives in the form that was drawn. A press there sends
             * only races, as it did. So „loses" holds for every way into ANOTHER form and not for
             * this one.
             *
             * <p><b>A press that is still out when he leaves is asked about its visit, and that is
             * measured too (review of PR 483, round 2, finding V1).</b> Everything above is what the
             * NEXT form is handed on the way in; an answer that comes after he has opened another
             * form wrote the wait into THAT form, and its first press then sent only races, under the
             * event of a press he had left. The press takes the number of its visit as it begins
             * (`visits`) and asks `left` before every write it makes into a form after an answer. It
             * goes on to send what it began to send, writes into this screen's list what the server
             * took, and writes nothing else.
             *
             * <p><b>The portal has no precedent for this and that is measured, not assumed.</b>
             * The one other screen that writes a record and its children in one press is
             * `admin/LeagueRaceModeration.tsx`, and it never makes N writes: it hands the whole
             * day to the server as `{eventId}` and the route walks it. `/api/races` takes one
             * race, so there is no such door here. What is written above is therefore the least
             * that is true rather than a protocol copied from somewhere, and the boundary is
             * written down: a press refused on its third race leaves the first two written.
             */
            async function saveOne(
              values: FormValues,
              text: Record<string, string>,
            ): Promise<Saving> {
              /* THE VISIT THIS PRESS BEGAN IN, taken before anything is sent, and the question every
                 write after an answer asks of it (`visits`). */
              const began = visits.current
              const left = (): boolean => visits.current !== began

              setNotSaved([])

              /* WHILE RACES WAIT, A PRESS SENDS THE RACES AND NOTHING ELSE: „ponovni pokušaj
                 šalje samo trke, nikad drugi događaj" (owner, 03.10.2026). Asked of the ref,
                 which is current inside the press that is running. */
              const saved = waitingFor.current

              if (saved !== null) {
                forgetWhatWasRead()

                return theRacesOf(values, saved, left)
              }

              /* THE RECORD THE FORM IS OPEN ON, or nothing for a form that makes one. A ref
                 used to stand in for the second half - `madeHere`, the event a new form had
                 already made - so that a second press would change it rather than make another;
                 a second press sends no event any more (above), so a new form only ever posts. */
              const standing =
                editing !== null && editing.mode === 'one'
                  ? Number(editing.record[EVENTS.idField])
                  : null
              const answer = await askTheServer(
                standing === null ? '/api/events' : `/api/events/${String(standing)}`,
                upsertFrom(values),
                standing === null ? 'POST' : 'PUT',
              )

              if (answer.got !== 'done') {
                return { said: saying(answer, WHEN_WRITING_AN_EVENT) }
              }

              forgetWhatWasRead()

              const made = writtenIn(answer.body)

              if (made === null) {
                return {
                  said: (
                    <p className="field__error" role="alert">
                      {t('admin.eventSavedUnseen')}
                    </p>
                  ),
                }
              }

              /**
               * THE ROW THIS VISIT WILL DRAW, WHICH IS WHAT WAS SENT AND NOT ONLY WHAT WAS
               * ASKED.
               *
               * <p>The address comes off the server's answer rather than out of the rule, so
               * the list shows what an administrator would really send somebody
               * (`eventWrites.ts`, `writtenIn`).
               *
               * <p><b>And the three a copy is never asked for are written down beside it,
               * which was measured rather than reasoned.</b> `EntityEditor` builds its text
               * out of the fields the FORM carries, and a copy is drawn without its town, its
               * country and its kind (owner, 23.08.2026, `copyOfEvent`). That was harmless
               * while a save wrote over a record that already held all three; it is not
               * harmless now that the save MAKES the record. Left out, the copy went into the
               * list with no kind at all: the kind column printed the name of a dictionary
               * key, and opening it again drew no table of races, because the screen asks the
               * kind whether there are any (`kindOf`). They are read off what went on the
               * wire, so the row and the request cannot disagree.
               *
               * <p>The form's own answers win wherever it asked, which is every other save on
               * this screen.
               *
               * <p><b>Written here, the moment the route has taken the event, and before a single
               * race is sent</b> - see `saveOne`'s own note on what a reader who leaves would
               * otherwise find. Written ONCE: a press while races wait never reaches this line,
               * because it sends no event.
               */
              const sent = upsertFrom(values)
              const filed = {
                city: sent.city,
                country: sent.country,
                kind: sent.kind,
                ...text,
                slug: made.slug,
              }

              setWritten((before) =>
                standing === null
                  ? {
                      ...before,
                      creations: {
                        ...before.creations,
                        [EVENTS.id]: [
                          ...(before.creations[EVENTS.id] ?? []),
                          { id: String(made.id), values: filed },
                        ],
                      },
                    }
                  : {
                      ...before,
                      edits: {
                        ...before.edits,
                        [recordKey(EVENTS.id, made.id)]: filed,
                      },
                    },
              )

              return theRacesOf(values, made.id, left)
            }

            /**
             * THE RACES OF AN EVENT THAT IS ALREADY SAVED, AND WHAT THE PRESS ENDS IN.
             *
             * <p>Reached by both kinds of press: the one that has just written the event, and
             * every press after it while races wait, which writes nothing else. Where every race
             * went through, the event is confirmed and nothing waits any more. Where any was
             * refused, the event waits under its own identity, the sentence over the form says
             * the event is saved and the races are not, and the list under the table names every
             * race that was refused and why.
             *
             * <p><b>Where the event draws no table, the same list stands under its fields</b> and
             * the sentence is another one (review of PR 483, round 1, finding V1). A gathering or
             * a training has races to take away and no table to name them in, and the sentence
             * that sends the reader „ispod tabele" sent him nowhere. The two are told apart by the
             * question the table itself is drawn by (`hasRaces`, in `beneath`).
             *
             * <p><b>Where the form this press began in has left the screen, the end of the press
             * writes nothing and says nothing</b> (review of PR 483, round 2, finding V1). The end
             * of a press is four writes into whatever form is drawn when the last answer comes: the
             * list of what was not saved and the wait (a refusal), the end of the wait (every race
             * through), and the identity of the event the screen is told to draw the form under
             * (`{ written }`, which the editor hands to `onCreated`). The first two were measured on
             * `7a4e77f7`: a refusal that came after the reader had opened another form held that
             * form. The other two are the same write seen from the other answer, and each has a case
             * of its own in which a copy comes back with every race taken. What is returned instead
             * is `NOTHING_SAID`, the one answer that makes an editor that is still there do nothing
             * and tell the screen nothing.
             *
             * @param left whether the form this press began in has left the screen since
             */
            async function theRacesOf(
              values: FormValues,
              event: number,
              left: () => boolean,
            ): Promise<Saving> {
              const refusals = await writeTheRaces(values, String(event), left)

              if (left()) {
                return NOTHING_SAID
              }

              if (refusals.length > 0) {
                setNotSaved(refusals)
                waitFor(event)

                return {
                  said: (
                    <p className="field__error" role="alert">
                      {t(
                        kindOf(values) === 'race'
                          ? 'admin.eventSavedRacesRefused'
                          : 'admin.eventSavedRacesKept',
                      )}
                    </p>
                  ),
                }
              }

              waitFor(null)

              return { written: String(event) }
            }

            /**
             * THE NEXT MOUNT READS THE SERVER AND NOT THIS VISIT'S FIRST ANSWER. All three
             * names, because one press moves all three: the event, its races, and the results
             * the database takes down with a race that goes. Asked the moment the event is
             * written, before its races, so a press that fails half way still leaves the next
             * mount reading what really stands; and by a press that sends only races, before it
             * sends them, because a race moves its event's day and something may have read all
             * three again since the press before.
             */
            function forgetWhatWasRead(): void {
              clearResourceCache('events')
              clearResourceCache('races')
              clearResourceCache(RESULTS)
            }

            /**
             * Which kind of event the form in front of us is, on a screen where
             * the form does not always ask.
             *
             * A copy is not asked for its town, its country or its kind: it has
             * all three from the event it was copied from and none of them is in
             * question (owner, 23.08.2026), so `copyOfEvent` leaves the field out
             * and the values carry no kind at all. Read off the form where it is
             * there and off the record behind it where it is not.
             *
             * No third answer, and that is measured rather than assumed: a new
             * event is asked for its kind and opens on Trka (`entityForms.ts`,
             * `start`), and the one form that does not ask is a copy, which always
             * has the event it was copied from. A fallback of „race" written here
             * was a branch no test could reach.
             */
            /**
             * The two days a copy offers beside its calendar: next season, and a
             * week on (owner, 23.08.2026: „veoma zgodno za treninge i nedeljne
             * trkice").
             *
             * Both counted **from the event this was copied from**, never from what
             * the box holds now (owner, same day). That is what makes a button mean
             * one thing: a date changed by hand and then a press goes back to the
             * count from the original, and two presses give what one press gives.
             *
             * The event it came from is found by `copiedFrom`, which the copy writes
             * and nobody types (`event/copyOf.ts`). Empty where there is nothing to
             * count from, which is every screen but this one.
             */
            /* The event this is a copy of, which the address now names outright. It was
               read off the copy's own `copiedFrom` while the copy was a record that
               already existed; there is no record yet, so the source is the one the
               reader pressed Kopiraj on, and that is the one both buttons count from. */
            const from = copySource
            const steps =
              from === undefined
                ? undefined
                : [
                    {
                      label: '+1y',
                      title: t('admin.form.nextSeason'),
                      to: fieldDate(nextSeason(String(from.date))),
                    },
                    {
                      label: '+1w',
                      title: t('admin.form.nextWeek'),
                      to: fieldDate(shiftDate(String(from.date), 7)),
                    },
                  ]

            /* Read off the values alone, which is new on 28.09.2026 and is a consequence
               rather than a tidy-up. A copy is drawn without the kind field (owner,
               23.08.2026, `copyOfEvent`), so the values used to carry none and the record
               behind them had to answer instead. The copy now opens holding what `copyOf`
               gives it, kind included, and `FormRenderer` keeps a value whose field is not
               on the form - so there is no longer a way for this to be asked of a form that
               cannot answer, and a fallback would be a branch nothing could reach. */
            const kindOf = (values: FormValues): string => String(values.kind)

            /* WHAT THE LAST PRESS DID NOT SAVE, in the shape the table draws it: the words for
               every refused row, by the row that was sent, and every race the press meant to take
               away and the route kept, named by its own name and day. The words are the ones
               `ServerSaid` says (`wordsFor`), worked out here because the table draws them as
               items of a list and not as an alert each. */
            const refusedRows = new Map<RaceRow, string>()
            const keptRaces: { named: string; words: string }[] = []

            for (const one of notSaved) {
              const words = wordsFor(one.answer, WHEN_WRITING_A_RACE, t)

              if ('row' in one) {
                refusedRows.set(one.row, words)
              } else {
                keptRaces.push({
                  named: t('admin.race.notDeleted', {
                    name: one.race.name,
                    date: formatShortDate(one.race.date, locale),
                  }),
                  words,
                })
              }
            }

            return (
              <>
                {/* DRAWN FOR EXACTLY AS LONG AS THE EDITOR, so the visit of the form ends when the form
                    does, by whichever road (`visits`). */}
                <EndsTheVisit visits={visits} />
                {(
                  <EntityEditor
                    entity={EVENTS}
                    /* What a copy is not asked for: it has its town, its country
                       and its kind out of the event it came from, and none of the
                       three is in question (owner, 23.08.2026). A save writes the
                       fields it carries, so what is not asked stays as it was. */
                    form={copying ? copyOfEvent : undefined}
                    titleKey={copying ? 'admin.form.copying' : undefined}
                    /* EVERY FIELD OF THE EVENT IS HELD WHILE ITS RACES WAIT. A press then sends
                       the races and nothing else (owner, 03.10.2026: „ponovni pokušaj šalje samo
                       trke"), so a change typed into the event would be a change no press sends;
                       held, it cannot be typed at all (coordinator, the same day, reasoning from
                       the owner's sentence). Every field of the form that is DRAWN, which for a
                       copy is the narrower one. */
                    fixed={
                      racesWait
                        ? (copying ? copyOfEvent : EVENTS.form).fields.map((one) => one.name)
                        : undefined
                    }
                    /* And nothing at all beneath a gathering or a training, which
                       have no races (owner, 23.08.2026). The rows are kept where
                       they are rather than thrown away, because the owner said in
                       the same breath what changing the kind does and does not do:
                       „prvo se sakriju sve trke sa ekrana, ali mogu da se vrate
                       ukoliko vratiš da je tip Trka. Ako se sačuva kao neki drugi
                       tip, u to čuvanje spada i brisanje svih trka koje su bile
                       povezane."

                       So this hides and the save deletes, and the two are not the
                       same moment. */
                    beneath={(values) => (
                      <EventRaces
                        eventName={
                          String(values.name) === '' ? t('admin.events') : String(values.name)
                        }
                        eventDate={String(values.date)}
                        rows={current}
                        onRows={setCurrent}
                        refused={refused}
                        /* Handed the kind rather than left off the screen when it is
                           not a race: it draws no table either way, but kept here it
                           goes on remembering the day the rows were lined up with.
                           Taken off, it forgets, and the rows stop following the
                           event as soon as somebody touches the kind. What it draws
                           without a table is the races the route would not take away
                           (`notSaved`, below), which have nowhere else to be named. */
                        hasRaces={kindOf(values) === 'race'}
                        notSaved={{ rows: refusedRows, kept: keptRaces }}
                      />
                    )}
                    /* One press writes the event and every one of its mornings, so
                       one unfinished row is the whole press refused (owner,
                       23.08.2026: „validacija mi ne da da nastavim dalje dok svaki
                       red nema sve obavezne podatke"). */
                    steps={steps}
                    alsoRefuses={(values) => {
                      /* And nothing to refuse where there are no races to finish:
                         a gathering or a training has no table at all, so a row
                         left half typed before the kind was changed must not hold
                         the save. It is deleted by that save rather than asked
                         about (owner, 23.08.2026). */
                      const short = kindOf(values) === 'race' && !allFinished(current)

                      setRefused(short)

                      if (short) {
                        return 'admin.form.racesRefused'
                      }

                      /* And a save that would take the races away waits for the
                         results, exactly as the row that deletes the whole event
                         does (`admin.waitingForResults` below). Until that file is
                         here there is nothing to take along, and a round measured
                         what that costs: with the results refused, every race went
                         and every result stayed, each still counting in the standing
                         and pointing at a race that does not exist, while the screen
                         said „Sačuvano".

                         Asked of the state and not of the list: an empty list is the
                         same answer for a file still on its way, a file that failed,
                         and an event that truly has no results.

                         And only where this save would really take something away.
                         Measured by a round: asked of the kind alone, a gathering
                         with no races at all, and a gathering being entered for the
                         first time, were both refused while the file of results was
                         on its way, over a deletion that was never going to happen,
                         with a message about deleting. That file is the largest the
                         portal has, and this screen is built to work without it.

                         The two words the delete row uses, and for the same reason:
                         a file on its way and a file that failed are not the same
                         news, and „waiting" over a file that will never come is a
                         screen that asks somebody to wait forever. */
                      /* Counted over what the save really deletes, which is the list
                         as it was filed and not the rows on the screen. Measured by a
                         round when it was counted over the rows: delete the one row
                         of an event, change the kind, press Sačuvaj, and the guard
                         let it through while the save still took that race down and
                         left its result behind, counting in the standing and pointing
                         at a race that is gone.

                         Races and not results, and that is the whole of it: a result
                         only exists where a race did, so an event with no filed race
                         has nothing on its address either. Which is also why the case
                         of results without races is closed here rather than measured:
                         the only way to make one was the fault above. */
                      /* Counted the way the save counts: a filed race that no surviving
                         row keeps is a race this save takes away, whatever the kind.
                         Asked of the kind alone it covered only the sweep that empties
                         a whole event, and let a single deleted row through while that
                         row's results were still on their way, which is the same fault
                         the round above measured, one race at a time instead of twelve.
                         Where the kind is not a race nothing survives at all, so every
                         filed race counts, exactly as it did before. */
                      const survives =
                        kindOf(values) === 'race'
                          ? new Set(current.filter((row) => row.id !== '').map((row) => row.id))
                          : new Set<string>()

                      const takesAway = allRaces.some(
                        (one) => String(one.eventId) === under && !survives.has(String(one.id)),
                      )

                      if (!takesAway || results !== null) {
                        return undefined
                      }

                      return resultsFailed ? 'admin.resultsFailed' : 'admin.waitingForResults'
                    }}
                    editing={
                      openEvent === undefined ? editing : { mode: 'one', record: openEvent }
                    }
                    /* The date, and only where the address asked for a record. A
                       form that grabs the cursor is a form that has taken the page
                       away from whoever opened it, and the copy is the one case
                       where the cursor already knows where it is wanted. */
                    /* And a copy is the other way in, which it became on 28.09.2026: the
                       address used to carry `?zapis=` for it too, because the copy was a
                       record by then, so `asked` covered both. It names the event being
                       copied FROM now, and left as it was the cursor stopped landing in
                       the date on the one screen the owner asked for it (03.08.2026). */
                    openAt={chosen === null && copying ? 'date' : undefined}
                    /* Not onto an address another event already answers at. A copy
                       keeps the name and the day it was copied from, so saving one
                       without changing the date wrote a second event at the first
                       one's address, and everything that joins to an event by
                       address then meant both: deleting either took the other's
                       results with it (entityForms.ts, `eventClash`).

                       AND NOT WHILE ITS RACES WAIT, which is the coordinator's reasoning
                       from the owner's sentence of 03.10.2026 and not his words. A press
                       then sends no event, so there is no address being written to ask
                       about; and a NEW event is in this screen's list by then under the
                       very address its form shows (`saveOne`), so asked anyway, the event
                       would be refused for colliding with itself and its races could
                       never be sent. Asked of the ref, like the press itself. */
                    also={(values) =>
                      waitingFor.current !== null
                        ? {}
                        : eventClash(
                            values,
                            all
                              .filter(
                                (each) =>
                                  String(each.id) !==
                                  (editing.mode === 'one'
                                    ? String(editing.record[EVENTS.idField])
                                    : ''),
                              )
                              .map((each) => each.slug),
                            /* The same record the editor was handed, so the address
                               the clash is tested against is the address the save
                               will write. Undefined where a new event is being
                               entered, which is what says there is nothing to
                               keep. */
                            openEvent,
                          )
                    }
                    save={saveOne}
                    /**
                     * The event follows its first morning (owner, 10.08.2026): its
                     * date is the day it begins, so a race entered on an earlier
                     * one makes that day the event's.
                     *
                     * Folded into the values rather than written over the record
                     * afterwards, because the address is derived from the date and
                     * the confirmation is drawn from the values: moved after the
                     * fact, the screen said „Datum 30/01/2027 … Adresa
                     * podgoricka-desetka-2027" over a record filed on 30.12.2026,
                     * and the address kept a year the event was no longer in.
                     * Measured 23.08.2026.
                     */
                    alsoFolds={(values) => {
                      /* And only where there are races to follow. A gathering or a
                         training has none, and the same press that saves it takes
                         the rows away, so a row still standing must not decide the
                         day.

                         Measured by a round before this line was here: an event on
                         16/01/2027 saved as a gathering with 15/11/2027 typed in
                         kept 16/01/2027, because the earliest race said so, and the
                         address is derived from the date, so a year's difference
                         left the event answering at the wrong one. The day a person
                         typed was overruled by a race that press deleted. */
                      const first = (kindOf(values) === 'race' ? current : [])
                        .map((row) => isoDate(row.date))
                        .filter((day) => day !== '')
                        .sort()[0]
                      /* THE EVENT'S OWN DAY READ OFF EITHER SHAPE, AND THE FOLD WRITTEN IN THE
                         RECORD'S. This is asked twice: over what was typed, by the rule that
                         refuses a clash, and over what the form hands over, which since
                         02.10.2026 keeps its day the way a record does (`forms/records.ts`,
                         `storedDates`). Folded into the typed shape, the second asking put
                         dd/mm/gggg on the wire; the first only measures an address, and
                         `eventSlug` reads both. */
                      const asTyped = isoDate(String(values.date))
                      const own = asTyped === '' ? String(values.date) : asTyped

                      return first === undefined || first === own
                        ? values
                        : { ...values, date: first }
                    }}
                    onCreated={setJustMade}
                    onDone={() => {
                      setChosen(null)
                      /* And the address forgets it, so leaving the form and coming
                         back to this screen does not open it again. */
                      setParams({}, { replace: true })
                      /* AND WHAT THE FORM HELD IS FORGOTTEN WITH IT, all five things, by the one
                         function every way into or out of a form calls. Left standing, the event
                         whose races waited would answer for a form that has nothing to do with it:
                         the next event opened or entered would send only races, under the wrong
                         event, which is the shape the ref this replaced (`madeHere`) was measured
                         to have before leaving the form cleared it. What a reader who leaves gives
                         up is the races that still waited, and none of it is handed to the next
                         form (`forgetTheForm`). */
                      forgetTheForm()
                    }}
                  />
                )}
              </>
            )
          }

          /**
           * WHAT ELSE THIS DELETION TAKES, SAID WITH A NUMBER, AND THE TWO STATES IT HAS.
           *
           * <p>Owner, 28.09.2026, choosing between three outcomes he was priced: the
           * button works at once, and before the deletion is sent the reader is told how
           * many results go with it. The gate that used to stand here instead HELD THE
           * BUTTON BACK until the results arrived, because this screen took them down
           * itself; the route deletes the event in one statement and the schema cascades
           * them (`result_race_fk` from the race), so there is nothing left to wait for.
           *
           * <p><b>Counted through the RACES and not through the address</b>, because that
           * is what the database will really do. A result names its event by address as
           * well, and the two answers differ exactly where two events answer at one
           * address - the window a copy opens before its day is changed - so the address
           * would say „and 40 results" over an event that has none of them.
           *
           * <p><b>The second state is that the number is not yet known, and it is said
           * rather than guessed.</b> The results are the largest file the portal has and
           * this screen deliberately draws without waiting for it, so a press can land
           * before it is here. An approximate number is what the owner's decision rules
           * out; nought would be a lie in the one direction that costs something. So the
           * question says the number is not known, and the deletion still works, which is
           * the half of his decision that replaced the waiting.
           *
           * <p><b>A file on its way and a file that failed get ONE sentence here, and
           * that is a change from the gate this replaces</b>, which had two. The
           * difference mattered while it decided whether to WAIT - „waiting" over a file
           * that will never come asks somebody to wait forever. It decides nothing now,
           * and to the reader about to press, both states are the same fact: the portal
           * cannot tell him the number at this moment.
           */
          const goingWith = (event: BtlEvent): string => {
            if (results === null) {
              return t('admin.eventDeleteCountUnknown')
            }

            const mine = new Set(
              allRaces.filter((race) => race.eventId === event.id).map((race) => String(race.id)),
            )

            return t('admin.eventDeleteTakes', {
              count: results.filter((made) => mine.has(String(made.raceId))).length,
            })
          }

          const needle = search.trim().toLowerCase()
          const found = all
            .filter((one) => (needle === '' ? one.date >= today : true))
            .filter((one) => `${one.name} ${one.city}`.toLowerCase().includes(needle))
            .sort((left, right) => left.date.localeCompare(right.date))
          /* Sixty rows and no more, of eleven hundred. */
          const rows = found.slice(0, 60)

          return (
            <>
              <EntityBar
                entity={EVENTS}
                onNew={() => {
                  /* Same reason as `onDone`, and reachable without it: a form opened from
                     the address (`?kopija=`, `?izmena=`) goes away when the address does - the
                     browser's Back, a link to this list - and `onDone` is never called. A fresh
                     "new" editor must then inherit nothing of it: not the event whose races
                     waited, or its first press would send only races, under that event, and make
                     nothing; and not the table the form held, or it would write the rows of a
                     copy under the new event. */
                  forgetTheForm()
                  setChosen({ mode: 'new' })
                }}
              >
                <div className="rankings__filters">
                  <label className="rankings__field rankings__field--wide">
                    <span>{t('competitors.search')}</span>
                    <input
                      type="search"
                      value={search}
                      placeholder={t('admin.searchEvents')}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>
              </EntityBar>

              {/* And how many were left out, which used to be said only on the
                  screen of races. That screen is gone since 06.08.2026 and this
                  one is the way to every race, so a search that matches five
                  hundred events drew sixty of them, the earliest sixty, and said
                  nothing: everything from this season on was behind a cut with
                  no sign of it. */}
              <p className="rankings__count">
                {t('admin.showing', { count: rows.length })}
                {found.length > rows.length ? ` ${t('admin.ofMany', { count: found.length })}` : ''}
              </p>

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.events')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('profile.columns.date')}</th>
                      <th scope="col">{t('profile.columns.event')}</th>
                      <th scope="col">{t('event.place')}</th>
                      <th scope="col">{t('event.races')}</th>
                      <th scope="col">{t('admin.field.kind')}</th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.id}>
                        <td>{formatShortDate(one.date, locale)}</td>
                        {/* Read here and changed on the form, unlike the town
                            beside it: the address an event answers at is made
                            out of its name and its year (entityForms.ts), and a
                            cell writes one field and cannot put the address
                            right after it. Renamed in a cell, an event kept the
                            address of the name it used to have. */}
                        <td>{one.name}</td>
                        {/* Read here and changed on the form, like the name
                            beside it. A town carries the country it is in and a
                            cell writes one field, so a town corrected here left
                            the event in the country of the town it used to be
                            in, and nothing on any screen shows a country. */}
                        <td>{one.city}</td>
                        {/* Counted from the races themselves rather than from
                            a list the event carries. The list is filled by the
                            generator and by nothing else, so an event entered or
                            copied here said it had none while its races were in
                            the next screen along. */}
                        <td>{allRaces.filter((race) => race.eventId === one.id).length}</td>
                        {/* What is being put on, in words. Every event has a
                            kind: the type requires it, the form opens on Trka,
                            and the copy carries it (owner, 10.08.2026). There
                            is no fallback here, and the day a backend answers
                            without the field this cell prints the name of the
                            key, which is the loudest way to find out. */}
                        <td>{t(`event.kind.${one.kind}`)}</td>
                        <td>
                          <RowActions
                            entity={EVENTS}
                            record={one}
                            name={one.name}
                            onOpen={() => {
                              /* Same reason as `onNew`: opening a served event must not
                                 inherit anything of a form that went away without `onDone`,
                                 or its first press sends only races, under THAT event, and
                                 never writes this one. */
                              forgetTheForm()
                              setChosen({ mode: 'one', record: one })
                            }}
                            asksWith={goingWith(one)}
                            /* WITH ITS RACES AND ITS RESULTS, AND THE DATABASE IS
                               WHAT TAKES THEM. `DELETE /api/events/{id}` is one
                               statement, and `race_event_fk`, `attending_event_fk`
                               and `event_comment_event_fk` all cascade from the
                               event while `result_race_fk` cascades from the race
                               (`EventWriteApi`'s own class note names all four).

                               So the loop that used to stand here is gone, and its
                               going is the point rather than a tidy-up: it filed
                               the races and the results as SESSION deletions, which
                               `useLive` reads (`data/useResource.ts`), so a
                               moderator who deleted an event took it off the public
                               calendar for the rest of his visit while the row
                               stood in the database and every other visitor still
                               saw it. Written on this side as well it would now be
                               a second answer to a question the schema has already
                               answered.

                               The `shares` guard went with it for the same reason,
                               and nothing is lost: it existed because a result is
                               joined to its event by ADDRESS, so two events at one
                               address made it impossible to say whose result was
                               whose. The cascade joins by the race's own key, which
                               answers for one race and no other. */
                            deleteRecord={() => deleteOne(one)}
                          />
                          {/* Beside the row it was pressed on, because a refusal that
                              named no row would be a sentence about one of sixty. The
                              same place `admin/AdminLeagues.tsx` puts it. */}
                          {refusedDelete !== null &&
                            refusedDelete.id === one.id &&
                            saying(refusedDelete.answer, WHEN_WRITING_AN_EVENT)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Said once and politely: the list beside it has already changed, and a
                  reader who is not looking at it gets the one sentence that says so.
                  The same shape `admin/AdminLeagues.tsx` uses. */}
              <p aria-live="polite" className="visually-hidden">
                {said}
              </p>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
