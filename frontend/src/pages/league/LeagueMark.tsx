import type { League } from '../../data/types'
import { CutPicture } from '../../components/CutPicture'

/** What a mark is drawn from: the name, and the picture where the league has one. */
type Marked = Pick<League, 'name' | 'logo' | 'crop' | 'smallLogo'>

/**
 * THE SIGN OF A COMPETITION: ITS OWN MARK IN A CIRCLE, OR THE INITIALS OF ITS NAME UNTIL IT HAS ONE.
 *
 * Owner, 23.11.2026 (PDL, „Pravi logo lige”), chosen between offered outcomes: „gde se vidi: kartica lige
 * na strani „Lige”, glava lista izabrane lige i strana pojedinačne lige”, and „oblik: krug, seče se kao
 * znak tima (uz moju preporuku): čuva se original, prikazuje se u krugu; bez loga ostaje krug sa
 * inicijalima”. Those three places draw this and nothing else, so the mark and the initials cannot be
 * spelt two ways.
 *
 * **The shape is the team's** (`components/TeamMark.tsx`), copied with its guards: the small circle the
 * server already cut is drawn whole, and the original cut here by its three fractions only when there is
 * no small one or it would not load; the clipping is on the box and never on the picture, because a crop
 * is a magnification and would carry the rounded corners out of the circle with it.
 *
 * **Which letters** is my reasoning and not a decision: a name written as one word with capitals in it
 * („RunTrace”) gives its first two capitals; otherwise the first letter of each of the first two words
 * that are words of the name rather than the word for a league, a year or a joining word (so
 * „RunTrace liga 2027” is RT and „Trail liga Srbije” is TS). A name with one such word gives one letter.
 *
 * Hidden from a reader working by ear, picture and letters alike: the name it stands beside is said in
 * full, and a mark read out before it would be the same words twice.
 */
export function LeagueMark({ league }: { league: Marked }) {
  /* Asked of the type and not compared with null: a league is whatever the answer, the file or the
     overlay of the administration last said it was, and a record missing the key is a league with no
     mark rather than an image with no address. */
  if (typeof league.logo === 'string') {
    /* The small mark when there is one, the original cut here when not: `CutPicture`, the one way
       every circle on the portal is cut (components/CutPicture.tsx). */
    return (
      <CutPicture
        className="leagues__mark leagues__mark--logo"
        original={league.logo}
        crop={league.crop}
        small={typeof league.smallLogo === 'string' ? league.smallLogo : null}
        lazy={false}
      />
    )
  }

  return (
    <span className="leagues__mark" aria-hidden="true">
      {initialsOf(league.name)}
    </span>
  )
}

/** The words that name what a competition is rather than which one it is. */
const NOT_A_NAME = new Set(['liga', 'league', 'lige'])

export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => /^\p{L}/u.test(word))
  const capitals = (words[0] ?? '').match(/\p{Lu}/gu) ?? []

  if (capitals.length >= 2) {
    return capitals.slice(0, 2).join('')
  }

  return words
    .filter((word) => word.length > 2 && !NOT_A_NAME.has(word.toLocaleLowerCase('sr')))
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('sr'))
    .join('')
}
