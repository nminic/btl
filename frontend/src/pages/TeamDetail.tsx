import { Link, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { CategoryDonut } from '../components/CategoryDonut'
import { Resource } from '../components/Resource'
import { SeasonPicker } from '../components/SeasonPicker'
import { useSeason } from '../components/season'
import { useToday } from '../clock/useClock'
import { Counters } from './home/Counters'
import {
  categoryOfMember,
  countsByCategory,
  rankMembers,
  seasonOf,
  seasonsWithResults,
  totalsOf,
} from '../data/derive'
import { SEASON } from '../data/pricing'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Profile.css'
import { CompetitorName } from '../components/CompetitorName'

/* A team is the only entity besides a competitor that carries a standing, so
 * its page is built the same way. Three of one width across the top (owner,
 * 31.07.2026): what the team says about itself, the races, the figures. Under
 * them the people who made those figures, ordered by what each contributed.
 *
 * The season is chosen once, beside the name, and it is the running one by
 * default with no "all of them" on offer: a team is a thing of one season, its
 * members change from year to year, and a standing summed over every season
 * would be a list of who has been around longest. */

/** Gold on the podium, as in every other table. */
const PODIUM = 3

export function TeamDetail() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const today = useToday()
  const running = today.slice(0, 4)
  const season = useSeason(running)
  const state = combineResources(useTeams(), useCompetitors(), useResults())

  return (
    <Resource state={state}>
      {([teams, competitors, results]) => {
        const team = teams.find((one) => one.slug === slug)

        if (team === undefined) {
          return <h1>{t('teams.notFound')}</h1>
        }

        const members = competitors.filter((one) => one.teamId === team.id)
        const numbers = new Set(members.map((one) => one.memberNumber))
        const inSeason = results.filter((one) => seasonOf(one) === Number(season))
        const mine = inSeason.filter((one) => numbers.has(one.memberNumber))
        const totals = totalsOf(mine)
        /* The seasons this team has anything in, plus the running one, which is
           the default and a control cannot open on an option it does not have. */
        const seasons = [
          ...new Set([Number(running), ...seasonsWithResults(results.filter(
            (one) => numbers.has(one.memberNumber),
          ))]),
        ].sort((left, right) => right - left)
        /* Places, not row numbers, and the whole ladder rather than points
           alone: two members level on points used to be given 1 and 2 by the
           order they happened to be in, while the list of teams beside this one
           already shared the place (PDL P12). */
        const rows = rankMembers(members, mine)

        return (
          <>
            <PageMeta
              title={t('seo.team.recordTitle', { name: team.name, city: team.city })}
              description={t('seo.team.recordDescription', { name: team.name })}
            />

            <div className="profile">
              <header className="profile__head">
                <p className="profile__meta">
                  <Link to={`/${locale}/timovi`}>{t('teams.backToTeams')}</Link>
                </p>
                <div className="profile__title">
                  <h1 className="profile__name">{team.name}</h1>
                  <SeasonPicker seasons={seasons} fallback={running} />
                </div>
                <p className="profile__meta">
                  {team.city}
                  {' · '}
                  {t('units.memberCount', { count: members.length })}
                </p>
              </header>

              {/* Three of one width, and the words first, because they are the
                  only part of the row somebody had to write by hand. */}
              <div className="profile__row profile__row--bio">
                <section className="profile__card profile__bio" aria-labelledby="team-about">
                  <h2 className="profile__card-title" id="team-about">
                    {t('teams.about')}
                  </h2>
                  {team.bio === '' ? (
                    <p className="profile__bio-text profile__bio-text--none">
                      {t('teams.aboutEmpty')}
                    </p>
                  ) : (
                    team.bio.split(/\n{2,}/).map((paragraph) => (
                      <p className="profile__bio-text" key={paragraph}>
                        {paragraph}
                      </p>
                    ))
                  )}
                </section>

                <section className="profile__card profile__card--donut">
                  <CategoryDonut counts={countsByCategory(mine)} caption={t('profile.byCategory')} />
                </section>

                <Counters totals={totals} races={false} />
              </div>

              <h2 className="profile__section">{t('teams.members')}</h2>

              {rows.length === 0 ? (
                <p className="profile__empty">{t('teams.noMembers')}</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    {/* Named, because the ring above it draws a table of its own
                        for anyone who cannot see the drawing, and two tables on
                        one screen have to be told apart. */}
                    <caption className="visually-hidden">{t('teams.members')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('rankings.columns.position')}</th>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        <th scope="col">{t('competitors.columns.category')}</th>
                        <th scope="col" className="table__hide-phone">
                          {t('competitors.columns.races')}
                        </th>
                        <th scope="col">{t('competitors.columns.points')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.competitor.memberNumber}
                          className={row.position <= PODIUM ? 'podium' : undefined}
                        >
                          <td className="table__position">{row.position}</td>
                          <td>
                            <CompetitorName competitor={row.competitor} />{' '}
                            <span className="table__member-number">
                              {row.competitor.memberNumber}
                            </span>
                          </td>
                          <td>{categoryOfMember(row.competitor, SEASON)}</td>
                          <td className="table__hide-phone">{formatNumber(row.races, locale)}</td>
                          <td className="table__points">{formatPoints(row.points, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      }}
    </Resource>
  )
}
