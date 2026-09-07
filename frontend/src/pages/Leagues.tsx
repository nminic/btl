import { Link } from 'react-router'
import { Resource } from '../components/Resource'
import { SeasonPicker } from '../components/SeasonPicker'
import { offeredSeason, useSeason } from '../components/season'
import { MAIN_LEAGUE_SLUG } from '../data/pricing'
import { fieldFor } from '../data/derive'
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
import { useSession } from '../session/useSession'
import { EditableText } from './league/EditableText'
import { leagueTable } from './league/leagueTable'
import './Leagues.css'

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
  const today = useToday()
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
    fieldFor(dataOr(competitorsState, []), league.season, today),
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
  const { edits, edit } = useSession()
  const running = today.slice(0, 4)
  const asked = useSeason(running)

  return (
    <div className="rankings rankings--tooled">
      <h1>{t('leagues.title')}</h1>

      <Resource state={useLeagues()}>
        {(all) => {
          /* The league itself is the portal; it needs no entry in a list of things that run
             alongside it. */
          const leagues = all.filter((one) => one.slug !== MAIN_LEAGUE_SLUG)
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
                        {league.eventIds.length}
                        {' · '}
                        {t('leagues.entrants')}
                        {': '}
                        <Entrants league={league} />
                      </p>

                      <EditableText
                        value={edits[league.id]?.rules ?? league.rules}
                        field="rules"
                        headingId={`league-rules-${league.id}`}
                        heading={t('leagues.rules')}
                        canEdit={may('entity:leagues')}
                        onSave={(text) => edit(league.id, 'rules', text)}
                      />

                      <EditableText
                        value={edits[league.id]?.prizes ?? league.prizes}
                        field="prizes"
                        headingId={`league-prizes-${league.id}`}
                        heading={t('leagues.prizes')}
                        canEdit={may('entity:leagues')}
                        onSave={(text) => edit(league.id, 'prizes', text)}
                      />
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
