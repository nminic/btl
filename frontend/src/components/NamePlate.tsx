import { Portrait } from './Portrait'
import type { Competitor } from '../data/types'
import type { ReactNode } from 'react'
import './NamePlate.css'

/**
 * A competitor as a face and whatever words the screen writes beside it, which is how the owner
 * asked for a name to be written on the tables (07.09.2026): „Imena i prezimena ne treba da budu
 * sva velikim slovima, nego kružni logo sa slikom ili inicijalima, i pored u dva reda Ime i
 * Prezime."
 *
 * **One component and six places**, because the same shape was about to be written six times: the
 * standing of a competition, the main standing, and three of the top boards. What the portal has
 * learnt about writing one rule at eight call sites is on `components/CompetitorName.tsx`, and
 * this is that lesson applied before the fact rather than after it.
 *
 * **The circles are its business and the words are not.** Each of the six screens already writes
 * the name the way that screen needs it: the boards cut the surname to an initial on a narrow
 * card and keep both halves in the markup (`TopBoards.tsx`), the standing of a competition breaks
 * it over two lines and the tables keep it on one („U ligi dva reda, u tabelama jedan", owner, the
 * same day). A component that decided that as well would be a second home for three answers that
 * already have one each.
 *
 * **A pair is two of them**, one circle above the other and the words beside them (owner, same
 * day), and each name over two lines, which is four lines in all („ime, prezime, ime, prezime u 4
 * reda ukupno", the same day). The board of best pairs draws them (`pages/TopBoards.tsx`); the
 * pairs it draws are mocked until the flow that makes one exists, which is written in PDL.
 *
 * **The circle says nothing out loud.** `Portrait` is `aria-hidden`, so a reader who cannot see it
 * hears the words and only the words; the initials in it are the same two letters the name begins
 * with, and hearing them twice is worse than not hearing them at all.
 */
export function NamePlate({
  competitors,
  children,
}: {
  /** One, or two where a pair is drawn. */
  competitors: Competitor[]
  /** The words beside the circles, written by the screen that knows how it writes a name. */
  children: ReactNode
}) {
  return (
    <span className={`plate${competitors.length > 1 ? ' plate--pair' : ''}`}>
      <span className="plate__faces">
        {competitors.map((one) => (
          <Portrait key={one.memberNumber} competitor={one} />
        ))}
      </span>

      <span className="plate__words">{children}</span>
    </span>
  )
}

/**
 * A name over two lines, which is what the standing of a competition wears and nothing else does.
 *
 * Two elements with a space between them rather than a line break the stylesheet could take away:
 * what a reader hears has to be „Ime Prezime" either way, and two elements parted by a space are
 * read as one name. Which of them goes on its own line is the sheet's business (`NamePlate.css`).
 */
export function OverTwoLines({ competitor }: { competitor: Competitor }) {
  return (
    <>
      <span className="plate__given">{competitor.firstName}</span>{' '}
      <span className="plate__family">{competitor.lastName}</span>
    </>
  )
}
