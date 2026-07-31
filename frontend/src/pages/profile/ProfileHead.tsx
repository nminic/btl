import { Link, NavLink, useLocation } from 'react-router'
import { categoryOfMember } from '../../data/derive'
import { SEASON } from '../../data/pricing'
import type { Competitor, Team } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'

/**
 * Who the person is, above everything else, and the same on every part of the
 * profile (PDL P11 puts it above the fold).
 *
 * The team is in brackets after the name (owner, 30.07.2026), where it used to
 * be a line of its own under the member number. It is a fact about the person in
 * the same breath as their name, and it saved the header a whole line.
 *
 * Where there is no team the brackets do not appear: empty ones are a defect on
 * screen, and "(bez tima)" in a heading reads as one. The fact is not lost, it
 * moves into the line below beside the town, which is where belonging already
 * lives.
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
        {team !== undefined && (
          /* The bracket group is one inline block, so a long team name wraps as
             a unit and never leaves an opening bracket alone at the end of a
             line. The relationship is carried by words inside the link rather
             than by an aria-label: brackets say nothing to a screen reader, and
             a link read out of context in a list of links has to name itself. */
          <span className="profile__team">
            {' ('}
            <Link to={`/${locale}/tim/${team.slug}`}>
              <span className="visually-hidden">{t('profile.team')}: </span>
              {team.name}
            </Link>
            {')'}
          </span>
        )}
      </h1>

      <p className="profile__meta">
        <span className="profile__number">{competitor.memberNumber}</span>
        {' · '}
        {categoryOfMember(competitor, SEASON)}
        {' · '}
        {competitor.city}
        {team === undefined && (
          <>
            {' · '}
            <span>{t('profile.noTeam')}</span>
          </>
        )}
        {' · '}
        {t('profile.memberSince', { season: competitor.firstSeason })}
      </p>
    </header>
  )
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
 * The query travels with the link, or choosing a season and then looking at the
 * trophies would lose the season on the way back.
 */
export function ProfileParts({ memberNumber }: { memberNumber: string }) {
  const { locale, t } = useI18n()
  const { search } = useLocation()
  const base = `/${locale}/takmicar/${memberNumber}`

  return (
    <nav className="profile__parts" aria-label={t('profile.parts.label')}>
      <NavLink end to={{ pathname: base, search }} className="profile__part">
        {t('profile.parts.overview')}
      </NavLink>
      <NavLink to={{ pathname: `${base}/priznanja`, search }} className="profile__part">
        {t('profile.parts.awards')}
      </NavLink>
    </nav>
  )
}
