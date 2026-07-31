import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import './PartsNav.css'

export type Part = {
  /** Address of the part, without the query. */
  to: string
  /** Whether this is the one that answers the bare address of the record. */
  end?: boolean
  label: string
  /**
   * A control that belongs to this part and to no other, drawn joined to it.
   *
   * The profile puts the season here: a setting that sits inside the thing it
   * sets explains itself, where the same setting on a rule of its own needed a
   * sentence underneath saying what it governed.
   */
  extra?: ReactNode
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
      {parts.map((part) => {
        const link = (
          <NavLink
            key={part.to}
            end={part.end}
            to={{ pathname: part.to, search }}
            className="parts__item"
          >
            {part.label}
          </NavLink>
        )

        return part.extra === undefined ? (
          link
        ) : (
          <span className="parts__group" key={part.to}>
            {link}
            {part.extra}
          </span>
        )
      })}
    </nav>
  )
}
