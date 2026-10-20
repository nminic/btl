import { raceKind } from '../../data/raceKind'
import type { BtlEvent, Race, RaceKind } from '../../data/types'
import { fromBoxes } from '../../forms/clock'
import { fieldDate, isoDate } from '../../forms/dateField'
import { theOneNamedExactly } from '../../forms/exactName'
import { parseNumber } from '../../forms/numberField'
import type { Suggestion } from '../../forms/types'
import { REQUIRED_KEY } from '../../forms/validate'
import { FIRST_SEASON } from '../../data/season'

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
 * THE BLOCK OPENED ON A RACE OF THE CALENDAR, from the event page's „Unesi rezultat”: both are known,
 * so both are linked from the start.
 */
export function onTheRace(event: BtlEvent, race: Race, said: { event: string; race: string }): TheBlock {
  return {
    ...emptyBlock(),
    eventName: said.event,
    event: { eventId: event.id, slug: event.slug, date: event.date },
    date: fieldDate(event.date),
    raceName: said.race,
    race: { raceId: race.id, kind: raceKind(race.kind) },
  }
}

/** THE EVENTS OFFERED: races, from the first season of the league to today, newest first. Before 2027
 *  nothing (PDL P9, owner, 19.10.2026: „NIŠTA! NE POSTOJI LIGA PRE 2027 GODINE”), and every year after
 *  it, since a result may be entered after a season froze (the coordinator's derivation, PDL
 *  „[IZVEDENO 19.10.2026, moje, PR za 7b]”, (2)). */
export function yearsOffered(today: string): number[] {
  const now = Number(today.slice(0, 4))

  return Array.from({ length: Math.max(0, now - FIRST_SEASON + 1) }, (_, at) => FIRST_SEASON + at)
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

/**
 * BOX BY BOX, IN THE ORDER THEY ARE DRAWN, what is wrong with the block: a name left empty, a day that
 * is not a day, before the league or still to come (in the words the route answers the same with), a
 * new event's town, and what the kind of a new race fixes.
 */
export function whatIsWrongWithTheBlock(block: TheBlock, today: string): BlockWrong[] {
  const wrong: BlockWrong[] = []
  const asksTheDay = block.race === null
  const day = isoDate(block.date)

  if (block.eventName.trim() === '') {
    wrong.push({ box: 'eventName', key: REQUIRED_KEY })
  }

  if (asksTheDay && day === '') {
    wrong.push({ box: 'date', key: REQUIRED_KEY })
  } else if (asksTheDay && Number(day.slice(0, 4)) < FIRST_SEASON) {
    wrong.push({ box: 'date', key: 'leagueResults.refused.theDayIsBeforeTheLeague' })
  } else if (asksTheDay && day > today) {
    wrong.push({ box: 'date', key: 'results.refused.theRaceHasNotBeenRun' })
  }

  if (block.event === null && block.city.trim() === '') {
    wrong.push({ box: 'city', key: 'leagueResults.refused.theTownIsMissing' })
  } else if (block.event === null && block.country === '') {
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

/** The limit of a race to a limit, out of its three boxes, read as every clock of the portal is. */
function theLimitOf(block: TheBlock): number {
  return fromBoxes({ hours: block.hours, minutes: block.minutes, seconds: block.seconds })
}

/** What the save sends of the event and the race (`ResultsByTheLeagueApi.OnARaceOfAnEvent`). */
export type EventAndRaceSent = {
  event: { id: number } | { name: string; date: string; city: string; country: string }
  race:
    | { id: number }
    | {
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
 */
export function eventAndRaceOf(block: TheBlock): EventAndRaceSent {
  const course = block.kind === 'length'
  const time = block.kind === 'time'
  const event =
    block.event === null
      ? { name: block.eventName.trim(), date: isoDate(block.date), city: block.city.trim(), country: block.country }
      : { id: block.event.eventId }

  if (block.race !== null) {
    return { event, race: { id: block.race.raceId } }
  }

  return {
    event,
    race: {
      name: block.raceName.trim(),
      ...(block.event === null ? {} : { date: isoDate(block.date) }),
      kind: block.kind,
      distanceKm: course ? parseNumber(block.distanceKm) : null,
      ascentM: course ? parseNumber(block.ascentM) : null,
      descentM: course ? parseNumber(block.descentM) : null,
      limitSeconds: time ? theLimitOf(block) : null,
    },
  }
}
