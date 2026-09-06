import { Link } from 'react-router'
import { useProfileLink } from './useProfileLink'
import type { Competitor } from '../../data/types'
import type { ReactNode } from 'react'

/**
 * Whatever a screen wants to draw for a competitor, as a way into their profile while there is
 * one, and as plain markup while there is not.
 *
 * **One component rather than the same three lines on eight screens.** A competitor's name, face
 * or row is drawn as a link in eight places, and the rule that says whether it may be is the same
 * one the profile page uses to decide whether to draw itself (`profile/visible.ts`). Written out
 * at each site, that rule is eight places to forget it, and it was forgotten at seven of them for
 * as long as it only meant „whose fee has run out" (`components/CompetitorName.tsx` says so in its
 * own words).
 *
 * **What it never does is take the person away.** No link means a `<span>` with the same children
 * and the same class, so the row keeps its name, its number and its place. The owner's rule,
 * 06.09.2026: „sva njegova pojavljivanja na portalu u tabelama i rang listama postaju tekst
 * umesto link za sve posetioce koji nisu ulogovani."
 *
 * **And the same words to a reader who cannot see it**, whichever of the two it draws (review,
 * 07.09.2026). Where the whole control is a picture, the words are in `label` and there is nothing
 * else: the picture itself is `aria-hidden`, and so is the number of the place beside it. Given
 * only to the link, that made the first face on a board of ten into a list item with nothing at
 * all in it for a screen reader, on exactly the member the hiding is about. So the span says the
 * words too, out of the way of the eye, which is the shape the board already used before this
 * component existed.
 */
export function ProfileLink({
  competitor,
  className,
  title,
  label,
  children,
}: {
  competitor: Competitor
  className?: string
  /* Where the whole control is a picture, the name lives in the title, and it has to survive the
     control becoming plain markup (`home/TopTen.tsx`). */
  title?: string
  /* What the drawn thing is called out loud, where the words inside it are a picture and not a
     name (`home/TopTen.tsx`). It reaches a reader two ways, because there is no one way that
     works for both halves: `aria-label` names a link, and on a `<span>` it would be a name read
     out for a control that is not there, so there the words are written into the markup and put
     out of the way of the eye instead. */
  label?: string
  children: ReactNode
}) {
  const to = useProfileLink()(competitor)

  if (to === undefined) {
    return (
      <span className={className} title={title}>
        {children}
        {label !== undefined && <span className="visually-hidden">{label}</span>}
      </span>
    )
  }

  return (
    <Link className={className} to={to} title={title} aria-label={label}>
      {children}
    </Link>
  )
}
