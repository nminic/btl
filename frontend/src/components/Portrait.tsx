import type { Competitor } from '../data/types'
import { cropIn, fittedTo } from './crop'
import { hueFor } from '../pages/competitorFace'
import './Crop.css'
import './Portrait.css'

/**
 * A competitor's face, in a circle: the approved photograph where there is one, and a
 * monogram on a colour of that member's own where there is not.
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
export function Portrait({ competitor }: { competitor?: Competitor }) {
  if (competitor === undefined) {
    return <span className="face-circle portrait portrait--empty" aria-hidden="true" />
  }

  /* The member's own colour, on BOTH forms of the circle and not only on the monogram.
     Behind an opaque photograph nothing of it shows, and it is still needed twice: the card
     of a competitor draws its ring in this colour (`pages/Competitors.css`), so without it a
     member with a portrait would wear a ring in the fallback hue while the member beside him
     wears his own; and a portrait sent as a PNG with transparency stands on it. */
  const own = { '--face-hue': hueFor(competitor.memberNumber) }

  if (competitor.photo !== null) {
    return (
      /* The circle is the box around the picture and not the picture itself, which is the
         one thing this has to get right that a plain `object-fit: cover` does not. A crop
         is a magnification, and magnifying an element magnifies its rounded corners with
         it: applied to the picture, a face cropped close would grow out of its own circle
         and over the name beside it. The clipping belongs to something that is never
         scaled (components/Crop.css, `.crop-fitted`). */
      <span className="face-circle portrait crop-fitted" aria-hidden="true" style={own}>
        <img
          src={competitor.photo}
          alt=""
          /* A square, and that is the whole of what these two say. The circle is drawn at
             seven different sizes across the portal, from 1,7rem in a table row to 7,5rem
             on a card, and the stylesheet decides which; these give the box a ratio of one
             to one before any of it has loaded, so a list of faces does not jump. */
          width={64}
          height={64}
          /* Loaded when it comes near, not with the page: a standing has a row per member
             and each of these is a request nobody asked for yet. */
          loading="lazy"
          decoding="async"
          /* Read through the check and not straight off the record. A member is whatever
             the file, the overlay or F5 last said he was, and a record with no square at
             all threw on a field that was not there and took a whole table into the error
             boundary: nought rows over one missing key (components/crop.ts). */
          style={fittedTo(cropIn(competitor.crop))}
        />
      </span>
    )
  }

  return (
    <span className="face-circle portrait" aria-hidden="true" style={own}>
      {competitor.firstName.slice(0, 1)}
      {competitor.lastName.slice(0, 1)}
    </span>
  )
}
