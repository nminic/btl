import { Link } from 'react-router'
import { PartsNav } from '../../components/PartsNav'
import { categoryOfMember } from '../../data/derive'
import { SEASON } from '../../data/pricing'
import type { Competitor, Team } from '../../data/types'
import { Sentence } from '../../i18n/Sentence'
import { useI18n } from '../../i18n/useI18n'

/**
 * Who the person is, above everything else, and the same on every part of the
 * profile (PDL P11 puts it above the fold).
 *
 * The name stands alone in the heading. The club used to sit in brackets right
 * after it and now stands in the line below, as the continuation of how long
 * this person has been around: "U ligi od 2014. · U klubu Dunavski trkači od
 * 2018." (owner, 31.07.2026). Those are two different facts, and reading them
 * side by side is how anyone would say them out loud. It also gives the heading
 * back to the name, which is what a shared link is about.
 *
 * A club is never named without the year, and never the year without the club:
 * `teamSince` is null exactly when there is no club, so the two travel together.
 */
export function ProfileHead({
  competitor,
  team,
}: {
  competitor: Competitor
  team: Team | undefined
}) {
  const { locale, t } = useI18n()

  return (
    <header className="profile__head">
      <h1 className="profile__name">
        {competitor.firstName} {competitor.lastName}
      </h1>

      <p className="profile__meta">
        <span className="profile__number">{competitor.memberNumber}</span>
        {' · '}
        {categoryOfMember(competitor, SEASON)}
        {' · '}
        {competitor.city}
        {' · '}
        {t('profile.memberSince', { season: competitor.firstSeason })}
        {' · '}
        {team === undefined || competitor.teamSince === null ? (
          <span>{t('profile.noTeam')}</span>
        ) : (
          /* The club name is a link inside the sentence rather than beside it,
             so a screen reader hears where the link goes without an
             aria-label having to repeat what the sentence already says. */
          <span className="profile__club">
            <Sentence text={t('profile.inClub', { season: competitor.teamSince })} slot="team">
              <Link to={`/${locale}/tim/${team.slug}`}>{team.name}</Link>
            </Sentence>
          </span>
        )}
      </p>
    </header>
  )
}

/** What the season control needs, handed down from the part that owns it. */
export type SeasonChoice = {
  /** Seasons this person raced, newest first, plus any season the address named. */
  options: number[]
  /** The chosen one, or `sve` for the whole career. */
  value: string
  onChange: (value: string) => void
}

/**
 * The two parts of a profile, as addresses rather than as panels swapped in
 * place.
 *
 * Two, not four (the design decision of 30.07.2026). The four kinds of content
 * do not weigh the same: a biography is one paragraph and a view whose whole
 * content is one paragraph is a click charged for nothing, while the results are
 * both the longest thing here and the thing every visitor came for, so they are
 * the one part that must never be behind a click.
 *
 * Links and `aria-current`, never a tablist: a tablist promises panels that swap
 * without leaving the page and takes over the arrow keys. The address carries
 * the part, which is what PDL P12 already decided for the tables, so a part can
 * be linked, bookmarked and indexed.
 *
 * The season rides inside the overview control rather than on a rule of its own
 * below (owner, 31.07.2026). It governs the overview and nothing else, so it
 * belongs to the overview the way a setting belongs to the thing it sets, and a
 * whole row plus a sentence explaining what that row governed both disappear.
 * On the awards it is not drawn at all: the awards are every season a person
 * ever placed in, and a control that changes nothing on the screen it is
 * standing on is worse than no control.
 *
 * The query travels with the link, so choosing a season and then looking at the
 * trophies does not lose the season on the way back.
 */
export function ProfileParts({
  memberNumber,
  season,
}: {
  memberNumber: string
  season?: SeasonChoice
}) {
  const { locale, t } = useI18n()
  const base = `/${locale}/takmicar/${memberNumber}`

  return (
    <PartsNav
      label={t('profile.parts.label')}
      parts={[
        {
          to: base,
          end: true,
          label: t('profile.parts.overview'),
          extra:
            season === undefined ? undefined : (
              <label className="parts__season">
                <span className="visually-hidden">{t('rankings.season')}</span>
                <select
                  value={season.value}
                  onChange={(event) => season.onChange(event.target.value)}
                >
                  <option value="sve">{t('profile.allTime')}</option>
                  {season.options.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            ),
        },
        { to: `${base}/priznanja`, label: t('profile.parts.awards') },
      ]}
    />
  )
}
