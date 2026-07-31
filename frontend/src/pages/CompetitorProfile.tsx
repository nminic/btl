import { useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { CategoryDonut } from '../components/CategoryDonut'
import { Resource } from '../components/Resource'
import { Counters } from './home/Counters'
import {
  CATEGORIES,
  defaultSeason,
  resultsOf,
  seasonsWithResults,
  totalsOf,
} from '../data/derive'
import { useToday } from '../clock/useClock'
import type { Competitor, RaceCategory, Result, Team } from '../data/types'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { shortBio } from './profile/bio'
import { ProfileHead, ProfileParts } from './profile/ProfileHead'
import './Profile.css'

const ALL = 'sve'

function countsOf(results: Result[]): Map<RaceCategory, number> {
  const counts = new Map<RaceCategory, number>()

  for (const result of results) {
    counts.set(result.category, (counts.get(result.category) ?? 0) + 1)
  }

  return counts
}

/** The biography as it is published, in paragraphs, with no links inside it: a
 *  link in text somebody else wrote is an address that has to be policed. */
function Biography({ text }: { text: string }) {
  const { t } = useI18n()

  return (
    <section className="profile__card profile__bio" aria-labelledby="profile-bio">
      <h2 className="profile__card-title" id="profile-bio">
        {t('profile.bio')}
      </h2>
      {shortBio(text)
        .split(/\n{2,}/)
        .map((paragraph) => (
          <p className="profile__bio-text" key={paragraph}>
            {paragraph}
          </p>
        ))}
    </section>
  )
}

/**
 * The profile, as one page of two parts (the design decision of 30.07.2026).
 *
 * This is the first: who the person is, then one season control, then the three
 * cards that answer how much and of what kind and who they are, then the races.
 *
 * One season, chosen once, above everything it governs. It used to be one of two
 * filters standing side by side over the widgets, with the second narrowing them
 * by race length as well: a donut narrowed to marathons is a chart with one
 * segment, and a scoreboard quietly showing marathon kilometres beside a season
 * label is a number meaning whatever the reader guesses. Length now narrows the
 * table and nothing else, and it lives beside the table.
 */
function ProfileBody({
  competitor,
  results,
  team,
}: {
  competitor: Competitor
  results: Result[]
  team: Team | undefined
}) {
  const { locale, t } = useI18n()
  const [params, setParams] = useSearchParams()
  const today = useToday()

  const mine = useMemo(
    () => resultsOf(results, competitor.memberNumber),
    [results, competitor.memberNumber],
  )
  const seasons = useMemo(() => seasonsWithResults(mine), [mine])

  /* The newest season this person has anything in, rather than all of them
     (owner's spec, 30.07.2026). Somebody with two hundred and seventy-seven
     results opened on all two hundred and seventy-seven, which is twenty-three
     screens on a telephone, and the counters above them were career totals under
     a heading that says the season. All seasons is one choice away. */
  const fallback = useMemo(() => defaultSeason(mine, today), [mine, today])
  const season = params.get('sezona') ?? (seasons.length === 0 ? ALL : String(fallback))
  const length = params.get('duzina') ?? ALL

  const inSeason = useMemo(
    () => mine.filter((result) => season === ALL || result.date.startsWith(season)),
    [mine, season],
  )
  const shown = useMemo(
    () => inSeason.filter((result) => length === ALL || result.category === length),
    [inSeason, length],
  )

  /* The two widgets follow the season and nothing else. */
  const totals = useMemo(() => totalsOf(inSeason), [inSeason])

  /* Written into the address unless it is the default, so an address stays as
     short as it can be. The season's default is not "all of them" any more, so
     choosing all of them has to be said out loud: deleting the parameter would
     have put the reader straight back on the newest season, and there would have
     been no way to ask for the career at all. */
  function change(key: string, value: string, fallbackValue: string) {
    const merged = new URLSearchParams(params)

    if (value === fallbackValue) {
      merged.delete(key)
    } else {
      merged.set(key, value)
    }

    setParams(merged)
  }

  /* An address may name a season this person has nothing in. The select is built
     from the seasons they raced, so the chosen one would match no option and the
     control would draw itself empty. */
  const options = seasons.includes(Number(season)) || season === ALL ? seasons : [...seasons, Number(season)]

  return (
    <div className="profile">
      <ProfileHead competitor={competitor} team={team} />
      <ProfileParts memberNumber={competitor.memberNumber} />

      {/* Full width and ruled off, so it reads as a control over the page rather
          than as one belonging to the card nearest it. That is the whole
          difficulty of one filter governing two widgets and a table. */}
      <div className="profile__controls" id="sezona" tabIndex={-1}>
        <label className="rankings__field">
          <span>{t('rankings.season')}</span>
          <select value={season} onChange={(event) => change('sezona', event.target.value, String(fallback))}>
            <option value={ALL}>{t('profile.allTime')}</option>
            {options
              .sort((left, right) => right - left)
              .map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
          </select>
        </label>
        <p className="profile__scope">{t('profile.seasonScope')}</p>
      </div>

      <div className={competitor.bio === '' ? 'profile__row' : 'profile__row profile__row--bio'}>
        <Counters totals={totals} title={t('profile.stats')} />

        <section className="profile__card profile__card--donut" aria-labelledby="profile-donut">
          <h2 className="profile__card-title" id="profile-donut">
            {t('profile.byCategory')}
          </h2>
          <CategoryDonut counts={countsOf(inSeason)} caption={t('profile.byCategory')} />
        </section>

        {competitor.bio !== '' && <Biography text={competitor.bio} />}
      </div>

      <section className="profile__results" aria-labelledby="profile-results">
        <h2 className="profile__section" id="profile-results">
          {t('profile.results')} <span className="profile__count">{shown.length}</span>
        </h2>

        <div className="profile__list-controls">
          <label className="rankings__field">
            <span>{t('profile.length')}</span>
            <select value={length} onChange={(event) => change('duzina', event.target.value, ALL)}>
              <option value={ALL}>{t('profile.allLengths')}</option>
              {CATEGORIES.map((one) => (
                <option key={one} value={one}>
                  {t(`category.${one}`)}
                </option>
              ))}
            </select>
          </label>

          {/* Only where a season is actually chosen, which is the only state in
              which a short table needs explaining. */}
          {season !== ALL && (
            <p className="profile__scope">{t('profile.inSeason', { season })}</p>
          )}
        </div>

        {shown.length === 0 ? (
          <div className="profile__empty">
            <p>{emptyText(t, mine.length, season, length)}</p>
            {(season !== ALL || length !== ALL) && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setParams(new URLSearchParams())}
              >
                {t('profile.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">{t('profile.results')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('profile.columns.date')}</th>
                  <th scope="col">{t('profile.columns.event')}</th>
                  {/* The length of the race, which is what this column has always
                      held. It was headed "Kat.", the same word the header two
                      lines above uses for the age band (PDL P7). */}
                  <th scope="col">{t('profile.columns.length')}</th>
                  <th scope="col" className="table__hide-phone">
                    {t('profile.columns.distance')}
                  </th>
                  <th scope="col" className="table__hide-phone">
                    {t('rankings.columns.ascent')}
                  </th>
                  <th scope="col" className="table__hide-phone">
                    {t('rankings.columns.descent')}
                  </th>
                  <th scope="col" className="table__hide-phone">
                    {t('profile.columns.time')}
                  </th>
                  <th scope="col">{t('profile.columns.points')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((result) => (
                  <tr key={result.id}>
                    <td>{formatShortDate(result.date, locale)}</td>
                    <td>{result.eventName}</td>
                    <td>{t(`category.${result.category}`)}</td>
                    <td className="table__hide-phone">
                      {formatNumber(result.distanceKm, locale, 2)}
                    </td>
                    <td className="table__hide-phone">{formatNumber(result.ascentM, locale)}</td>
                    <td className="table__hide-phone">{formatNumber(result.descentM, locale)}</td>
                    <td className="table__hide-phone">{formatDuration(result.seconds)}</td>
                    <td className="table__points">{formatPoints(result.points, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/** Which of the four sentences an empty table gets. Never raced at all is a
 *  different fact from raced but not this season, and a reader who is told the
 *  wrong one goes looking for a fault. */
function emptyText(
  t: (key: string, params?: Record<string, string | number>) => string,
  raced: number,
  season: string,
  length: string,
): string {
  if (raced === 0) {
    return t('profile.noResults')
  }

  if (season !== ALL && length !== ALL) {
    return t('profile.noneInFilter')
  }

  return season === ALL ? t('profile.noneInLength') : t('profile.noneInSeason', { season })
}

/**
 * One competitor, found by number.
 *
 * A member who is not active has no visible profile at all (PDL P11: "Nigde na
 * portalu nema vidljiv profil", "softverski je sakriven kao da ne postoji").
 * Nothing here read that flag, so the profile of somebody who had left was
 * public, which is the sort of thing that is nobody's fault and everybody's
 * problem. It is the same answer as a number nobody has.
 */
export function CompetitorProfile({ memberNumber: given }: { memberNumber?: string } = {}) {
  const { t } = useI18n()
  const params = useParams()
  const memberNumber = given ?? params.memberNumber
  const state = combineResources(useCompetitors(), useResults(), useTeams())

  return (
    <Resource state={state}>
      {([competitors, results, teams]) => {
        const competitor = competitors.find(
          (one) => one.memberNumber === memberNumber && one.active,
        )

        if (competitor === undefined) {
          return <h1>{t('profile.notFound')}</h1>
        }

        const name = `${competitor.firstName} ${competitor.lastName}`

        return (
          <>
            {/* The profile is the most shared page on the portal, so the tab, the
                search result and the shared link carry the person rather than
                the words "profil takmičara". Profiles are indexed unless the
                member says otherwise (PDL P29); the date of birth is not part of
                any of this, because it is never shown (PDL P23).

                Not when the profile is the one inside "moj profil": there the
                address belongs to the member area, and its own name fits the tab
                better than the member's own name does. */}
            {given === undefined && (
              <PageMeta
                title={t('seo.competitor.recordTitle', {
                  name,
                  number: competitor.memberNumber,
                })}
                description={t('seo.competitor.recordDescription', { name })}
              />
            )}

            <ProfileBody
              competitor={competitor}
              results={results}
              team={teams.find((one) => one.id === competitor.teamId)}
            />
          </>
        )
      }}
    </Resource>
  )
}
