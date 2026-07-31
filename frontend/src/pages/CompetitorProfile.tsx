import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { CategoryDonut } from '../components/CategoryDonut'
import { Resource } from '../components/Resource'
import { Counters } from './home/Counters'
import { CATEGORIES, resultsOf, seasonsWithResults, totalsOf } from '../data/derive'
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
 * The length filter, as one row of six rather than a list that has to be opened.
 *
 * Two clicks became one (owner, 31.07.2026), and the row takes the same height
 * the closed select took, so nothing below it moved. There are exactly six and
 * there will only ever be six, which is what makes this shape safe: a filter
 * with an open-ended set of values could not be laid out flat.
 *
 * Each one carries two names: the length as the rest of the portal says it, and
 * the short form that fits on a telephone, where six controls have to share
 * three hundred and sixty pixels. Both are always read out and only one is ever
 * on screen, which the stylesheet decides. Hiding the other one from the reading
 * as well would leave the control with no name at all on the width where it is
 * used most.
 */
function LengthFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useI18n()
  const options = [
    { key: ALL, full: t('profile.allLengths'), short: t('profile.lengthsShort.all') },
    ...CATEGORIES.map((one) => ({
      key: one,
      full: t(`category.${one}`),
      short: t(`profile.lengthsShort.${one}`),
    })),
  ]

  return (
    <div className="profile__lengths" role="group" aria-label={t('profile.length')}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={
            value === option.key ? 'profile__length profile__length--on' : 'profile__length'
          }
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
        >
          <span className="profile__length-full">{option.full}</span>{' '}
          <span className="profile__length-short">{option.short}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * The profile, as one page of two parts (the design decision of 30.07.2026).
 *
 * This is the first: who the person is, then one row of three answering how much
 * and of what kind and who they are, then the races.
 *
 * The season is chosen once and governs the whole of this part, and since
 * 31.07.2026 it is chosen inside the control that names the part rather than on a
 * rule of its own below it. That rule cost a whole band of the screen and a
 * sentence underneath explaining what it governed, which is a sentence no screen
 * should need: a setting that sits inside the thing it sets explains itself.
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
  const opensOn = seasons[0]
  const fallback = opensOn === undefined ? ALL : String(opensOn)

  /* A season named in the address is honoured even where this person has nothing
     in it, and the select is given that option so it is not drawn blank: a
     shared link has to show what it was sent to show, and an empty table under
     the right year says something true. Anything that is not a year at all falls
     back, and the comparison is on the string the option carries, so `02010` is
     not quietly taken for 2010.

     The length has no such treatment: an unknown length is nothing the row of
     six can show as chosen and nothing a table can narrow by, so it is
     ignored. */
  const asked = params.get('sezona')
  const season = asked === ALL || (asked !== null && /^\d{4}$/.test(asked)) ? asked : fallback
  const askedLength = params.get('duzina')
  const length =
    askedLength !== null && (CATEGORIES as string[]).includes(askedLength) ? askedLength : ALL

  /* Newest first, and never the memoised list itself: sorting that in place
     during a render is a mutation React forbids, and it is a no-op only because
     it is already in this order. */
  const options =
    season === ALL || seasons.some((year) => String(year) === season)
      ? seasons
      : [...seasons, Number(season)].sort((left, right) => right - left)

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

  return (
    <div className="profile profile--competitor">
      <ProfileHead competitor={competitor} team={team} />
      <ProfileParts
        memberNumber={competitor.memberNumber}
        season={{
          options,
          value: season,
          onChange: (value) => change('sezona', value, fallback),
        }}
      />

      <div className={competitor.bio === '' ? 'profile__row' : 'profile__row profile__row--bio'}>
        <Counters totals={totals} races={false} />

        <section className="profile__card profile__card--donut">
          <CategoryDonut counts={countsOf(inSeason)} caption={t('profile.byCategory')} />
        </section>

        {competitor.bio !== '' && <Biography text={competitor.bio} />}
      </div>

      <section className="profile__results" aria-labelledby="profile-results">
        <h2 className="profile__section" id="profile-results">
          {t('profile.results')} <span className="profile__count">{shown.length}</span>
        </h2>

        <LengthFilter value={length} onChange={(value) => change('duzina', value, ALL)} />

        {shown.length === 0 ? (
          <div className="profile__results-empty">
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
                    {/* The event, not just its name (owner, 31.07.2026). Somebody
                        reading a result wants the race it came out of, and until
                        now the only way there was to guess the date in the
                        calendar. */}
                    <td>
                      <Link to={`/${locale}/kalendar/${result.eventSlug}`}>{result.eventName}</Link>
                    </td>
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
