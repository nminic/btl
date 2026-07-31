import { NavLink, useLocation } from 'react-router'
import './PartsNav.css'

export type Part = {
  /** Address of the part, without the query. */
  to: string
  /** Whether this is the one that answers the bare address of the record. */
  end?: boolean
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
  const { search } = useLocation()

  return (
    <nav className="parts" aria-label={label}>
      {parts.map((part) => (
        <NavLink
          key={part.to}
          end={part.end}
          to={{ pathname: part.to, search }}
          className="parts__item"
        >
          {part.label}
        </NavLink>
      ))}
    </nav>
  )
}
