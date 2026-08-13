import type { Competitor } from '../data/types'
import { hueFor } from '../pages/competitorFace'
import './Portrait.css'

/**
 * A competitor's face, in a circle.
 *
 * There are no photographs in the portal yet: the member record carries no
 * picture and nothing uploads one, so what a circle holds today is a monogram on
 * a colour of that member's own. The shape is the point. The old portal put
 * round faces over its top ten and that is what made the board worth looking at,
 * and initials in the same circle hold the place without leaving a grey hole
 * where a face will go (owner, 31.07.2026).
 *
 * An empty circle, for the places a board has but the league has not filled yet,
 * so a widget of ten slots is the same height whether the league has thirty
 * members or three.
 */
export function Portrait({ competitor }: { competitor?: Competitor }) {
  if (competitor === undefined) {
    return <span className="portrait portrait--empty" aria-hidden="true" />
  }

  return (
    <span
      className="portrait"
      aria-hidden="true"
      style={{ '--face-hue': hueFor(competitor.memberNumber) }}
    >
      {competitor.firstName.slice(0, 1)}
      {competitor.lastName.slice(0, 1)}
    </span>
  )
}
