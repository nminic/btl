import { askTheServer, type Answer } from '../account/askTheServer'

/** Where both verbs of this resource live. Written once so the two cannot part. */
export const MY_CATEGORY = '/api/me/category'

/**
 * WHAT THE SERVER SAYS ABOUT THE CATEGORY I WILL RUN THE COMING SEASON IN.
 *
 * Five facts and not one, because three of them are answers this side cannot work
 * out for itself:
 *
 * - `open` depends on an HOUR. The choice shuts at 10:00 on 1 January of its season
 *   (`SeasonClock.categoryMayBeChosenFor`), and this portal's clock reads whole days
 *   with no notion of an hour or a zone (`data/season.ts`: „The portal reads whole
 *   days off one clock with no notion of a zone"). A screen guessing it is wrong for
 *   ten hours on the one morning of the year the answer changes - which is exactly
 *   what the draft box did, drawn under `inYearlyWindow`, a window that shuts at the
 *   end of 31 December.
 * - `firstSeasonAllowed` is „ko sme da bude u pocetnickoj kategoriji", and PDL P7
 *   (owner, 11.08.2026) says whose question it is: „proverava portal, ne clan".
 * - `category` is the wish AND that right, so it is the one field that says what a
 *   member whose wish was overtaken will actually run under.
 */
export type MyCategory = {
  /** The season being chosen for, which in October is not the one being run. */
  season: number
  /** What I have said I want, unchanged by anything the portal thinks of it. */
  firstSeason: boolean
  /** Whether the beginners' category is open to me at all. */
  firstSeasonAllowed: boolean
  /** The code I will actually run under: the wish and the right together. */
  category: string
  /** Whether I may still change it. */
  open: boolean
}

/**
 * Read straight off the route, or nothing at all.
 *
 * A plain `fetch` and no token, for the reason `session/theServer.ts` gives beside its
 * own read of `/api/me`: a read needs none, `ApiSecurity` protects what changes
 * something, and `askTheServer` would fetch a cookie this call does not want. Cookies
 * go with it because the address is our own, which is what `credentials: 'same-origin'`
 * means and why it is not written out.
 *
 * **Null covers every way this can fail and they are deliberately one outcome.** No
 * server, 401 for a visitor, 404 for an account that does not race, a body that is not
 * JSON, or a body missing a field: none of them is a category, and a screen that told
 * them apart would be offering the reader five sentences about one absent box. What it
 * draws instead is no box, which is also what a member past the deadline sees.
 *
 * **Every field is looked for rather than declared** (ADL A14, and `theServer.ts` does
 * the same with `role` and `account`). What comes off the wire is narrowed by looking at
 * it, so a route that stopped answering a field draws no box instead of a box built on
 * `undefined`.
 */
export async function whatCategoryTheServerSaysIChose(): Promise<MyCategory | null> {
  let answer: Response

  try {
    answer = await fetch(MY_CATEGORY)
  } catch {
    return null
  }

  if (!answer.ok) {
    return null
  }

  let body: unknown

  try {
    body = await answer.json()
  } catch {
    return null
  }

  return categoryIn(body)
}

/**
 * The five fields, narrowed by looking at them.
 *
 * Exported so its own case can hand it a body nobody would get past a real route: this
 * is the only place that decides what counts as an answer, and the ways an answer can be
 * wrong are more numerous than the ways a route can be.
 */
export function categoryIn(body: unknown): MyCategory | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const season: unknown = Reflect.get(body, 'season')
  const firstSeason: unknown = Reflect.get(body, 'firstSeason')
  const firstSeasonAllowed: unknown = Reflect.get(body, 'firstSeasonAllowed')
  const category: unknown = Reflect.get(body, 'category')
  const open: unknown = Reflect.get(body, 'open')

  if (
    typeof season !== 'number' ||
    typeof firstSeason !== 'boolean' ||
    typeof firstSeasonAllowed !== 'boolean' ||
    typeof category !== 'string' ||
    typeof open !== 'boolean'
  ) {
    return null
  }

  return { season, firstSeason, firstSeasonAllowed, category, open }
}

/**
 * Say which category I want.
 *
 * Through `askTheServer` and not through a `fetch` here, because this one CHANGES
 * something: it needs the token, and the four outcomes that function already names are
 * the four this screen has to draw. A 409 carrying `theChoiceIsShut` arrives as
 * `{ got: 'refused', reason }`, which is how the member is told his deadline has passed
 * rather than being shown a control that quietly did nothing.
 */
export async function tellTheServerMyCategory(firstSeason: boolean): Promise<Answer> {
  return askTheServer(MY_CATEGORY, { firstSeason }, 'PUT')
}
