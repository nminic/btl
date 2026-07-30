import type { CSSProperties } from 'react'
import type { BadgeKind } from '../data/badgeRule'
import './BadgeArt.css'

/* The mark of a badge: the drawing, and the two texts that stand on it.
 *
 * The contract:
 *
 *   kind       Which kind of badge this is (PDL P28a). It picks the emblem in
 *              the lower third of the disc and nothing else; every other line
 *              is the same for all kinds, which is what makes a wall of badges
 *              read as one set.
 *   threshold  The number of the rule, already written for the reader's language
 *              and carrying its unit: "1.000 km", "42,2 km", "25". It is never
 *              empty: the value of a rule is an obligatory field of the badge
 *              form and has to stay one, because a mark with nothing in the
 *              middle says nothing.
 *   label      A short text under the drawing, which the administrator writes,
 *              typically a period: "Jul 2027". It may be empty, and then nothing
 *              is drawn in its place and the mark keeps exactly the size it has
 *              with one, so a grid of badges does not step up and down.
 *
 * What the drawing is, and what it deliberately is not.
 *
 * A struck coin: a deep blue face in the league's own blue, a thin gold rim, one
 * gold emblem, and the number of the rule cut into the middle of it. Gold means
 * achievement on this portal and nothing else (the visual direction, approved),
 * and a badge is one of the few places allowed to be carried by it.
 *
 * It is not a Garmin tile, and the differences are the point. No hexagon, no
 * illustrated scene, no picture of a landscape, no gloss, and above all no
 * banner across the bottom holding the text: the label stands under the coin as
 * text of the page, because a coin with a caption is a coin, and a coin with a
 * ribbon printed on it is a sticker. The number is the hero here rather than a
 * detail in a corner, because in this league the number is the achievement.
 *
 * Adding the other kinds: draw one emblem into the same slot, x 27 to 73 and
 * y 64 to 86 of the viewBox, split into the same two groups, and add one branch
 * to the line that chooses it. The outline goes in the outer group and whatever
 * only survives at 96px and above goes in the inner one; nothing else in this
 * file or in the stylesheet should have to move. The slot is where it is because
 * the number owns the middle, and the number is the part that has to be legible
 * at 48px.
 */
export type BadgeArtProps = {
  kind: BadgeKind
  /** Never empty. */
  threshold: string
  /** Empty when the badge has none. */
  label: string
}

/* How many characters the widest word of the threshold has, which is what
 * decides how large the number can be set.
 *
 * The whole string is the wrong measure: "10.000 km" breaks at its space, so
 * what has to fit across the disc is "10.000" and not the nine characters
 * together. Measuring the string instead would set every badge carrying a unit
 * two sizes smaller than it needs to be.
 *
 * The floor of one keeps a threshold that somehow arrived empty from dividing
 * the size by nought; the contract says it cannot, and the drawing survives it
 * anyway. */
function widestWord(threshold: string): number {
  return Math.max(1, ...threshold.split(' ').map((word) => word.length))
}

/* A running shoe, seen from the side, for the kind counted in kilometres.
 *
 * The one line that has to be right is the top one: it climbs from a low, long
 * toe to a high heel collar a third of the way from the back. That slope is
 * what makes a shoe a shoe at a glance, and it is what a flat outline gets
 * wrong. The rest is a thick midsole and a rounded toe.
 *
 * The outline carries the shape; the second group carries what only exists at
 * the larger sizes: the seam of the sole, the heel counter, the laces and the
 * tread. */
function Shoe() {
  return (
    <g className="badge-art__emblem">
      <path
        d="M27.5 85.5 L66 85.5
           C70.5 85.5 73 84.1 73 81.7
           C73 79.1 70 77.7 65.5 76.9
           L55 74.9
           C50 73.9 46.5 71.9 44.4 68.9
           C43 66.9 41 64.9 38.6 64.7
           C35.6 64.5 33.4 66.1 32 69.1
           C30 73.3 28.4 78.7 27.5 85.5 Z"
      />

      <g className="badge-art__fine">
        <path d="M29.8 79.1 C42 81.1 57 81.9 71.8 81.1" />
        <path d="M37.6 66.3 C34.6 69.3 32.6 73.1 31.4 78.1" />
        <path d="M46.7 70 L44.8 73.9" />
        <path d="M49.4 71.4 L47.5 75.3" />
        <path d="M52.2 72.7 L50.3 76.7" />
        <path d="M36 81.4 L36 84.5" />
        <path d="M44 82 L44 84.7" />
        <path d="M52 82.4 L52 84.8" />
        <path d="M60 82.6 L60 84.8" />
      </g>
    </g>
  )
}

/* The emblem every other kind wears until it is given its own: a wreath, open
 * at the top, which says an award was won and says nothing whatever about what
 * was counted. That is the one honest thing a shared emblem can say, and it
 * keeps a kind with no drawing of its own from looking like a kind whose
 * drawing failed to load.
 *
 * One branch a side, rising almost to vertical where it ends, and the leaves
 * are spurs off it rather than drawn shapes. Leaves at the size this slot
 * allows run together into a single crescent by 96px; a branch that turns
 * upwards holds its shape all the way down, and the spurs step aside with the
 * rest of the fine detail. */
function Wreath() {
  return (
    <g className="badge-art__emblem badge-art__wreath">
      <path d="M50 86.6 C39.6 86.6 31.4 79.2 29.8 67.3" />
      <path d="M50 86.6 C60.4 86.6 68.6 79.2 70.2 67.3" />

      <g className="badge-art__fine">
        <path d="M42.7 85.3 L40.5 81.6" />
        <path d="M37.7 82.4 L34.7 79.2" />
        <path d="M33.7 78 L30.2 75.8" />
        <path d="M31 72.3 L27.2 71.2" />
        <path d="M57.3 85.3 L59.5 81.6" />
        <path d="M62.3 82.4 L65.3 79.2" />
        <path d="M66.3 78 L69.8 75.8" />
        <path d="M69 72.3 L72.8 71.2" />
      </g>
    </g>
  )
}

export function BadgeArt({ kind, threshold, label }: BadgeArtProps) {
  return (
    <span className="badge-art" data-kind={kind}>
      <span className="badge-art__disc">
        {/* Decorative on purpose: everything the drawing says is said in words
            beside it, by the threshold below and by the name and the rule of
            the badge on the screen that shows it. Given a name of its own it
            would be read out twice. */}
        <svg className="badge-art__shape" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="badge-art__rim" cx="50" cy="50" r="48" />
          <circle className="badge-art__rule" cx="50" cy="50" r="43.5" />

          {kind === 'totalKm' ? <Shoe /> : <Wreath />}
        </svg>

        {/* The number stays text: selectable, searchable, and read out as the
            number it is. Drawn as paths it would be a picture of a number. */}
        <span
          className="badge-art__threshold"
          style={{ '--badge-art-chars': widestWord(threshold) } as CSSProperties}
        >
          {threshold}
        </span>
      </span>

      {label !== '' && <span className="badge-art__label">{label}</span>}
    </span>
  )
}
