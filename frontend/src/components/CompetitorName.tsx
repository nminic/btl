import { useProfileLink } from '../pages/profile/useProfileLink'
import { Link } from 'react-router'
import type { Competitor } from '../data/types'

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
  const linkTo = useProfileLink()
  const name = `${competitor.firstName} ${competitor.lastName}`
  const to = linkTo(competitor)

  /* **Two reasons for one answer, and neither is asked here.** A member whose fee has run out has
     no profile to open (P11), and a member who has hidden theirs has none for a reader who is not
     signed in (P23, 06.09.2026). Which of the two it is belongs to `profile/visible.ts`; what
     belongs here is that the name stays either way. */
  if (to === undefined) {
    return <span className={className}>{name}</span>
  }

  return (
    <Link className={className} to={to}>
      {name}
    </Link>
  )
}
