import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../components/Resource'
import { SeasonPicker } from '../components/SeasonPicker'
import { offeredSeason, useSeason } from '../components/season'
import { askTheServer, type Answer } from './account/askTheServer'
import { ServerSaid } from './account/ServerSaid'
import { WHEN_WRITING_A_LEAGUE, upsertOf, type LeagueWords } from './admin/leagueWrites'
import type { League } from '../data/types'
import {
  dataOr,
  failed,
  useCompetitors,
  useEvents,
  useLeagues,
  useRaces,
  useResults,
} from '../data/useResource'
import { useToday } from '../clock/useClock'
import { useI18n } from '../i18n/useI18n'
import { useMay } from './admin/rights'
import { EditableText } from './league/EditableText'
import { LeagueEvents } from './league/LeagueEvents'
import { leagueRaces, racesByEvent } from './league/leagueCounting'
import { leagueTable } from './league/leagueTable'
import './Leagues.css'

/**
 * HOW MANY DAYS COUNT TOWARDS A COMPETITION, and it is the same number the box below the card
 * lists, because it is the same call.
 *
 * `league.eventIds.length` is what stood here until 13.09.2026, and a review measured what that
 * costs the moment the folding box arrived beside it: the row said „Događaja: 11" and the box
 * listed ten. The eleventh is an event whose races have not been entered yet, and that is not a
 * quirk of the mock. The owner decided on 23.08.2026 that an event is written before its
 * distances are known, so production produces that difference by design, on every competition
 * that has one.
 *
 * Which of the two numbers is right was already answered, and not here: `V20__league_reads_races`
 * carries the league onto its RACES, and says in as many words that from then on a league's
 * events ARE the events of its races. An event with none of them counted scores nothing and
 * decides nothing. So the row follows the box rather than the other way round, and when the
 * portal stops reading `/mock` the server will already be answering the same way.
 *
 * It asks for the events and the races itself, like `Entrants` above and for the same reason: the
 * list must not wait on two files of nearly two megabytes to draw a name. Three states and not
 * two - empty while the answer is coming, because a nought where the file has not arrived is the
 * card telling a lie; the word when it will not come at all.
 *
 * **WHAT THIS COSTS, NAMED AS A DECISION RATHER THAN LEFT AS A CONSEQUENCE.** The number used to
 * come out of a file of 1,9 KB and appeared with the name of the competition; it now waits on the
 * races (553 KB) and the events (373 KB), so on a slow connection the row reads „Događaja:" with
 * nothing after it for as long as those take. That is the same bargain `Entrants` beside it
 * already makes, and the same three states, so the screen itself still draws immediately.
 *
 * **And the difference that was being paid for was real, which the switch of 21.09.2026 has now
 * settled rather than removed.** `LeagueApi` builds `eventIds` by aggregating over the races it
 * counts, so a server answer can never carry an event with no counted races; the generated file's
 * `brdska-2019` can, because its list was written by hand. Two readings followed, and the one taken
 * here was deliberate: the row could have kept reading `eventIds` and been right again on the day
 * `BASE` moved, OR it could read what the box reads and be right on both sides of that day. The
 * second was chosen because the first is right only while somebody remembers why, and a number that
 * disagrees with the list under it is the kind of thing a member notices and nobody can explain.
 * The cases in this file still run against the generated file, so the arrangement that made the two
 * readings differ is still measured.
 */
function CountedEvents({ league }: { league: League }) {
  const { t } = useI18n()
  const eventsState = useEvents()
  const racesState = useRaces()
  const ready = eventsState.status === 'ready' && racesState.status === 'ready'

  if (failed(eventsState, racesState)) {
    return <>{t('leagues.unknown')}</>
  }

  if (!ready) {
    return null
  }

  return (
    <>
      {racesByEvent(leagueRaces(league, dataOr(racesState, [])), dataOr(eventsState, [])).length}
    </>
  )
}

/**
 * How many people are placed in one competition.
 *
 * **Read for what it is worth and not waited for** (review, 07.09.2026). It is one number in one
 * line of facts, and working it out costs the three heaviest files on the portal: the results are
 * 1,4 MB, the races 553 KB, the events 373 KB, against 1,9 KB for the competitions themselves.
 * Waited for, the whole screen sat under a full-page loader until all four arrived, and a results
 * file that failed replaced the list with „Podaci se ne mogu učitati." — a screen with no name of
 * any competition on it, no season, and none of the terms or prizes the owner moved here on that
 * same day. Measured by a review, in both states.
 *
 * So the list draws itself out of the one small file, and this fills in behind it. The shape is
 * the one the page of a competition used for the same problem before this: three states and not
 * two. Empty while the answer is coming, because a nought where the file has not arrived is the
 * table telling a lie; the word when it will not come at all.
 *
 * `leagueTable` and not a count of its own, because the owner said what this number is by pointing
 * at the table („Koliko ih je u tabeli"), and two ways of counting one thing are two answers.
 */
function Entrants({ league }: { league: League }) {
  const { t } = useI18n()
  const eventsState = useEvents()
  const racesState = useRaces()
  const resultsState = useResults()
  const competitorsState = useCompetitors()
  const ready =
    eventsState.status === 'ready' &&
    racesState.status === 'ready' &&
    resultsState.status === 'ready' &&
    competitorsState.status === 'ready'

  if (failed(eventsState, racesState, resultsState, competitorsState)) {
    return <>{t('leagues.unknown')}</>
  }

  if (!ready) {
    return null
  }

  const standing = leagueTable(
    league,
    dataOr(eventsState, []),
    dataOr(racesState, []),
    dataOr(resultsState, []),
    dataOr(competitorsState, []),
  )

  return <>{standing.rows.length}</>
}

/**
 * Every competition that runs alongside the league, one under another.
 *
 * **A box across the whole page and not half of it** (owner, 07.09.2026): „Lige treba da imaju
 * boksove koji su širine cele strane, a ne polovine, tako da bi primera radi sada tri lige stale u
 * 3 reda." What each box carries is the season, how many events count towards it, how many people
 * are in it, and what the organiser has written: the terms and the prizes, which used to live one
 * screen further in and are read here now.
 *
 * **And, since 13.09.2026, which events and races it counts**, in a box of its own that folds
 * (`league/LeagueEvents.tsx`). The owner: „na pregledu svih liga ispisuje ono što i sad (naziv,
 * opšti detalji, PROPOZICIJE, NAGRADE, pa onda ide i sekcijica DOGAĐAJI / TRKE koja se može
 * ekspandovati tako da se vide sve označene." It was built for the page of a single competition
 * the day before, on his word of 12.09.2026, and he corrected himself the next morning; the page
 * of one competition is the standing and nothing else again.
 *
 * **The season is chosen beside the heading**, the same control the standing of the teams wears
 * and in the same place. The options are the seasons the competitions themselves are held in, so
 * when the first real ones arrive they will all be 2027 and that is what the control will open on.
 *
 * **Waiting only on the competitions themselves**, which is what the whole screen is drawn from.
 * The one number that needs more than that asks for it separately and says so (`Entrants`).
 */
export function Leagues() {
  const { locale, t } = useI18n()
  const today = useToday()
  const may = useMay()
  const running = today.slice(0, 4)
  const asked = useSeason(running)

  /**
   * WHAT A MODERATOR HAS WRITTEN HERE THIS VISIT, AND SINCE 25.09.2026 IT IS WHAT THE
   * SERVER ACCEPTED RATHER THAN WHAT THE SESSION REMEMBERED.
   *
   * **Why this moved in the same increment as the administration form, and not after
   * it.** The terms and the prizes of a competition are ONE fact with two places to
   * change it: this list, where they are read, and the form in the administration.
   * Moving only the form would have left the administration writing to `league` while
   * this screen wrote to an overlay nobody serves, so a moderator correcting the
   * propositions where he reads them would watch them appear and never leave the
   * browser. That is the „two homes of one fact" class, and it would have been created
   * by the very commit that fixed the other half.
   *
   * **Held here rather than re-read**, for the reason `data/client.ts` gives: a
   * resource is fetched once per visit and nothing clears it, so there is nothing to
   * re-read after a write. Only what the route accepted is put in.
   */
  const [written, setWritten] = useState<Record<number, Partial<Record<LeagueWords, string>>>>({})

  /** Which box was last answered and what was said about it, drawn where it was pressed. */
  const [answer, setAnswer] = useState<{
    id: number
    field: LeagueWords
    answer: Answer
  } | null>(null)

  /**
   * ONE BOX CHANGED, SENT AS THE WHOLE RECORD, WHICH IS WHAT THE ROUTE TAKES.
   *
   * `LeagueWriteApi.change` writes all five columns in one `update` and refuses a form
   * that is missing any of the three required ones, so the other four travel unchanged
   * beside the one that moved (`admin/leagueWrites.ts`, `upsertOf`). That is the
   * opposite of `PUT /api/me`, which coalesces, and the difference is the route's and
   * not this screen's to hold an opinion about.
   */
  async function save(league: League, field: LeagueWords, text: string): Promise<boolean> {
    /* Both boxes as they STAND and not as they were served, so a moderator who corrects
       the terms and then the prizes does not send the first correction back undone with
       the second. `standing` is the same read the boxes are drawn from, which is what
       keeps „what is on the screen" and „what is sent" one answer. */
    const sent = upsertOf(league, {
      rules: standing(league, 'rules'),
      prizes: standing(league, 'prizes'),
      [field]: text,
    })
    const said = await askTheServer(`/api/leagues/${league.id}`, sent, 'PUT')

    setAnswer({ id: league.id, field, answer: said })

    if (said.got !== 'done') {
      return false
    }

    setWritten((was) => ({ ...was, [league.id]: { ...was[league.id], [field]: text } }))

    return true
  }

  /** What the box holds now: what this visit wrote into it, or what was served. */
  function standing(league: League, field: LeagueWords): string {
    return written[league.id]?.[field] ?? league[field]
  }

  /** What was said about the last press on this very box, or nothing. */
  function saidAbout(league: League, field: LeagueWords) {
    if (answer === null || answer.id !== league.id || answer.field !== field) {
      return null
    }

    return answer.answer.got === 'done' ? (
      <p className="member__note" role="status">
        {t('admin.leagueTextSaved')}
      </p>
    ) : (
      <ServerSaid answer={answer.answer} refusals={WHEN_WRITING_A_LEAGUE} />
    )
  }

  return (
    <div className="rankings rankings--tooled">
      <h1>{t('leagues.title')}</h1>

      <Resource state={useLeagues()}>
        {(leagues) => {
          /* EVERY LEAGUE SERVED IS LISTED, AND NOTHING IS FILTERED OFF THIS SCREEN.
             Until 24.09.2026 a row at `btl-2027` was taken out here, on the reading that the
             portal's own league was a row of that table like any other and had to be hidden.
             The owner settled the shape on 22.09.2026 (PDL P15a): „Balkanska trkacka liga je
             globalno takmicenje ... Ne kreira se i ne moderira", and „BTL ne treba da se cuva
             na isti nacin kao ostale lige". So `league` is the table of the competitions that
             run ALONGSIDE, there is no such row, and a filter against one was a guard over an
             assumption that had been overturned - which is worse than useless, because the
             next reader takes it as evidence that the row exists. */
          /* The seasons competitions are actually held in, newest first, and the control opens on
             the newest of them. Not the seasons anybody has raced in: a competition written for
             next season has nobody in it yet and would be unreachable by the one control that
             leads to it. */
          const seasons = [...new Set(leagues.map((one) => one.season))].sort(
            (left, right) => right - left,
          )
          const season = offeredSeason(asked, seasons, String(seasons[0] ?? running))
          const shown = leagues.filter((one) => one.season === Number(season))

          return (
            <>
              <div className="rankings__head-tool">
                <SeasonPicker
                  seasons={seasons}
                  season={season}
                  fallback={String(seasons[0] ?? running)}
                />
              </div>

              {shown.length === 0 ? (
                <p className="profile__empty">{t('leagues.none')}</p>
              ) : (
                <ul className="leagues__list">
                  {shown.map((league) => (
                    <li key={league.id} className="leagues__item">
                      <h2>
                        <Link to={`/${locale}/liga/${league.slug}`}>{league.name}</Link>
                      </h2>
                      <p className="leagues__facts">
                        {t('leagues.season', { season: league.season })}
                        {' · '}
                        {t('leagues.events')}
                        {': '}
                        <CountedEvents league={league} />
                        {' · '}
                        {t('leagues.entrants')}
                        {': '}
                        <Entrants league={league} />
                      </p>

                      <EditableText
                        value={standing(league, 'rules')}
                        field="rules"
                        headingId={`league-rules-${league.id}`}
                        heading={t('leagues.rules')}
                        canEdit={may('entity:leagues')}
                        onSave={(text) => save(league, 'rules', text)}
                        said={saidAbout(league, 'rules')}
                      />

                      <EditableText
                        value={standing(league, 'prizes')}
                        field="prizes"
                        headingId={`league-prizes-${league.id}`}
                        heading={t('leagues.prizes')}
                        canEdit={may('entity:leagues')}
                        onSave={(text) => save(league, 'prizes', text)}
                        said={saidAbout(league, 'prizes')}
                      />

                      {/* And after the prizes, the events and races the competition counts, in a
                          box that folds (owner, 13.09.2026: „pa onda ide i sekcijica DOGAĐAJI /
                          TRKE koja se može ekspandovati tako da se vide sve označene").
                          Read-only: what a moderator changes here is the terms and the prizes,
                          and which events count is set in the administration. */}
                      <LeagueEvents league={league} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
