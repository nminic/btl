import { profilePath } from '../pages/profileAddress'
import { Link } from 'react-router'
import type { Competitor } from '../data/types'
import { useI18n } from '../i18n/useI18n'

/**
 * A competitor's name, as a link to their profile while there is one to link to.
 *
 * PDL P11 says a member whose fee has run out is hidden as though they did not
 * exist, and in the same breath that their name stays in the tables of the
 * seasons they raced. So the name is never taken away and the link always is.
 * `CompetitorProfile` refuses to draw such a profile, which makes every link to
 * one a door onto a wall.
 *
 * Written once and used everywhere a name appears, because the rule was being
 * kept on two screens out of eight and there was nothing to say which. The seven
 * that were not keeping it did not look wrong: the data has one member this is
 * true of, and they are in none of those lists today.
 */
export function CompetitorName({
  competitor,
  className,
}: {
  competitor: Competitor
  className?: string
}) {
  const { locale } = useI18n()
  const name = `${competitor.firstName} ${competitor.lastName}`

  if (!competitor.active) {
    return <span className={className}>{name}</span>
  }

  return (
    <Link className={className} to={profilePath(competitor, locale)}>
      {name}
    </Link>
  )
}
