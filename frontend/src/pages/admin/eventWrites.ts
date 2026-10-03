import type { RaceRow } from './raceRows'
import { asksLength, asksLimit, storedRow } from './raceRows'

/**
 * WHAT THE TWO SCREENS THAT WRITE AN EVENT SEND, AND WHAT EVERY REFUSAL OF IT IS CALLED.
 *
 * <p>Its own module rather than a constant beside either screen, which is the arrangement
 * `admin/leagueWrites.ts` already has and the reason it gives: `react/only-export-components`
 * asks for it, and a test reading a component file to get at a table is a test that mounts
 * React to ask a question about a list.
 *
 * <p><b>Two screens and not one, which is the whole reason this is shared.</b>
 * `admin/AdminEvents.tsx` enters, changes and deletes an event; `pages/event/EventActions.tsx`
 * copies one into the next season and deletes one from the event's own page. Both were
 * writing into the session overlay until this, so both went the moment the reader pressed
 * F5, and the deletion took the event off the PUBLIC calendar for the rest of the visit
 * while the row stood in the database (`data/useResource.ts`, `useLive`).
 */

/**
 * WHAT `POST /api/events` AND `PUT /api/events/{id}` TAKE, which is
 * `EventWriteApi.Upsert` and nothing besides.
 *
 * <p><b>The whole record travels on every save.</b> `EventWriteApi.change` writes one
 * `update` naming every column, so a field left out is a field blanked rather than a field
 * left alone - the opposite of `PUT /api/me`, which writes through a `coalesce` (ADL A54).
 *
 * <p><b>`placeId` is always null from this portal, and that is a fact about the form rather
 * than a gap.</b> The route takes a town in one of two ways and refuses both at once
 * (`theTownIsNotSaidOnce`): out of the world codebook by its key, or typed by hand with the
 * country said beside it. The place control writes a town and a country as text and knows
 * no key at all (`forms/PlaceField.tsx`, and `forms/FormRenderer.tsx` writes `country`
 * beside the field), so every event this portal sends is the second kind. Sent as a field
 * that is always null rather than left off the type, so the day a codebook key reaches the
 * form there is one place to fill in.
 */
export type Upsert = {
  name: string
  date: string
  placeId: number | null
  city: string
  country: string
  kind: string
  featured: boolean
  description: string
  link: string
}

/**
 * The event as the FORM holds it, in the shape the route takes.
 *
 * <p><b>`featured` is a flag on the wire and the word „yes" in the form.</b> `forms/types.ts`
 * holds every value as a string or a flag, and the control is a select of two words
 * (`entityForms.ts`, `start: { featured: 'no' }`), so the comparison is against the word the
 * control writes. Read as `Boolean(values.featured)` instead, the string „no" is true and
 * every event would go in singled out.
 *
 * <p><b>`description` and `link` are optional on the form and NOT NULL nowhere</b>, so a
 * missing one becomes the empty string rather than `undefined`: a field dropped from the
 * JSON is a field the route reads as null, and `EventWriteApi.whatIsWrongWith` checks the
 * shape of a link before it looks at whether there is one.
 *
 * <p><b>AND THE DAY AS IT IS HANDED, WHICH IS ALREADY THE SHAPE THE ROUTE TAKES.</b>
 * `EventWriteApi.Upsert` takes a `LocalDate`, which Jackson reads as ISO-8601 and as nothing
 * else: there is no date format configured anywhere under `backend/src/main/resources`, so
 * the reader's `16/01/2027` is not a date the route can read at all.
 *
 * <p><b>What that cost, measured on the wire on 29.09.2026 rather than reasoned about.</b>
 * Both roads sent the reader's shape - `POST /api/events` carried `"date":"08/05/2027"` and
 * `PUT /api/events/{id}` carried `"date":"16/01/2027"` - so Jackson refused the body before
 * this portal's route was entered at all. What comes back is then Spring's own 400 with no
 * `reason` in it, `askTheServer` reads that as `{got:'wrong'}`, and the screen says „Server
 * je odgovorio brojem 400 i ništa nije promenjeno" over a form that is perfectly filled in.
 * No event could be saved, neither a new one nor one being changed, and
 * `pages/account/refusals.test.ts` could not see any of it: that floor holds the NAMES a
 * route can answer with, and a body the route cannot parse never reaches a name.
 *
 * <p><b>That conversion was made HERE, through `isoDate`, from 29.09.2026 to 02.10.2026, and
 * it is not made here any more.</b> The owner decided on 02.10.2026 that the conversion of a
 * date from a form has ONE place for every form (`btl-produkt/PDL.md`, „Odluke iz ciscenja
 * nalaza"): `FormRenderer` hands its values over through `forms/records.ts`'s `storedDates`,
 * so what this function is handed is already `gggg-mm-dd`. Converted here as well, it would be
 * `isoDate` over `gggg-mm-dd`, which is nothing at all, and every event would go over with no
 * day. `dateOnTheWire.test.tsx` reads what really went over.
 *
 * <p><b>The table of mornings beside it keeps a conversion of its own</b> (`admin/raceRows.ts`,
 * `storedRow`), because a race is not entered through a form: its rows are controls this screen
 * draws itself, and `storedRow` is the one place they are converted.
 *
 * <p><b>Still NEVER in `valuesFor`.</b> `admin/entityForms.ts`'s `addressOfEvent` reads
 * `values.date` to build the address an event answers at, while the form is open as well as
 * after it is sent, and `eventSlug` takes either shape of a day for exactly that reason. What
 * a form OPENS with stays the reader's shape.
 */
export function upsertFrom(values: Record<string, string | boolean>): Upsert {
  const text = (name: string): string => String(values[name] ?? '')

  return {
    name: text('name'),
    date: text('date'),
    placeId: null,
    city: text('city'),
    country: text('country'),
    kind: text('kind'),
    featured: text('featured') === 'yes',
    description: text('description'),
    link: text('link'),
  }
}

/**
 * AND WHAT `POST /api/races` AND `PUT /api/races/{id}` TAKE, which is `RaceWriteApi.Upsert`.
 *
 * <p>Beside the event's own rather than in a module of its own, because the one press that
 * saves an event saves its mornings with it (owner, 23.08.2026) and the two bodies are
 * built in the same breath.
 *
 * <p><b>The limit and the length are NULL where the kind does not fix them, and never
 * nought.</b> The route takes each of the two exactly where the kind calls for it and
 * refuses it anywhere else (`RaceWriteApi.whatIsWrongWith`, V7's pair of checks said from
 * the request's side), and nought is a value sent rather than one left out: a race of a
 * length carrying `"limitSeconds": 0` is refused with `theLimitBelongsToATimedRace`. The
 * RECORD still carries nought for both (PDL, 30.08.2026: a race that fixes no length
 * carries nought), and the route is what writes it there (`RaceWriteApi.checked`).
 */
export type RaceUpsert = {
  eventId: number
  name: string
  renamed: boolean
  date: string
  kind: string
  /** In seconds, on a timed race only. */
  limitSeconds: number | null
  /** On a race of a length only. */
  distanceKm: number | null
  ascentM: number
  descentM: number
}

/**
 * One row of the table of mornings, in the shape the route takes.
 *
 * <p><b>Built on `storedRow` rather than beside it</b>, because `storedRow` is the one door
 * a row leaves by: it reads the comma, turns hours into seconds and works out the day. What
 * it hands back is the RECORD, and the record carries nought for the measure a kind does
 * not fix.
 *
 * <p><b>THE WIRE IS NOT THE RECORD, and taking one for the other is what the owner met on QA
 * on 03.10.2026.</b> This sent the record's nought until then, so every race of a length went
 * over with a limit of nought and every timed race with a length of nought, and the route
 * refused all of them: `POST /api/events` answered 201, the first `POST /api/races` answered
 * 400, and an event the owner had just entered with its races stood with none. Nothing on
 * this side could see it, because `test/setup.ts` answers `/api/races` with a stub that
 * takes any body; `racesOnTheWire.json` is now what this function sends for one race of
 * each kind, and `RaceWriteApiTest` replays it against the real route.
 *
 * <p><b>Whether the kind fixes a measure is asked of `asksLimit` and `asksLength`</b>, the one
 * home that question has in `raceRows.ts`, and never of what the cell still holds: a reader
 * may type a limit, change the kind and save, and the cell keeps the hours he typed.
 *
 * <p>What `storedRow` hands back is text, because the overlay keeps every value as text
 * (`session/context.ts`); the route takes numbers and a flag, so they are read back out
 * here and nowhere else.
 */
export function raceUpsertFrom(row: RaceRow, eventId: string): RaceUpsert {
  /* Read by name off a shape that names them (`raceRows.StoredRace`). It answered an
     index signature until 28.09.2026, and under `noUncheckedIndexedAccess` that made every
     read `string | undefined` and forced a fallback for a key `storedRow` always writes -
     a branch nothing could ever take. The keys are declared where they are filled instead. */
  const stored = storedRow(row, eventId)

  return {
    eventId: Number(eventId),
    name: stored.name,
    renamed: stored.renamed === 'true',
    date: stored.date,
    kind: stored.kind,
    limitSeconds: asksLimit(row) ? Number(stored.limitSeconds) : null,
    distanceKm: asksLength(row) ? Number(stored.distanceKm) : null,
    ascentM: Number(stored.ascentM),
    descentM: Number(stored.descentM),
  }
}

/**
 * THE IDENTITY AND THE ADDRESS THE SERVER HANDED OUT, READ OFF THE ANSWER.
 *
 * <p>`EventWriteApi.add` answers 201 with `{"id": …, "slug": …}` and `change` answers 200
 * with the same pair, and BOTH halves are needed. The id is what the row, the delete and
 * every race under it are addressed by; the address is what a result joins to an event by,
 * and what an administrator copies into a link.
 *
 * <p><b>Why the address is read back rather than worked out here, which is a measurement
 * and not a preference.</b> This portal knows the rule: `entityForms.ts`'s `addressOfEvent`
 * builds the address off the name and the year and KEEPS the old one where the rule would
 * build the same thing, so that an event put off by a week keeps everything joined to it
 * (owner, 10.08.2026). `EventAddress.keptOrRebuilt` is that same rule on the server. Two
 * homes of one fact agree today and have no guard saying they must; the route is the one
 * that decides, so its answer is what is written down.
 *
 * <p><b>Read without an assertion (ADL A14)</b>, the same way `admin/leagueWrites.ts` reads
 * an identity: what comes off the wire is `unknown` and is narrowed by looking at it, so an
 * answer of another shape says „nothing of the kind is here" rather than being claimed to
 * hold it.
 *
 * <p><b>A whole number above nought</b>, because `btl_event.id` is a `bigserial` and starts
 * at one. Nought and below is the range the session overlay used to hand out
 * (`admin/raceIds.ts` counts down from nought), so an answer carrying one of those would be
 * the very fault this read exists to end.
 */
export function writtenIn(body: unknown): { id: number; slug: string } | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const id: unknown = Reflect.get(body, 'id')
  const slug: unknown = Reflect.get(body, 'slug')

  return typeof id === 'number' && Number.isInteger(id) && id > 0 && typeof slug === 'string'
    ? { id, slug }
    : null
}

/**
 * AND THE SAME FOR A RACE, which answers with its own three.
 *
 * <p>`RaceWriteApi.Written` carries `id`, `eventDate` and `eventSlug`: writing a race can
 * MOVE the event it hangs off, because an event follows its earliest morning (owner,
 * 10.08.2026). Only the id is read here, and that is deliberate - what the screen does with
 * a saved event is re-read it, so the day and the address come back from the file rather
 * than from this answer, and there is one home for them.
 */
export function raceWrittenIn(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const id: unknown = Reflect.get(body, 'id')

  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null
}

/**
 * THE ELEVEN REFUSALS AN EVENT BEING WRITTEN CAN MEET, each to a sentence in the dictionary.
 *
 * <p>`pages/account/refusals.test.ts` reads `EventWriteApi.java` and requires this table to
 * cover every `static final String` it declares, in both directions, so a twelfth arrives as
 * a red gate rather than as a code somebody cannot read.
 *
 * <p><b>Two of these cannot be reached from the form and are answered all the same.</b>
 * `theTownIsNotSaidOnce` and `theCountryBelongsToATypedTown` are about a town said in two
 * ways at once, and this portal only ever says it in one (see `Upsert` above). They are here
 * because the gate is over what the ROUTE can answer, not over what this screen expects: a
 * request can still lose a race against what the screen believes, and a reader told
 * `theTownIsNotSaidOnce` in English has been told nothing.
 */
export const WHEN_WRITING_AN_EVENT: Record<string, string> = {
  theFormIsNotComplete: 'admin.eventSaveRefused.theFormIsNotComplete',
  theKindIsNotKnown: 'admin.eventSaveRefused.theKindIsNotKnown',
  theTownIsNotSaidOnce: 'admin.eventSaveRefused.theTownIsNotSaidOnce',
  theTownIsNotKnown: 'admin.eventSaveRefused.theTownIsNotKnown',
  theCountryIsNotKnown: 'admin.eventSaveRefused.theCountryIsNotKnown',
  theCountryBelongsToATypedTown: 'admin.eventSaveRefused.theCountryBelongsToATypedTown',
  aTypedTownNamesItsCountry: 'admin.eventSaveRefused.aTypedTownNamesItsCountry',
  theLinkIsNotShaped: 'admin.eventSaveRefused.theLinkIsNotShaped',
  theAddressIsTaken: 'admin.eventSaveRefused.theAddressIsTaken',
  theDateWouldMoveAResultToAnotherYear:
    'admin.eventSaveRefused.theDateWouldMoveAResultToAnotherYear',
  theRaceCountsInALeagueOfItsSeason: 'admin.eventSaveRefused.theRaceCountsInALeagueOfItsSeason',
}

/**
 * AND THE TWELVE A RACE CAN MEET.
 *
 * <p>Its own table and not folded into the one above, although one press meets both: they
 * are two files on the server and `refusals.test.ts` counts per file, so folded together a
 * reason dropped from one class would be excused by the other still declaring it.
 *
 * <p><b>Four names appear in both tables under two different keys, and that is the point
 * rather than a duplication.</b> The route answers one word; what it means to the reader
 * depends on what he pressed. `theAddressIsTaken` on the event form is „another event
 * already answers at this address"; on a race it is about the race's own. The same division
 * `leagueWrites.ts` keeps for `theSeasonIsFrozen`, and for the same reason: one sentence
 * covering both would be half wrong in each place.
 */
export const WHEN_WRITING_A_RACE: Record<string, string> = {
  theFormIsNotComplete: 'admin.raceSaveRefused.theFormIsNotComplete',
  theEventIsNotKnown: 'admin.raceSaveRefused.theEventIsNotKnown',
  theEventHoldsNoRaces: 'admin.raceSaveRefused.theEventHoldsNoRaces',
  theRaceCannotChangeEvents: 'admin.raceSaveRefused.theRaceCannotChangeEvents',
  theKindIsNotKnown: 'admin.raceSaveRefused.theKindIsNotKnown',
  theLimitBelongsToATimedRace: 'admin.raceSaveRefused.theLimitBelongsToATimedRace',
  theDistanceBelongsToARaceOfALength: 'admin.raceSaveRefused.theDistanceBelongsToARaceOfALength',
  theDistanceIsNotKeptExactly: 'admin.raceSaveRefused.theDistanceIsNotKeptExactly',
  theClimbOrTheFallIsNegative: 'admin.raceSaveRefused.theClimbOrTheFallIsNegative',
  theRaceCountsInALeagueOfItsSeason: 'admin.raceSaveRefused.theRaceCountsInALeagueOfItsSeason',
  theAddressIsTaken: 'admin.raceSaveRefused.theAddressIsTaken',
  theDateWouldMoveAResultToAnotherYear: 'admin.raceSaveRefused.theDateWouldMoveAResultToAnotherYear',
}
