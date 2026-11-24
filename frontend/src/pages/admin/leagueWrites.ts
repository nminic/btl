/**
 * WHAT THE ADMINISTRATION SENDS WHEN IT WRITES A COMPETITION, AND WHAT EVERY REFUSAL OF IT
 * IS CALLED.
 *
 * <p><b>The administration is the one place a competition is written, since 21.11.2026</b>
 * (owner, PDL „Glava lista lige: na desktopu sve u jednom redu”): „male veze „Izmeni” kod
 * Propozicija i Nagrada nestaju”, and the pencil on the list of competitions leads to the form
 * here instead. Until that day the terms and the prizes were also changed in place on that list,
 * one box at a time, and this module built that body too (`upsertOf`, gone with it).
 *
 * <p>Its own module rather than a constant beside either screen, which is the arrangement
 * `pages/member/myAccount.ts` already has and the reason it gives: `react/only-export-components`
 * asks for it, and a test reading a component file to get at a table is a test that mounts
 * React to ask a question about a list.
 *
 * <p><b>A `.ts` and never a `.tsx`, and that is not a preference.</b>
 * `pages/league/componentWords.test.ts` sweeps every `.tsx` whose path names a competition
 * and holds every string in it against a snapshot. A table of dictionary keys is data
 * rather than words on a screen, and kept in a `.tsx` it would have had to be written down
 * twice.
 */

/**
 * WHAT `POST /api/leagues` AND `PUT /api/leagues/{id}` TAKE, which is
 * `LeagueWriteApi.Upsert` and nothing besides.
 *
 * <p><b>The whole record travels on every save, and that is the route's shape rather than
 * this file's choice.</b> `PUT /api/me` writes each column through a `coalesce` so a field
 * left out means „do not touch it" (ADL A54), and `pages/member/myAccount.ts` sends only
 * what changed because of it. `LeagueWriteApi.change` does the opposite: one `update` that
 * names all five columns, with `whatIsWrongWith` refusing a form that is missing any of the
 * three required ones. So a competition saved with only its name would have its address
 * blanked, and the route would refuse the request before it got that far.
 *
 * <p>Which is why the form sends all five every time, the terms and the prizes among
 * them, even when only one of them moved.
 */
export type Upsert = {
  name: string
  slug: string
  season: number
  rules: string
  prizes: string
  /**
   * The box „Istakni događaje" (V109, owner PDL 24.11.2026). Always sent, ticked or not, so the route never meets
   * the „not said" that `LeagueWriteApi.change` reads as „leave it as it stands".
   */
  highlightsEvents: boolean
}

/**
 * The five read off the FORM of a competition (`admin/AdminLeagues.tsx`).
 *
 * <p>Here rather than inside the screen, so the list of what the route takes is written
 * once, beside the shape of it.
 *
 * <p><b>`season` is a number on the wire and text in the form</b> - `forms/types.ts` holds
 * every value as a string or a flag - and `rules` and `prizes` are NOT NULL in the schema
 * and may be empty (V14), which is a competition announced before its propositions are
 * written. Missing values become the empty string rather than `undefined`, because
 * `LeagueWriteApi.whatIsWrongWith` answers `theFormIsNotComplete` to a blank name, address
 * or season, and that is a sentence rather than a field quietly dropped from the JSON.
 */
export function upsertFrom(values: Record<string, string | boolean>): Upsert {
  const text = (name: string): string => String(values[name] ?? '')

  return {
    name: text('name'),
    slug: text('slug'),
    season: Number(text('season')),
    rules: text('rules'),
    prizes: text('prizes'),
    /* A checkbox writes a flag (`forms/records.ts`), and only `true` is a tick. The form of a league always
       draws the box, opened with what `GET /api/leagues` answers, so a false here is a box left unticked. */
    highlightsEvents: values.highlightsEvents === true,
  }
}

/**
 * THE IDENTITY THE SERVER HANDED OUT, READ OFF THE ANSWER TO A 201.
 *
 * <p>`LeagueWriteApi.add` answers `{"id": …, "slug": …}`, and the id is the whole of what
 * the screen can then address the new competition by: `PUT`, `DELETE` and the panel that
 * puts races into it are all `/api/leagues/{id}`.
 *
 * <p><b>Read without an assertion (ADL A14)</b>, the same way `admin/leagueCounted.ts`
 * reads a served field and `pages/account/askTheServer.ts` reads a refusal: what comes off
 * the wire is `unknown` and is narrowed by looking at it, so an answer of some other shape
 * says „no identity here" rather than being claimed to hold one.
 *
 * <p><b>A whole number and never merely a number</b>, because `league.id` is a
 * `bigserial` and starts at one. `Number.isInteger` refuses a fraction and refuses `NaN`,
 * and nought or below is refused beside it: that is the range the session overlay used to
 * hand out (`admin/raceIds.ts` counts down from nought), so an answer carrying one of those
 * would be the very fault this read exists to end.
 */
export function identityIn(body: unknown): number | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }

  const id: unknown = Reflect.get(body, 'id')

  return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null
}

/**
 * THE SIX REFUSALS A COMPETITION BEING WRITTEN CAN MEET, each to a sentence in the
 * dictionary.
 *
 * <p>`LeagueWriteApi` names eleven, and they fall into two halves that no screen meets
 * both of: making, changing and deleting the record is this table, and putting races into
 * it or taking them out is the one below. `pages/account/refusals.test.ts` reads the Java
 * source and requires the union of the two to cover all eleven, so a twelfth arrives as a
 * red gate rather than as a code somebody cannot read.
 *
 * <p><b>`theSeasonIsFrozen` is in BOTH tables and under two different keys, which is the
 * point rather than a duplication.</b> The route answers one word; what it means to the
 * reader depends on what he pressed. On the panel of races it means „no more races go in,
 * and taking one out still works" (PDL P15c, owner: „Pod 2, mogu da je izbacim rucno"). On
 * this form it means „the record is settled, and deleting it still works" (PDL P15a point
 * 2 beside P15c point 1). One sentence covering both would be half wrong in each place.
 */
export const WHEN_WRITING_A_LEAGUE: Record<string, string> = {
  /* Nothing the route could act on arrived. Nearly unreachable from the form, which
     refuses an empty required field before it sends, and answered because the request can
     still lose a race against what the screen believes stands. */
  theFormIsNotComplete: 'admin.leagueSaveRefused.theFormIsNotComplete',
  /* THE ONE REFUSAL THE FORM CANNOT SPEAK FOR, AND IT IS MEASURED. `admin-liga.form.json`
     and `league_slug_shape` (V14, line 47) were two different expressions until
     25.09.2026: the form took `^[a-z0-9-]+$`, so `zimska-`, `-zimska`, `zimska--2027` and
     a bare `-` all passed it and met the route. The form now carries the schema's own
     expression, and this sentence stays all the same, because the form is the floor and
     the route decides - the same division PDL P15a point 1 settled for the season. */
  theAddressIsNotShaped: 'admin.leagueSaveRefused.theAddressIsNotShaped',
  theAddressIsTaken: 'admin.leagueSaveRefused.theAddressIsTaken',
  theSeasonIsNotThisOneOrTheNext: 'admin.leagueSaveRefused.theSeasonIsNotThisOneOrTheNext',
  theSeasonIsFrozen: 'admin.leagueSaveRefused.theSeasonIsFrozen',
  theSeasonCannotMoveWhileRacesCount:
    'admin.leagueSaveRefused.theSeasonCannotMoveWhileRacesCount',
}

/**
 * AND THE SIX A RACE ENTERING OR LEAVING ONE CAN MEET.
 *
 * <p>The sentences are the ones `admin/LeagueRaceModeration.tsx` has drawn since
 * 24.09.2026; what is new on 25.09.2026 is that they are a table rather than a probe of
 * the dictionary, so that `pages/account/refusals.test.ts` has something to hold them
 * against. The panel read `admin.leagueRefused.${reason}` and fell back on the key coming
 * back unchanged, which draws the right sentence and can never say that a seventh reason
 * has no words: a missing key and an unknown reason were one answer.
 */
export const WHEN_MODERATING_LEAGUE_RACES: Record<string, string> = {
  theRaceIsNotSaidOnce: 'admin.leagueRefused.theRaceIsNotSaidOnce',
  theRaceIsNotKnown: 'admin.leagueRefused.theRaceIsNotKnown',
  theEventIsNotKnown: 'admin.leagueRefused.theEventIsNotKnown',
  theEventHoldsNoRaces: 'admin.leagueRefused.theEventHoldsNoRaces',
  theRaceIsNotOfTheLeaguesSeason: 'admin.leagueRefused.theRaceIsNotOfTheLeaguesSeason',
  theSeasonIsFrozen: 'admin.leagueRefused.theSeasonIsFrozen',
  /* AN UNSCORED RACE COUNTS IN NO LEAGUE (PDL, 14.11.2026, „ekran administracije lige ne nudi nebodovane
     događaje i ima rečenicu za odbijanje `anUnscoredRaceIsNotInALeague`"). The panel does not offer one, so
     this is met only by a screen one step behind the calendar: an event made unscored after the panel read
     it. */
  anUnscoredRaceIsNotInALeague: 'admin.leagueRefused.anUnscoredRaceIsNotInALeague',
}
