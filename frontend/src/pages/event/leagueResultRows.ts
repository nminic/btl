import type { RaceKind, Runner } from '../../data/types'
import { fromBoxes, inBoxes } from '../../forms/clock'
import { parseNumber } from '../../forms/numberField'
import type { Suggestion } from '../../forms/types'

/**
 * THE ROWS A MODERATOR WHO CHECKS RESULTS FILLS IN ON THE EVENT PAGE, ONE MEMBER EACH.
 *
 * <p>PDL P9, „Unos rezultata sa strane događaja, za moderatora i administratora (18.10.2026)", the
 * owner: „Želim dropdown za odabir takmičara, a nakon toga polja zavisno od vrste trke (ako je
 * dužinska sati minuti sekunde, ako je vremenska kilometraža, uspon, spust, ako je slobodna svih 6
 * parametara. I na kraju dugme za dodaj novog, (+) ili mogu da obrišem i taj red (x)”.
 *
 * <p>Everything a row holds is TEXT, as the boxes hold it, and is read into numbers only on the way
 * out ({@link bodyOf}). The server is the one that decides whether a run is whole
 * (`ResultsByTheLeagueApi`, `WhatARaceCarries.figuresOf`); what is checked here is only that every
 * box the kind asks for has a number in it, so the press is not spent on a row with an empty box.
 */
export type LeagueRow = {
  /** The member chosen from the list, or empty while what is in the box is only typed. */
  memberNumber: string
  /** What stands in the box of the list, which is the chosen member's name or what was typed. */
  typed: string
  distanceKm: string
  ascentM: string
  descentM: string
  hours: string
  minutes: string
  seconds: string
}

/** The six boxes a row may draw, in the order the owner names them. */
export const FIGURES = ['distanceKm', 'ascentM', 'descentM', 'hours', 'minutes', 'seconds'] as const

export type Figure = (typeof FIGURES)[number]

const THE_CLOCK: readonly Figure[] = ['hours', 'minutes', 'seconds']

const THE_COURSE: readonly Figure[] = ['distanceKm', 'ascentM', 'descentM']

/**
 * WHICH BOXES A RACE OF EACH KIND ASKS FOR, and they are the owner's sentence word for word: a race
 * of a length answers for its course, so the time is entered; a race to a limit answers for its time,
 * so the course is entered; a free race answers for neither, so all six are.
 */
export function figuresAskedOn(kind: RaceKind): readonly Figure[] {
  if (kind === 'length') {
    return THE_CLOCK
  }

  return kind === 'time' ? THE_COURSE : FIGURES
}

export function newLeagueRow(): LeagueRow {
  return {
    memberNumber: '',
    typed: '',
    distanceKm: '',
    ascentM: '',
    descentM: '',
    hours: '',
    minutes: '',
    seconds: '',
  }
}

/** How a member reads in the list and in the box once chosen: the two names and the number. */
export function runnerLabel(runner: Runner): string {
  return `${runner.firstName} ${runner.lastName} (${runner.memberNumber})`
}

/**
 * THE LIST, EVERYBODY THE SERVER ANSWERED, searched by first name, last name and number („sa
 * pretragom po imenu, prezimenu i broju"): all three stand in what is searched, which is the label.
 */
export function runnersToOffer(runners: Runner[]): Suggestion[] {
  return runners.map((runner) => ({
    id: runner.memberNumber,
    value: runnerLabel(runner),
    said: runnerLabel(runner),
    fills: {},
  }))
}

/** One box read as a number, or nothing where it holds none. */
function numberIn(box: string): number | null {
  return box.trim() === '' ? null : parseNumber(box)
}

/**
 * WHAT IS WRONG WITH A ROW BEFORE IT IS SENT, or nothing: the member, then the boxes.
 *
 * <p>The three boxes of the course are each a figure of their own and each is asked for. The three
 * boxes of the clock are ONE figure: an empty one is nought, as on the member's own form
 * (`forms/clock.ts`, `fromBoxes`), and what is asked is that something was typed and that the whole is
 * more than nought (a run in no time is not a run, owner, 31.08.2026).
 */
export function whatIsWrongWith(row: LeagueRow, kind: RaceKind): 'chooseMember' | 'figuresMissing' | undefined {
  if (row.memberNumber === '') {
    return 'chooseMember'
  }

  const asked = figuresAskedOn(kind)
  const course = THE_COURSE.filter((figure) => asked.includes(figure))
  const clock = THE_CLOCK.filter((figure) => asked.includes(figure))
  const aCourse = course.every((figure) => numberIn(row[figure]) !== null)
  const aClock =
    clock.length === 0 ||
    (clock.every((figure) => row[figure].trim() === '' || numberIn(row[figure]) !== null) &&
      fromBoxes({ hours: row.hours, minutes: row.minutes, seconds: row.seconds }) > 0)

  return aCourse && aClock ? undefined : 'figuresMissing'
}

/** The four figures the server takes, and only the ones this kind asks for; the rest go as nothing. */
export type FiguresSent = {
  distanceKm: number | null
  ascentM: number | null
  descentM: number | null
  seconds: number | null
}

export function figuresOf(row: LeagueRow, kind: RaceKind): FiguresSent {
  const asked = figuresAskedOn(kind)
  const course = asked.includes('distanceKm')
  const clock = asked.includes('hours')

  return {
    distanceKm: course ? numberIn(row.distanceKm) : null,
    ascentM: course ? numberIn(row.ascentM) : null,
    descentM: course ? numberIn(row.descentM) : null,
    /* The clock is read by the one function that reads three boxes as seconds (`forms/clock.ts`),
       so this screen and the member's own form cannot part on what 1 h 2 min 3 s is. */
    seconds: clock ? fromBoxes({ hours: row.hours, minutes: row.minutes, seconds: row.seconds }) : null,
  }
}

/** One row as `POST /api/races/{id}/results` takes it. */
export function bodyOf(row: LeagueRow, kind: RaceKind): FiguresSent & { memberNumber: string } {
  return { memberNumber: row.memberNumber, ...figuresOf(row, kind) }
}

/**
 * THE ONE ROW THE PENCIL OPENS WITH, which is the first and only row of its screen. Asked of the list
 * rather than of an index the type cannot vouch for: an empty list, which the pencil's screen never
 * draws, answers with an empty row, and the server refuses that as a run that is not whole.
 */
export function theOnlyRow(rows: LeagueRow[]): LeagueRow {
  return rows[0] ?? newLeagueRow()
}

/** A counted result put back into the boxes, for the pencil: the clock in its three parts. */
export function rowOf(
  result: { distanceKm: number; ascentM: number; descentM: number; seconds: number },
  memberNumber: string,
  typed: string,
): LeagueRow {
  return {
    memberNumber,
    typed,
    distanceKm: String(result.distanceKm),
    ascentM: String(result.ascentM),
    descentM: String(result.descentM),
    ...inBoxes(result.seconds),
  }
}
