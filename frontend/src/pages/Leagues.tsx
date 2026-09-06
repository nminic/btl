import { Link } from 'react-router'
import { Resource } from '../components/Resource'
import { SeasonPicker } from '../components/SeasonPicker'
import { offeredSeason, useSeason } from '../components/season'
import { MAIN_LEAGUE_SLUG } from '../data/pricing'
import { fieldFor } from '../data/derive'
import {
  combinePair,
  combineResources,
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
 */
export function Leagues() {
  const { locale, t } = useI18n()
  const today = useToday()
  const may = useMay()
  const { edits, edit } = useSession()
  const running = today.slice(0, 4)
  const asked = useSeason(running)
  /* Four resources for one list, and that is the price of one number. „Učesnika" is how many
     people the standing of that competition has rows for (owner, 07.09.2026), so it is worked out
     by the very thing that draws those rows (`league/leagueTable.ts`). Counted any other way it
     would be a second answer to one question, and the list and the page behind it could disagree
     without either being wrong on its own terms. */
  const state = combinePair(
    combineResources(useLeagues(), useEvents(), useRaces()),
    combinePair(useResults(), useCompetitors()),
  )

  return (
    <div className="rankings rankings--tooled">
      <h1>{t('leagues.title')}</h1>

      <Resource state={state}>
        {([[all, events, races], [results, competitors]]) => {
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
                  {shown.map((league) => {
                    const standing = leagueTable(
                      league,
                      events,
                      races,
                      results,
                      fieldFor(competitors, league.season, today),
                    )

                    return (
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
                          {standing.rows.length}
                        </p>

                        <EditableText
                          value={edits[league.id]?.rules ?? league.rules}
                          headingId={`league-rules-${league.id}`}
                          heading={t('leagues.rules')}
                          canEdit={may('entity:leagues')}
                          onSave={(text) => edit(league.id, 'rules', text)}
                        />

                        <EditableText
                          value={edits[league.id]?.prizes ?? league.prizes}
                          headingId={`league-prizes-${league.id}`}
                          heading={t('leagues.prizes')}
                          canEdit={may('entity:leagues')}
                          onSave={(text) => edit(league.id, 'prizes', text)}
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
