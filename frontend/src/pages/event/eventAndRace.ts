import { raceKind } from '../../data/raceKind'
import type { BtlEvent, Race, RaceKind } from '../../data/types'
import { fromBoxes } from '../../forms/clock'
import { fieldDate, isoDate } from '../../forms/dateField'
import type { Years } from '../../forms/DatePicker'
import { everyOneNamedExactly, theOneNamedExactly } from '../../forms/exactName'
import { parseNumber } from '../../forms/numberField'
import type { FieldDef, Suggestion } from '../../forms/types'
import { REQUIRED_KEY } from '../../forms/validate'

/**
 * THE EVENT AND THE RACE AT THE TOP OF „UNOS REZULTATA ZA DOGAĐAJ”, the moderator's own screen.
 *
 * <p>PDL P9, owner, 19.10.2026: „Događaj, trka i rezultat u jednoj formi, i za člana na „Mojim
 * rezultatima” i za moderatora”, „Jedan ekran za sve”, and of the block: „Prvo ima naziv događaja koji
 * je autocomplete iz baze, ali mogu da unesem novu vrednost. Ukoliko je nova vrednost, polje trka dobija
 * identičan taj naziv i može da se menja, a ako je postojeća vrednost, polje trka postaje autocomplete u
 * koji se ukucava postojeća ili nova trka.” What the moderator adds to the member's block:
 * <ul>
 * <li>a new event „traži naziv, datum i mesto” (his choice of 19.10.2026), and its one date is the day
 * of its first race, this one („nov događaj ima jedno polje „Datum””);
 * <li>a new race on an event of the calendar asks its own day, which starts as the event's („postojeći
 * nudi „Datum trke” popunjen datumom događaja”), and its kind and what that kind fixes, the way the
 * approval of a run makes one (PDL P9, „Nova trka na postojećem događaju: moderator ... odlučuje vrstu
 * i dužinu”).
 * </ul>
 *
 * <p>The rules shared with the member's form and the queue's panel are theirs and not copied: a name
 * typed exactly links its event (`forms/exactName.ts`), and a new event's name is given to its race
 * until the race is named for itself (the rule `FormRenderer` keeps for `follows`).
 *
 * <p>Its own module, so the screen draws and this decides, and a case about what the screen sends can
 * ask it without mounting anything.
 */

/** The event of the calendar the race goes on, by its key, with what the screen reads of it. */
export type ChosenEvent = { eventId: number; slug: string; date: string }

/** The race of the calendar the rows go on, by its key, and its kind, which decides the rows. */
export type ChosenRace = { raceId: number; kind: RaceKind }

/** The block as its boxes stand. */
export type TheBlock = {
  eventName: string
  event: ChosenEvent | null
  /** The new event's one date, or the new race's day on an event of the calendar, as its box holds it. */
  date: string
  city: string
  country: string
  /** The country the place field wrote because the town was recognised, or nothing. Kept here and not in
   *  the field, which is drawn only while no event of the calendar is chosen and takes what it remembers
   *  with it when it goes (`forms/withThePlace.ts`). */
  countryWrote: string | null
  raceName: string
  race: ChosenRace | null
  kind: RaceKind
  /** What a new race of a length fixes, as the boxes hold it. */
  distanceKm: string
  ascentM: string
  descentM: string
  /** And what a race to a limit fixes, its limit, in the three boxes of a clock. */
  hours: string
  minutes: string
  seconds: string
}

export function emptyBlock(): TheBlock {
  return {
    eventName: '',
    event: null,
    date: '',
    city: '',
    country: '',
    countryWrote: null,
    raceName: '',
    race: null,
    kind: 'length',
    distanceKm: '',
    ascentM: '',
    descentM: '',
    hours: '',
    minutes: '',
    seconds: '',
  }
}

/**
 * A NAME TYPED INTO THE EVENT'S BOX: an event it names exactly is linked, as if chosen; anything else
 * lets go of the event and of a race chosen under it, and the race takes the new name while it is empty
 * or still says what the event said a letter earlier.
 */
export function typingTheEvent(
  block: TheBlock,
  next: string,
  offered: readonly Suggestion[],
  events: readonly BtlEvent[],
): TheBlock {
  const linked = theOneNamedExactly(offered, next)

  if (linked !== undefined) {
    return choosingTheEvent(block, linked, events, next)
  }

  return {
    ...block,
    eventName: next,
    event: null,
    race: null,
    raceName: [block.eventName, ''].includes(block.raceName) ? next : block.raceName,
  }
}

/** AN EVENT CHOSEN, OR TYPED EXACTLY: the race is one of its races or a new one on it, so the race's box
 *  is emptied, and a new race's day starts as the event's. */
export function choosingTheEvent(
  block: TheBlock,
  one: Suggestion,
  events: readonly BtlEvent[],
  shown = one.value,
): TheBlock {
  const event = events.find((each) => String(each.id) === one.id)

  return event === undefined
    ? block
    : {
        ...block,
        eventName: shown,
        event: { eventId: event.id, slug: event.slug, date: event.date },
        date: fieldDate(event.date),
        raceName: '',
        race: null,
      }
}

/** A name typed into the race's box: a race of the calendar is let go of, and this is a new one. */
export function typingTheRace(block: TheBlock, next: string): TheBlock {
  return { ...block, raceName: next, race: null }
}

/** A race chosen from the list under its box: the rows are on it, at what its kind leaves them. */
export function choosingTheRace(block: TheBlock, one: Suggestion, races: readonly Race[]): TheBlock {
  const race = races.find((each) => String(each.id) === one.id)

  return race === undefined
    ? block
    : { ...block, raceName: one.value, race: { raceId: race.id, kind: raceKind(race.kind) } }
}

/** The kind the rows are entered under: the chosen race's, or the new one's. */
export function kindOfTheRows(block: TheBlock): RaceKind {
  return block.race === null ? block.kind : block.race.kind
}

/** The boxes the block draws for a new race, by the kind: its course, or its limit, or nothing. */
export type NewRaceBox = 'distanceKm' | 'ascentM' | 'descentM' | 'hours' | 'minutes' | 'seconds'

export function figuresOfANewRace(kind: RaceKind): readonly NewRaceBox[] {
  return kind === 'length'
    ? ['distanceKm', 'ascentM', 'descentM']
    : kind === 'time'
      ? ['hours', 'minutes', 'seconds']
      : []
}

/** What is wrong with one box of the block: the box, and the words that say it. */
export type BlockWrong = { box: keyof TheBlock & string; key: string }

/** What the block is asked against besides itself: the seasons the server says are open, or nothing
 *  until they are known, and the events offered under the event's box. */
export type TheBlockIsAsked = { open: readonly number[] | null; offered: readonly Suggestion[] }

/**
 * BOX BY BOX, IN THE ORDER THEY ARE DRAWN, what is wrong with the block: a name left empty or one that
 * names several editions without one being chosen, a day that is not a day or is still to come or is
 * not in the year of the chosen event, a new event's town, and what the kind of a new race fixes.
 *
 * <p><b>The day is held to today</b> (PDL P9, owner, 21.10.2026: „Moderator i admin smeju da unose
 * rezultate za BILO KOJU prethodnu godinu”), as the server holds it: a day of any year, those before 2027
 * too, is a day. Until that day this box also refused a day outside the seasons open for a report and a
 * day before the league, and both refusals are gone with their words.
 *
 * <p><b>And a new race on an event of the calendar to that event's year</b> (owner, 22.10.2026, „Ekran 7b:
 * dan trke mora biti u godini izabranog događaja”), in the server's words, with the exception the owner
 * kept the same day: on the morning of 1 January, while two seasons are open, either of them (`aDayOf`).
 * Asked only once the open seasons are known, so the box is never stricter than the server, which asks
 * the same either way (`ResultsByTheLeagueApi.THE_DAY_IS_NOT_IN_THE_EVENTS_YEAR`).
 *
 * <p><b>And a name of several editions to one of them chosen</b>, where the day typed is in the year of
 * one of them (owner, 22.10.2026, answering the author's question before the code: „dugme ne pušta dok
 * godina nije izabrana sa spiska, rečenicom „Izaberi godinu sa spiska.” … godina bez izdanja i dalje pravi
 * nov događaj”). Such a name links none of them (`forms/exactName.ts`), so the save went out as a new
 * event, the server found the edition of that year at its address, and a race typed under it was made
 * again beside the one it already had.
 *
 * <p><b>And a name of ONE edition, linked by being typed exactly, is not held to that edition's year</b>
 * (owner, 23.10.2026, „Unos trke sa imenom događaja koji ima samo jedno izdanje, a dan trke je u drugoj
 * godini, pravi novo izdanje tog događaja, isto kao za ime sa više izdanja”): the day typed in another year
 * is not refused, and the block is then asked for what a new event is asked for, its town
 * ({@link aNewEditionOf}). A name of several editions with one chosen from the list keeps the refusal
 * above, as does the morning of 1 January, when the race goes on the event of the other year.
 */
export function whatIsWrongWithTheBlock(block: TheBlock, today: string, asked: TheBlockIsAsked): BlockWrong[] {
  const wrong: BlockWrong[] = []
  const asksTheDay = block.race === null
  const day = isoDate(block.date)
  const anEdition = aNewEditionOf(block, asked)

  if (block.eventName.trim() === '') {
    wrong.push({ box: 'eventName', key: REQUIRED_KEY })
  } else if (block.event === null && day !== '' && anEditionOfTheYearIsNotChosen(block, day, asked.offered)) {
    wrong.push({ box: 'eventName', key: 'leagueResults.chooseTheYear' })
  }

  if (asksTheDay && day === '') {
    wrong.push({ box: 'date', key: REQUIRED_KEY })
  } else if (asksTheDay && day > today) {
    wrong.push({ box: 'date', key: 'results.refused.theRaceHasNotBeenRun' })
  } else if (
    asksTheDay &&
    block.event !== null &&
    asked.open !== null &&
    !aDayOf(block.event.date, day, asked.open) &&
    !anEdition
  ) {
    wrong.push({ box: 'date', key: 'leagueResults.refused.theDayIsNotInTheEventsYear' })
  }

  if ((block.event === null || anEdition) && block.city.trim() === '') {
    wrong.push({ box: 'city', key: 'leagueResults.refused.theTownIsMissing' })
  } else if ((block.event === null || anEdition) && block.country === '') {
    wrong.push({ box: 'city', key: 'form.errors.countryMissing' })
  }

  if (block.raceName.trim() === '') {
    wrong.push({ box: 'raceName', key: REQUIRED_KEY })
  }

  if (block.race === null) {
    const limit = theLimitOf(block)

    for (const box of figuresOfANewRace(block.kind)) {
      const value = parseNumber(block[box])
      const bad =
        box === 'distanceKm'
          ? value === null || value <= 0
          : box === 'ascentM' || box === 'descentM'
            ? value === null || value < 0 || !Number.isInteger(value)
            : limit <= 0

      if (bad) {
        wrong.push({ box, key: REQUIRED_KEY })
      }
    }
  }

  return wrong
}

/**
 * WHERE THE SCREEN GOES ONCE THE SAVE IS WRITTEN: the page of the event it is on („posle čuvanja ekran
 * vodi na stranu događaja”, approved 19.10.2026), by the address the answer names where the save made
 * or moved the event, and by the chosen event's own where it went over the event page's route, which
 * names none.
 */
export function theEventPageAfter(block: TheBlock, answered: string | null, locale: string): string {
  return `/${locale}/kalendar/${answered ?? (block.event === null ? '' : block.event.slug)}`
}

/** The help a box of a definition carries, or nothing: the first `hintKey` of the fields given. */
export function hintOf(fields: readonly FieldDef[]): string | undefined {
  return fields.map((one) => one.hintKey).find((one) => one !== undefined)
}

/** The year of a day kept as `yyyy-MM-dd`. */
function yearOf(day: string): number {
  return Number(day.slice(0, 4))
}

/**
 * Whether a new race of this day may go on an event of that day: in its year, or, while two seasons are
 * open, in either of them. The server's own condition (`ResultsByTheLeagueApi`, „A NEW RACE GOES ON AN
 * EVENT OF ITS OWN YEAR”), asked of the seasons the server says are open rather than of a window worked
 * out here.
 */
function aDayOf(eventDay: string, day: string, open: readonly number[]): boolean {
  const theEvents = yearOf(eventDay)
  const theDays = yearOf(day)

  return theEvents === theDays || (open.includes(theEvents) && open.includes(theDays))
}

/**
 * THE ENTRY OF THE LIST THE CHOSEN EVENT IS, by its key: where its name is read from. The name is the
 * list's and not the box's, since a name typed exactly links in any case („gradska LIGA”) and the box keeps
 * what was typed. Nothing where no event is chosen, or where the list does not hold it.
 */
function theEntryOfTheEvent(block: TheBlock, offered: readonly Suggestion[]): Suggestion | undefined {
  return block.event === null ? undefined : offered.find((one) => one.id === String(block.event?.eventId))
}

/**
 * WHETHER THE CHOSEN EVENT IS THE ONLY EDITION OF ITS NAME among those offered: every entry the name names
 * exactly is counted (`forms/exactName.ts`), which is how the box itself tells one edition from several, so
 * a name that links by being typed is the name that counts as one here.
 */
export function theNameHasOneEdition(block: TheBlock, offered: readonly Suggestion[]): boolean {
  const entry = theEntryOfTheEvent(block, offered)

  return entry !== undefined && everyOneNamedExactly(offered, entry.value).length === 1
}

/**
 * A NEW EDITION OF THE EVENT CHOSEN: the name is of one edition, linked, and the day typed is not in that
 * edition's year (owner, 23.10.2026, „Unos trke sa imenom događaja koji ima samo jedno izdanje, a dan trke
 * je u drugoj godini, pravi novo izdanje tog događaja, isto kao za ime sa više izdanja”). The save is then
 * what it is for a name that links nothing: a new event of that name, in its own year, with a town typed.
 *
 * <p><b>Not on the morning of 1 January</b> (the exception of 22.10.2026, kept beside the rule the owner
 * has now relaxed for one edition): while both seasons are open the race goes on the event of the other
 * year, as it did, so a day that `aDayOf` takes is not a new edition. <b>And not before the open seasons are
 * known</b>, when nobody can say whether it is that morning: the box says nothing then and the server
 * decides, as it always has. <b>And not for a name of several editions</b>, where an edition is chosen on
 * purpose and a day outside its year is refused (`whatIsWrongWithTheBlock`).
 */
export function aNewEditionOf(block: TheBlock, asked: TheBlockIsAsked): boolean {
  const day = isoDate(block.date)

  return (
    block.event !== null &&
    block.race === null &&
    asked.open !== null &&
    day !== '' &&
    !aDayOf(block.event.date, day, asked.open) &&
    theNameHasOneEdition(block, asked.offered)
  )
}

/** Whether the name typed names several editions offered, one of them in the year of the day typed. */
function anEditionOfTheYearIsNotChosen(block: TheBlock, day: string, offered: readonly Suggestion[]): boolean {
  const editions = everyOneNamedExactly(offered, block.eventName.trim())

  return editions.length > 1 && editions.some((one) => yearOf(isoDate(one.fills.date ?? '')) === yearOf(day))
}

/**
 * THE YEARS THE DAY'S CALENDAR SHOWS, where the day is a new race's on an event of the calendar: that
 * event's year, and on the morning of 1 January both seasons then open, where the event is of one of them
 * (the rule of `aDayOf`). Nothing where the day is a new event's own or no day is asked. Before the
 * seasons are known, the event's year alone: the calendar refuses nothing, it only does not offer.
 *
 * <p><b>And nothing where the name has one edition</b> (owner, 23.10.2026, {@link aNewEditionOf}): its
 * other years are days of a new edition, so a calendar that stopped at the edition's year would offer no
 * way to one.
 */
export function yearsOfTheDay(
  block: TheBlock,
  open: readonly number[] | null,
  offered: readonly Suggestion[],
): Years | undefined {
  if (block.event === null || block.race !== null || theNameHasOneEdition(block, offered)) {
    return undefined
  }

  const theEvents = yearOf(block.event.date)
  const years = open !== null && open.includes(theEvents) ? [theEvents, ...open] : [theEvents]

  return { first: Math.min(...years), last: Math.max(...years) }
}

/** The limit of a race to a limit, out of its three boxes, read as every clock of the portal is. */
function theLimitOf(block: TheBlock): number {
  return fromBoxes({ hours: block.hours, minutes: block.minutes, seconds: block.seconds })
}

/**
 * What the save sends of the event and the race (`ResultsByTheLeagueApi.OnARaceOfAnEvent`), on the
 * road that makes something: a race of the calendar takes the rows over the event page's own route
 * (`EnterResults.tsx`), so the race here is always a new one.
 */
export type EventAndRaceSent = {
  event: { id: number } | { name: string; date: string; city: string; country: string }
  race: {
    name: string
    date?: string
    kind: RaceKind
    distanceKm: number | null
    ascentM: number | null
    descentM: number | null
    limitSeconds: number | null
  }
}

/**
 * THE EVENT AND THE RACE AS THE ROUTE READS THEM: by key where they are the calendar's, by everything
 * else where the save makes them. A new event's day is its own and its race carries none; a new race on
 * an event of the calendar carries its own. What a kind does not fix travels as nothing.
 *
 * <p>A new edition of an event of the calendar ({@link aNewEditionOf}) travels as the new event it is: by
 * the name the list gives the linked edition (never the case the box was typed in, so the two editions do
 * not differ by it) and the day, which is its own and its race's, and the town typed.
 */
export function eventAndRaceOf(block: TheBlock, asked: TheBlockIsAsked): EventAndRaceSent {
  const course = block.kind === 'length'
  const time = block.kind === 'time'
  const edition = aNewEditionOf(block, asked) ? theEntryOfTheEvent(block, asked.offered) : undefined
  /* The event of the calendar the race goes on, or none where the save makes the event. */
  const linked = block.event !== null && edition === undefined ? block.event : null
  const event =
    linked === null
      ? {
          name: edition?.value ?? block.eventName.trim(),
          date: isoDate(block.date),
          city: block.city.trim(),
          country: block.country,
        }
      : { id: linked.eventId }

  return {
    event,
    race: {
      name: block.raceName.trim(),
      ...(linked === null ? {} : { date: isoDate(block.date) }),
      kind: block.kind,
      distanceKm: course ? parseNumber(block.distanceKm) : null,
      ascentM: course ? parseNumber(block.ascentM) : null,
      descentM: course ? parseNumber(block.descentM) : null,
      limitSeconds: time ? theLimitOf(block) : null,
    },
  }
}
