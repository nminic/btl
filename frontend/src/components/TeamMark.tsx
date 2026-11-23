import type { Team } from '../data/types'
import { CutPicture } from './CutPicture'
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
 * until a team uploads anything is the team's own initials, on the one colour
 * every circle of the portal wears (`.face-circle`, `components/Portrait.css`).
 * **A team has no colour of its own** (owner, 21.10.2026, PDL: „Inicijali tima
 * postaju jednobojni, kao kartice članova"): the colour derived from a member number
 * was abolished on 31.07.2026 (PDL P28), and the one derived from a team's id went
 * the same way. Nothing here sets `--face-hue`, and nothing on the competitors or
 * teams screens does (`pages/publicScreens.test.tsx`).
 *
 * Cut where the team cut it (owner, 12.08.2026), which is the one thing this
 * has to get right that a plain `object-fit: cover` does not: a logo with a
 * name written under it is a logo, and centred by the browser it becomes half
 * a logo over half a word. `fittedTo` in components/crop.ts is what turns the
 * three numbers into the two properties that do it, and it needs to know
 * nothing about how large the circle is.
 *
 * Hidden from a screen reader, all of it. The name of the team stands beside it
 * as a link and is the thing to read; a logo read out as „Dunavski trkači" in
 * front of a link reading „Dunavski trkači" is the same words twice, and read
 * out as a file name it is worse than nothing. A picture that adds nothing to
 * the sentence beside it is decoration, and decoration is `aria-hidden`.
 */
export function TeamMark({ team }: { team: Team }) {
  if (team.logo !== null) {
    /* The small mark, already cut on the server, or the original cut here: `CutPicture` decides
       which and cuts it, the one way every circle on the portal is cut (components/CutPicture.tsx). */
    return (
      <CutPicture
        className="face-circle team-mark team-mark--logo"
        original={team.logo}
        crop={team.crop}
        small={team.smallLogo}
        lazy
      />
    )
  }

  return (
    <span className="face-circle team-mark" aria-hidden="true">
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
