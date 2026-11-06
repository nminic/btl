import { Link } from 'react-router'
import type { FrozenOne } from './frozenPeople'

/** The name of a member of a frozen row, a link where `to` is one. */
export function FrozenName({ one, className }: { one: FrozenOne; className?: string }) {
  const name = `${one.competitor.firstName} ${one.competitor.lastName}`.trim()

  return one.to === undefined ? (
    <span className={className}>{name}</span>
  ) : (
    <Link className={className} to={one.to}>
      {name}
    </Link>
  )
}
