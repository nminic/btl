import { useRef, useState } from 'react'
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
   * THE EVENT THIS EDITOR HAS ALREADY MADE ON THE SERVER, so a second press changes it
   * rather than making another one.
   *
   * <p><b>A press can end without the form closing, and that is new.</b> The session write
   * could not fail, so „pressed twice" meant nothing; a route can accept the event and then
   * refuse one of its mornings, and the editor stays open with everything still typed so the
   * reader can put the race right and press again. Without this, that second press would
   * `POST` a second event - at the same address, so the route would answer
   * `theAddressIsTaken` and the reader would be told his event is a duplicate of itself.
   *
   * <p>A ref and not state, for the same reason `EntityEditor`'s own `asking` is one: it is
   * read inside the press that is running, and a value React has not re-rendered yet is a
   * value the next press reads as it was.
   */
  const madeHere = useRef<number | null>(null)

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
          const editing: Editing | null =
            chosen ?? (copySource === undefined ? null : { mode: 'new', start: asCopied(copySource) })

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
             * @returns the answer that refused one of them, or null where every one went
             *          through
             */
            async function writeTheRaces(
              values: FormValues,
              eventId: string,
            ): Promise<Exclude<Answer, { got: 'done' }> | null> {
              const was = allRaces.filter((one) => String(one.eventId) === eventId)
              const kept =
                kindOf(values) === 'race'
                  ? new Set(current.filter((row) => row.id !== '').map((row) => row.id))
                  : new Set<string>()

              for (const race of was) {
                if (!kept.has(String(race.id))) {
                  const answer = await askTheServer(`/api/races/${String(race.id)}`, {}, 'DELETE')

                  if (answer.got !== 'done') {
                    return answer
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
                  return answer
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

                       AND WHEN `held` HAS NOT CAUGHT UP TO `current` AT ALL, which is what
                       a copy meets on its very first press. A copy opens this table
                       already holding new rows nobody has touched (`copiedRows`), so
                       `held` is still what this screen mounted with - `{ of: '', rows: [] }`
                       - and `before.of !== under`. Matched against `before.rows` there,
                       `row` is an object no array on screen holds: the map ran over an
                       EMPTY array, the identity this race was just given never reached
                       anywhere, and a retry after a later row's refusal read the row's own
                       key as still blank and DELETEd the very race this press had just made
                       (nezavisna recenzija, 28.09.2026, visok nalaz). `row` is an element of
                       `current` whichever way `held` stands, because that is the array this
                       loop is walking - so falling back to it is what lets the first write
                       of a visit find itself, and `of` is written down in the same update so
                       every row after this one in the same press, and a retry after it,
                       agree on which table they are correcting. */
                    setHeld((before) => {
                      const rows = before.of === under ? before.rows : current

                      return {
                        of: under,
                        rows: rows.map((each) => (each === row ? { ...each, id: String(made) } : each)),
                      }
                    })
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

              return null
            }

            /**
             * THE EVENT AND ITS MORNINGS, IN ONE PRESS, AGAINST THE ROUTES.
             *
             * <p>`POST /api/events` answers 201 with the id AND the address it filed the event
             * under, `PUT` answers 200 with the same pair, and both are read off the answer
             * rather than worked out here. This portal knows the address rule and so does the
             * server (`eventWrites.ts`, `writtenIn`); the route is the one that decides.
             *
             * <p><b>WHAT HAPPENS WHEN THE EVENT GOES THROUGH AND A RACE DOES NOT, which is the
             * one thing this press must never lie about.</b> The event is on the server at that
             * point. Answering „it was not saved" would send the reader to enter it again, onto
             * its own address, and the route would tell him it is taken. So the refusal that
             * comes back says the truth in one sentence - the event is saved, a race is not -
             * and the form stays open with everything he typed, so he can put the row right and
             * press again. `madeHere` is what makes that second press a change rather than a
             * second event.
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
              /* THE RECORD THE FORM IS OPEN ON WINS OVER THE REF, where there is one.
                 Found by a nezavisna recenzija: read as `madeHere.current ?? …`, the ref
                 answered first and `editing.record` was only ever reached on a session
                 that had made nothing yet, so a ref left standing by an EARLIER session
                 outranked the record plainly on screen - a served event opened after a
                 new one was entered saved onto the new one's address instead of its own.
                 `editing.record` is the truth about which single record this is; the ref
                 is only ever needed where there is no record at all to ask, a "new" form
                 that has already written one and is being pressed again. */
              const standing =
                editing !== null && editing.mode === 'one'
                  ? Number(editing.record[EVENTS.idField])
                  : madeHere.current
              const answer = await askTheServer(
                standing === null ? '/api/events' : `/api/events/${String(standing)}`,
                upsertFrom(values),
                standing === null ? 'POST' : 'PUT',
              )

              if (answer.got !== 'done') {
                return { said: saying(answer, WHEN_WRITING_AN_EVENT) }
              }

              /* THE NEXT MOUNT READS THE SERVER AND NOT THIS VISIT'S FIRST ANSWER. All three
                 names, because one press moves all three: the event, its races, and the
                 results the database takes down with a race that goes. Cleared before the
                 races are written rather than after, so a press that fails half way still
                 leaves the next mount reading what really stands. */
              clearResourceCache('events')
              clearResourceCache('races')
              clearResourceCache(RESULTS)

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

              madeHere.current = made.id

              const refusedRace = await writeTheRaces(values, String(made.id))

              if (refusedRace !== null) {
                return {
                  said: (
                    <>
                      <p className="field__error" role="alert">
                        {t('admin.eventSavedRacesRefused')}
                      </p>
                      {saying(refusedRace, WHEN_WRITING_A_RACE)}
                    </>
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

              return { written: String(made.id) }
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

            return (
              <>
                {(
                  <EntityEditor
                    entity={EVENTS}
                    /* What a copy is not asked for: it has its town, its country
                       and its kind out of the event it came from, and none of the
                       three is in question (owner, 23.08.2026). A save writes the
                       fields it carries, so what is not asked stays as it was. */
                    form={copying ? copyOfEvent : undefined}
                    titleKey={copying ? 'admin.form.copying' : undefined}
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
                           not a race: it draws nothing either way, but kept here it
                           goes on remembering the day the rows were lined up with.
                           Taken off, it forgets, and the rows stop following the
                           event as soon as somebody touches the kind. */
                        hasRaces={kindOf(values) === 'race'}
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
                       results with it (entityForms.ts, `eventClash`). */
                    also={(values) =>
                      eventClash(
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

                      return first === undefined || first === isoDate(String(values.date))
                        ? values
                        : { ...values, date: fieldDate(first) }
                    }}
                    onCreated={setJustMade}
                    onDone={() => {
                      setChosen(null)
                      setJustMade(null)
                      setHeld({ of: '', rows: [] })
                      setRefused(false)
                      /* And the address forgets it, so leaving the form and coming
                         back to this screen does not open it again. */
                      setParams({}, { replace: true })
                      /* AND THE EVENT THIS SESSION MADE IS FORGOTTEN HERE TOO, not only
                         what the form held. Left standing, `madeHere` answered for a
                         session that had not made anything: two events entered one
                         after another sent the second's save as a change to the first
                         (`saveOne`, `standing`), because leaving the form was never
                         where the identity it remembers was cleared. */
                      madeHere.current = null
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
                  /* Same reason as `onDone`: a fresh "new" editor must never read the
                     event a PAST session made off `madeHere`, or its first press
                     changes that one instead of making its own. */
                  madeHere.current = null
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
                                 inherit a ref a session that made a DIFFERENT one left
                                 behind, or its first press changes that one instead of
                                 the record just opened. */
                              madeHere.current = null
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
                            deleteRecord={() => void deleteOne(one)}
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
