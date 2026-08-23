import { NavLink, useLocation } from 'react-router'
import './PartsNav.css'

export type Part = {
  /** Address of the part, without the query. */
  to: string
  /** Whether this is the one that answers the bare address of the record. */
  end?: boolean
  /**
   * A second address this part also answers, where the same screen is reached by
   * two of them.
   *
   * A member's own profile is drawn at `/moj-profil` by the very component that
   * draws everybody else's, and the nav is built from the record's own address, so
   * `NavLink` compared two addresses that never match and **no part was marked at
   * all**: the reader saw a row of parts with nothing current on it, while the same
   * screen entered from the list of competitors marks „Pregled" (owner,
   * 23.08.2026).
   */
  also?: string
  label: string
}

/**
 * The parts of one record, as addresses rather than as panels swapped in place.
 *
 * Links and `aria-current`, never a tablist: a tablist promises panels that swap
 * without leaving the page and takes over the arrow keys. The address carries
 * the part, so a part can be linked, bookmarked and indexed, which is what PDL
 * P12 already decided for the tables.
 *
 * The query travels with every link, or choosing a season and then looking at
 * the trophies would lose the season on the way back.
 *
 * Shared, and named for what it is rather than for the first screen that had
 * one. It was `profile__part` until the competition wanted the same control, and
 * a class named after one screen worn by two is how a stylesheet starts lying
 * (ADL A7).
 */
export function PartsNav({ parts, label }: { parts: Part[]; label: string }) {
  const { search, pathname } = useLocation()

  return (
    <nav className="parts" aria-label={label}>
      {parts.map((part) => (
        <NavLink
          key={part.to}
          end={part.end}
          /* Pointed at the address the reader is **at** when that is the second one
             this part answers to. Two things follow from it, and both are the reason
             it is done this way rather than by marking the link by hand: `NavLink`
             then matches on its own, so „which part is open" keeps **one** home, and
             the link of the open part leads where the reader already is, which is
             what a current tab should do.

             Marking it by hand does not work, and that is measured rather than
             assumed: `NavLink` writes `aria-current` itself, after whatever it is
             handed, so an attribute passed in is overwritten by its `undefined` and
             no part is marked at all. */
          to={{ pathname: part.also === pathname ? part.also : part.to, search }}
          className="parts__item"
        >
          {part.label}
        </NavLink>
      ))}
    </nav>
  )
}
