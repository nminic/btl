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
  /* What the link is called out loud, where the words inside it are a picture and not a name
     (`home/TopTen.tsx`). Only on the link: an `aria-label` on a span replaces the words of
     something nobody can press, which is a name read out for a control that is not there. */
  label?: string
  children: ReactNode
}) {
  const to = useProfileLink()(competitor)

  if (to === undefined) {
    return (
      <span className={className} title={title}>
        {children}
      </span>
    )
  }

  return (
    <Link className={className} to={to} title={title} aria-label={label}>
      {children}
    </Link>
  )
}
