import type { Team } from '../data/types'
import { hueFor } from '../pages/competitorFace'
import './TeamMark.css'

/**
 * A team's logo, in a circle, or its initials until it has one.
 *
 * Owner, 12.08.2026: a logo is added at team level and drawn in the table of
 * teams before the name, in a circle.
 *
 * The same shape as a competitor's face (components/Portrait.tsx) and for the
 * same reason: a circle that is sometimes there and sometimes a grey hole makes
 * a table change height row by row, so the place is always held. What holds it
 * until a team uploads anything is the team's own initials on a colour of its
 * own, taken from the same recipe faces use, so one team wears one colour
 * wherever the portal draws it.
 *
 * Hidden from a screen reader, all of it. The name of the team stands beside it
 * as a link and is the thing to read; a logo read out as „Dunavski trkači" in
 * front of a link reading „Dunavski trkači" is the same words twice, and read
 * out as a file name it is worse than nothing. A picture that adds nothing to
 * the sentence beside it is decoration, and decoration is `aria-hidden`.
 */
export function TeamMark({ team }: { team: Team }) {
  if (team.logo !== null) {
    return (
      <img
        className="face-circle team-mark team-mark--logo"
        src={team.logo}
        alt=""
        aria-hidden="true"
        width={64}
        height={64}
        /* Loaded when it comes near, not with the page: a table of teams may be
           long and each of these is a request nobody asked for yet. */
        loading="lazy"
        /* Never squeezed into an oval by a narrow cell: what makes it a mark is
           that it is round and the same size on every row. */
        decoding="async"
      />
    )
  }

  return (
    <span className="face-circle team-mark" aria-hidden="true" style={{ '--face-hue': hueFor(team.id) }}>
      {initialsOf(team.name)}
    </span>
  )
}

/**
 * Up to two letters a team is known by, taken from its own name.
 *
 * The first letter of each of the first two words, which gives „DT" for
 * „Dunavski trkači" and „NT" for „Niški trkači". A one word name gives one
 * letter rather than the first two of it: „Ni" reads as a syllable of something
 * and „N" reads as a mark, and this is a mark.
 */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toLocaleUpperCase('sr-Latn'))
    .join('')
}
