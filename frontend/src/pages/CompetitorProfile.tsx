import { InviteToTeam } from './profile/InviteToTeam'
import { memberNumberIn, redirectTo } from './profileAddress'
import { useMemo } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { useToday } from '../clock/useClock'
import { CategoryDonut } from '../components/CategoryDonut'
import { Resource } from '../components/Resource'
import { MEMBERS, TEAMS, recordsOf } from './admin/entityForms'
import { useOverlay } from './admin/overlay'
import { useSession } from '../session/useSession'
import { profileFor } from './profile/visible'
import { useGrowing } from '../components/growing'
import { LoadMore } from '../components/LoadMore'
import { Counters } from './home/Counters'
import {
  CATEGORIES,
  countsByCategory,
  resultsOf,
  seasonsWithResults,
  totalsOf,
} from '../data/derive'
import type { Competitor, Gender, Result, Team } from '../data/types'
import { combineResources, useCompetitors, useResults, useTeams } from '../data/useResource'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { shortBio } from './profile/bio'
import { ProfileTop } from './profile/ProfileHead'
import { ALL_SEASONS, offeredSeason, seasonOptions, useSeason } from '../components/season'
import { useFilterParams } from '../app/useFilterParams'
import './Profile.css'

/** What the address says when no length is chosen. The same word the season
 *  uses, and a constant of its own: they are two filters that happen to spell
 *  their "everything" the same way, and one of them changing its mind must not
 *  silently change the other. */
const ALL_LENGTHS = 'sve'

/**
 * How many results arrive with the page, before the table starts growing.
 *
 * Fifty, because that is the number the owner named on 12.08.2026 asking why
 * this table did not grow: „Zbog čega na rezultatima takmičara ne ide učitavanje
 * na skroll kad/ako ih ima preko 50 na strani?“
 *
 * The foot is drawn under fifty as well, as it is on the ducats: it is then one
 * sentence saying that is all of them, and nothing is asked of the reader. Said
 * here because an earlier note claimed no control is drawn at all, which the
 * condition below has never done.
 */
const AT_FIRST = 50


/**
 * The biography as it is published, in paragraphs, with no links inside it: a
 * link in text somebody else wrote is an address that has to be policed.
 *
 * The card stands on every profile, empty or not (owner, 31.07.2026). Everybody
 * will have one, since it is written at the moment of joining, and a row of
 * three that is sometimes a row of two changes shape from person to person for
 * no reason the reader can see.
 */
function Biography({ text, gender }: { text: string; gender: Gender }) {
  const { t } = useI18n()

  return (
    <section className="profile__card profile__bio" aria-labelledby="profile-bio">
      <h2 className="profile__card-title" id="profile-bio">
        {t('profile.bio')}
      </h2>
      {/* Said of the person whose page it is, in the gender they are: a portal
          that calls every woman on it a takmičar is one written for half its
          members (owner, 11.08.2026). */}
      {text === '' ? (
        <p className="profile__bio-text profile__bio-text--none">
          {t(gender === 'F' ? 'profile.bioEmptyFemale' : 'profile.bioEmpty')}
        </p>
      ) : (
        shortBio(text)
          .split(/\n{2,}/)
          .map((paragraph) => (
            <p className="profile__bio-text" key={paragraph}>
              {paragraph}
            </p>
          ))
      )}
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
    { key: ALL_LENGTHS, full: t('profile.allLengths'), short: t('profile.lengthsShort.all') },
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
 * This is the first: who the person is, then one row of three answering who they
 * are and of what kind and how much, then the races.
 *
 * The season is chosen once, at the top of the page beside the name, because it
 * governs both parts and not one of them (owner, 31.07.2026).
 *
 * The order of the three is the biography, the ring, the figures, all of one
 * width. The words come first because they are the only part of the card that
 * had to be written by hand; the two that are worked out follow.
 */
function ProfileBody({
  competitor,
  competitors,
  results,
  team,
  teams,
}: {
  competitor: Competitor
  competitors: Competitor[]
  results: Result[]
  team: Team | undefined
  teams: Team[]
}) {
  const { locale, t } = useI18n()
  const [params, setParams] = useFilterParams()
  const today = useToday()
  const asked = useSeason()

  const mine = useMemo(
    () => resultsOf(results, competitor.memberNumber),
    [results, competitor.memberNumber],
  )
  const seasons = useMemo(() => seasonsWithResults(mine), [mine])
  const options = useMemo(
    () => seasonOptions(seasons, asked, today),
    [seasons, asked, today],
  )
  /* Held against the list before anything is read in it, so the control and the
     table below it cannot show two different years. */
  const season = offeredSeason(asked, options, undefined)

  /* The length has no such treatment as the season: an unknown length is nothing
     the row of six can show as chosen and nothing a table can narrow by, so it
     is ignored. */
  const askedLength = params.get('duzina')
  const length =
    askedLength !== null && CATEGORIES.some((one) => one === askedLength)
      ? askedLength
      : ALL_LENGTHS

  const inSeason = useMemo(
    () => mine.filter((result) => season === ALL_SEASONS || result.date.startsWith(season)),
    [mine, season],
  )
  const shown = useMemo(
    () => inSeason.filter((result) => length === ALL_LENGTHS || result.category === length),
    [inSeason, length],
  )

  /* The two widgets follow the season and nothing else. */
  const totals = useMemo(() => totalsOf(inSeason), [inSeason])

  /* A table that grows as it is read, the same mechanism the comments under an
     event and the ducats on a profile already use (components/growing.ts).
     Owner, 12.08.2026, asking why this one did not have it: „Zbog čega na
     rezultatima takmičara ne ide učitavanje na skroll kad/ako ih ima preko 50 na
     strani?"
   *
     Fifty at first, because that is the number he named. The heading above still
     counts the whole filtered set, not what is drawn: it answers „how many
     results does this competitor have", which is not the same question as „how
     far have I read". */
  /* Told what the list is of, and not only how long it is. Two length
     categories holding the same number of races are two lists, and a reader who
     has read one to the end has not asked anything about the other: without
     this, switching between them moves the focus to the foot of the table
     (components/growing.ts). Both filters go in, because both make a different
     list of the same results. */
  const {
    shown: grown,
    whole,
    asked: askedMore,
    more,
  } = useGrowing(shown.length, AT_FIRST, params.toString())

  function changeLength(value: string) {
    const merged = new URLSearchParams(params)

    if (value === ALL_LENGTHS) {
      merged.delete('duzina')
    } else {
      merged.set('duzina', value)
    }

    setParams(merged)
  }

  return (
    <div className="profile profile--competitor">
      <ProfileTop competitor={competitor} team={team} seasons={options} season={season} />

      {/* Under the head and above everything the profile is about, because it is
          an act aimed at the person rather than a fact about them. It draws
          nothing at all unless the reader is in a team and this member is not
          (profile/InviteToTeam.tsx). */}
      <InviteToTeam competitor={competitor} competitors={competitors} teams={teams} />

      <div className="profile__row profile__row--bio">
        <Biography text={competitor.bio} gender={competitor.gender} />

        <section className="profile__card profile__card--donut">
          <CategoryDonut counts={countsByCategory(inSeason)} caption={t('profile.byCategory')} />
        </section>

        <Counters totals={totals} races={false} />
      </div>

      <section className="profile__results" aria-labelledby="profile-results">
        <h2 className="profile__section" id="profile-results">
          {t('profile.results')} <span className="profile__count">{shown.length}</span>
        </h2>

        <LengthFilter value={length} onChange={changeLength} />

        {shown.length === 0 ? (
          <div className="profile__results-empty">
            <p>{emptyText(t, mine.length, season, length)}</p>
            {(season !== ALL_SEASONS || length !== ALL_LENGTHS) && (
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
                  {/* „Trka" and not „Događaj": what stands in this column is the name of
                      the race (owner, 23.08.2026), and a heading that says otherwise
                      is read out with every cell under it. */}
                  <th scope="col">{t('profile.columns.race')}</th>
                  {/* The length has no column of its own any more (owner,
                      31.07.2026). It is the colour of the dot beside the
                      distance, and the distance already says which length it is:
                      21,10 is a half marathon whatever colour it wears. */}
                  <th scope="col">{t('profile.columns.distance')}</th>
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
                {shown.slice(0, grown).map((result) => (
                  <tr key={result.id}>
                    <td>{formatShortDate(result.date, locale)}</td>
                    {/* The event, not just its name (owner, 31.07.2026). Somebody
                        reading a result wants the race it came out of, and until
                        now the only way there was to guess the date in the
                        calendar. */}
                    <td>
                      {/* The name of the race, and the link still to the event it was run at:
                          the race has no page of its own and the event does
                          (owner, 23.08.2026). */}
                      <Link to={`/${locale}/kalendar/${result.eventSlug}`}>{result.raceName}</Link>
                    </td>
                    <td className="table__points">
                      {/* The dot carries the length, and its name goes with it,
                          because a colour on its own says nothing to anyone who
                          cannot tell two of them apart. */}
                      <span
                        className={`profile__dot profile__dot--${result.category}`}
                        aria-hidden="true"
                      />
                      <span className="visually-hidden">
                        {t(`category.${result.category}`)}
                        {': '}
                      </span>
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

        {/* Under the table and outside the box that scrolls sideways: the
            control belongs to the list, not to the width of it, and a reader
            who has pushed the table left must not have to push it back to find
            the button. */}
        {shown.length > 0 && (
          <LoadMore
            whole={whole}
            asked={askedMore}
            onMore={more}
            words={{
              more: t('profile.moreResults'),
              showing: t('profile.showingResults', { shown: grown, total: shown.length }),
              whole: t('profile.allResults', { count: shown.length }),
            }}
            endShown={false}
          />
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
    /* Written without a gender, unlike the biography above it. The portal has
       exactly one member who has never raced, so one of the two forms of this
       sentence would be a form nothing could ever show, and a sentence nobody
       can see is a sentence nobody can check. */
    return t('profile.noResults')
  }

  if (season !== ALL_SEASONS && length !== ALL_LENGTHS) {
    return t('profile.noneInFilter')
  }

  return season === ALL_SEASONS
    ? t('profile.noneInLength')
    : t('profile.noneInSeason', { season })
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
  const { locale, t } = useI18n()
  const params = useParams()
  const { search } = useLocation()
  const memberNumber = given ?? memberNumberIn(params.memberNumber)
  const { memberNumber: reader } = useSession()
  const overlay = useOverlay()
  const state = combineResources(useCompetitors(), useResults(), useTeams())

  return (
    <Resource state={state}>
      {([everybody, results, allTeams]) => {
        /* Through the overlay, so a choice made in Podešavanja this visit is answered by this
           screen at once rather than only after the data is loaded again.

           And the clubs the same way, since 06.09.2026: a club founded during this visit lives
           in the overlay and nowhere else, so read off the file this page told the member who
           had just joined it that they were in no club at all (review, same day). */
        const competitors = recordsOf(MEMBERS, everybody, overlay)
        const teams = recordsOf(TEAMS, allTeams, overlay)
        const readable = profileFor(competitors, memberNumber, reader)

        if (readable.kind === 'none') {
          /* **The home page, and the same for a profile that does not exist.** The owner's rule,
             06.09.2026: „javni posetilac se preusmerava na naslovnu stranu portala." Written as
             one answer for both, because a „nije pronađen" for one and a redirect for the other
             would let a visitor read off the difference which numbers belong to members who are
             hiding, which is the thing being hidden. */
          return <Navigate to={`/${locale}`} replace />
        }

        const { competitor } = readable
        const name = `${competitor.firstName} ${competitor.lastName}`

        /* One address and no alias (PDL P11): a reader who arrived by the
           number alone, or by a bookmark made before the name was in the
           address, is moved to the one this profile lives at rather than being
           left on a second one. In place, so the way back is not doubled.
         *
           Not inside „moj profil", where the address belongs to the member area
           and names no competitor at all. */
        const elsewhere =
          given === undefined ? redirectTo(competitor, params.memberNumber, locale) : null

        if (elsewhere !== null) {
          return <Navigate to={`${elsewhere}${search}`} replace />
        }

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
                  city: competitor.city,
                })}
                description={t('seo.competitor.recordDescription', { name })}
              />
            )}

            <ProfileBody
              competitor={competitor}
              competitors={competitors}
              results={results}
              team={teams.find((one) => one.id === competitor.teamId)}
              teams={teams}
            />
          </>
        )
      }}
    </Resource>
  )
}
