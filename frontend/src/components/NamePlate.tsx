import { Link } from 'react-router'
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
 * standing of a competition, the main standing, and four of the top boards (most kilometres,
 * longest on the course, best single races, and best pairs). What the portal has
 * learnt about writing one rule at eight call sites is on `components/CompetitorName.tsx`, and
 * this is that lesson applied before the fact rather than after it.
 *
 * **The circles are its business and the words are not.** Each of the six screens already writes
 * the name the way that screen needs it: the standing of a competition and three of the boards
 * break it over two lines, and the main standing and the best single races keep it on one („U ligi
 * dva reda, u tabelama jedan", owner, the
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
 *
 * **A way in of its own, for the one screen whose link cannot hold the circle** (`faceTo`,
 * 02.10.2026, `PDL.md`, „Odluke iz ciscenja nalaza", stavka 114). The other screens that link a
 * name put the whole plate inside the link to the profile (`pages/league/LeagueResults.tsx`,
 * `pages/TopBoards.tsx`), so pressing the circle opens it. The main standing cannot: the member
 * number stands in `.plate__words` under the name and must stay out of every link
 * (`pages/publicScreens.test.tsx`, PR 412), so there the link is the name alone and the circle
 * would be dead to a finger and a mouse. Given an address, the circle becomes a second link to the
 * same place, **out of the tab order and out of the accessibility tree**: a keyboard and a screen
 * reader meet the name's link and only that one, and nobody is read a link whose words are a
 * picture. `tabIndex={-1}` is what makes `aria-hidden` allowed on a link at all.
 *
 * It is the screen that decides whether there is an address (`profile/useProfileLink.ts`), so a
 * profile nobody may reach has neither link and the circle is still drawn. For ONE competitor: a
 * pair has two profiles and no single address, which is why the board of pairs does not pass one.
 */
export function NamePlate({
  competitors,
  faceTo,
  children,
}: {
  /** One, or two where a pair is drawn. */
  competitors: Competitor[]
  /** Where pressing the circle leads, where it leads anywhere. For a plate of one only. */
  faceTo?: string
  /** The words beside the circles, written by the screen that knows how it writes a name. */
  children: ReactNode
}) {
  const faces = competitors.map((one) => <Portrait key={one.memberNumber} competitor={one} />)

  return (
    <span className={`plate${competitors.length > 1 ? ' plate--pair' : ''}`}>
      {faceTo === undefined ? (
        <span className="plate__faces">{faces}</span>
      ) : (
        <Link className="plate__faces" to={faceTo} tabIndex={-1} aria-hidden="true">
          {faces}
        </Link>
      )}

      <span className="plate__words">{children}</span>
    </span>
  )
}

/**
 * A name over two lines, worn by the standing of a competition, by „Najviše kilometara" and
 * „Najduže na stazi", and by each half of a pair on the board of best pairs. The main standing and
 * the best single races keep the name on one line and do not use this.
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
