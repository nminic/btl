import type { Competitor } from '../data/types'
import { CutPicture } from './CutPicture'
import './Portrait.css'

/**
 * A competitor's face, in a circle: the approved photograph where there is one, and a
 * monogram on the one blue every such circle has where there is not.
 *
 * **There is no colour of a member's own, and that was decided on 31.07.2026** (PDL P28, „Sve
 * kartice takmičara su identične": „Boja izvedena iz članskog broja se ukida: lepo izgleda, ali
 * ništa ne znači"). This drew one all the same until 21.10.2026, a hue computed off the member
 * number and set on the circle, and it is gone (PENDING 29205). The blue is the sheet's own
 * (`Portrait.css`, `.face-circle`), and nothing is set on a member's circle to move it from
 * there: `components/portrait.test.tsx` holds that, and `components/oneFace.test.ts` holds that
 * this module does not reach the one that computes a hue.
 *
 * Owner, 26.09.2026 (PDL P28f): „po odobravanju slike ona tog trenutka pocinje da se vidi
 * na svim avatar mestima (u rang listama, profilnoj sekciji, gornjem desnom zaglavlju
 * ulogovanog korisnika itd.)", and with it „Mozda ovo nisu jedina mesta, ja sam nabrojao
 * ono sto sam znao. Proveri dobro gde sve treba da zavrsi."
 *
 * **This is the one home of that circle, and that is what makes the sentence above
 * deliverable.** A photograph taught to one component arrives on every screen at once;
 * taught to five it arrives on the three somebody remembered. `components/oneFace.test.ts`
 * holds it, and holds it against the import graph rather than against a list, because the
 * two screens that had their own circle until this branch were invisible to a sweep for
 * the class name: they wore `card__face` and `account__monogram`.
 *
 * **What used to stand here was the opposite and it was overturned on 26.09.2026:** „There
 * are no photographs in the portal yet: the member record carries no picture and nothing
 * uploads one." Both halves are false. `MePhotoApi` has taken a picture since PR 381,
 * `VerificationWriteApi` approves it, and `/api/competitors` has answered `photo` and
 * `crop` since PR 382. The sentence is kept here in its own words only because a sentence
 * claiming an overturned decision is an instruction to the next reader to put it back.
 *
 * **The shape is still the point, and the monogram is still what holds the place.** The old
 * portal put round faces over its top ten and that is what made the board worth looking at,
 * and initials in the same circle hold the place without leaving a grey hole where a face
 * will go (owner, 31.07.2026). Most members have sent nothing, so the monogram is not a
 * placeholder waiting to be deleted: it is the other half of this component, for good.
 *
 * **Null is TWO facts wearing one shape, deliberately** (`data/types.ts`, `photo`): a member
 * who has no portrait, and a member who hides his profile read by somebody who may not read it.
 * PDL requires „Oba slucaja dobijaju isti ishod", so this draws a monogram for both and
 * cannot tell them apart - which is the requirement and not a shortcoming. Nothing here
 * composes an address out of a member number: the whole path arrives on the record, and the
 * digest IS the permission (`PhotoApi` asks nobody who they are).
 *
 * **Decoration in both of its forms, so a name is read once.** Owner, 07.09.2026 (PDL): „Na
 * tabli od deset, sve u krugu nosi `aria-hidden` (i slika i broj mesta), jer to ime izgovara
 * sama veza" - a decision that names the picture a year before there was one. The name
 * stands beside the circle as a link or as text on every screen that draws this, so
 * alternative text of its own would be a third telling of the same name. The same rule and
 * the same reasoning as a team's mark (components/TeamMark.tsx).
 *
 * An empty circle, for the places a board has but the league has not filled yet, so a
 * widget of ten slots is the same height whether the league has thirty members or three.
 */
export function Portrait({ competitor, whole = false }: { competitor?: Competitor; whole?: boolean }) {
  if (competitor === undefined) {
    return <span className="face-circle portrait portrait--empty" aria-hidden="true" />
  }

  if (competitor.photo !== null) {
    /* THE SMALL PICTURE, ALREADY CUT, FOR EVERY CIRCLE BUT THE PROFILE'S, which asks for the
       original (`whole`). Which of the two is drawn, and how the original is cut, is
       `CutPicture`'s, and only `CutPicture`'s: until 23.11.2026 this drew both itself and the
       profile's circle cut a different part of the picture from every other circle. */
    return (
      <CutPicture
        className="face-circle portrait"
        original={competitor.photo}
        crop={competitor.crop}
        small={whole ? null : competitor.smallPhoto}
        lazy
      />
    )
  }

  return (
    <span className="face-circle portrait" aria-hidden="true">
      {competitor.firstName.slice(0, 1)}
      {competitor.lastName.slice(0, 1)}
    </span>
  )
}
