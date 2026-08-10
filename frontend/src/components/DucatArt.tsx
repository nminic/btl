import { useId } from 'react'
import type { Ducat, DucatMark } from '../data/ducatRule'
import { coinNumber, unitOf } from '../data/ducatRule'
import './DucatArt.css'

/* The mark of a ducat: a struck coin, with everything it says written on it.
 *
 * A deep blue face in the league's own blue, a milled edge, one legend around
 * the top and one around the bottom, and the number of the rule cut into the
 * middle. It is not a Garmin tile, and the differences are the point: no
 * hexagon, no illustrated scene, no banner across the bottom holding the text.
 * The number is the hero, because in this league the number is the achievement.
 *
 * Everything is measured in the units of the drawing, where the coin is 200
 * across, so the whole mark scales with one number and nothing inside it has to
 * be told the size.
 *
 * ## Why the two legends sit on different circles
 *
 * A legend along the top grows away from its baseline towards the rim; a legend
 * along the bottom grows from its baseline towards the middle. One radius for
 * both therefore gives two different gaps, which is what the owner saw on
 * 10.08.2026 ("rastojanje od ISTRČANIH do vrha novčića je mnogo manje").
 *
 * So the bottom baseline is the circle both of them touch, and the top baseline
 * is that circle less the height of a capital. Both legends then stop exactly
 * seven units short of the milled edge whatever size they are set at. The caron
 * of Č rides 2.7 above the capitals and is allowed to come closer, as it does on
 * a struck coin. The figures are measured, not guessed (ADL A12, 9).
 */

/** The circle both legends touch: the baseline of the lower one, and the cap
 *  line of the upper one. */
const TOUCH = 82

/** Height of a capital, and width of a figure, as fractions of the type size.
 *  Measured through `measureText` at ten times the size, because the browser
 *  answers in whole pixels. */
const CAP = 0.7154
const CAP_FIGURE = 0.7187
const CAP_UNIT = 0.75
const FIGURE_WIDTH = 0.5605

/** The mark of the kind ends here, and nothing comes closer to it than this, so
 *  the widest a number may be drawn is what is left between the two. */
const MARK_END = 31
const MARK_CLEARANCE = 12
const WIDEST = 200 - 2 * (MARK_END + MARK_CLEARANCE)

/** A ceiling on the type size that is a matter of the eye rather than of the
 *  geometry: two figures would fit at 101, and beside a coin carrying four they
 *  would read as a different drawing. A wall of ducats has to be one set. */
const LARGEST = 86

/** Between the foot of the number and the top of its unit. */
const UNIT_GAP = 9

/** A longer legend is set smaller, so that it does not walk half way round the
 *  coin. The gap to the edge does not move with it: the lower legend is
 *  measured from its baseline, and the upper one has its radius worked out from
 *  whatever size it ends up at. */
function legendSize(text: string): number {
  if (text.length <= 12) {
    return 13
  }

  return text.length <= 15 ? 11.5 : 10.5
}

/** The largest the number may be set: as wide as the space between the two
 *  marks allows, and never larger than the ceiling. */
function figureSize(text: string): number {
  return Math.min(LARGEST, WIDEST / (Math.max(text.length, 1) * FIGURE_WIDTH))
}

function arcPath(radius: number, top: boolean): string {
  const sweep = top ? 1 : 0

  return `M ${100 - radius} 100 A ${radius} ${radius} 0 0 ${sweep} ${100 + radius} 100`
}

/* The seven marks. Each is drawn at nine o'clock and mirrored to three, so the
 * two are the same shape and cannot drift apart. They live between the milled
 * edge and the number, which is where a coin has always put its ornament, and
 * they say what is counted without saying how much. */
const MARKS: Record<DucatMark, string[]> = {
  /* Three lines of a track. */
  distance: ['M17 92 H29', 'M15 100 H31', 'M17 108 H29'],
  /* A clock, with the two hands it needs to be one. */
  time: ['M23 100 V95.4', 'M23 100 H26.6'],
  /* A four pointed star. */
  points: ['M23 91 L25.1 97.9 L31 100 L25.1 102.1 L23 109 L20.9 102.1 L15 100 L20.9 97.9 Z'],
  /* A flag on its pole. */
  races: ['M19 89 V111', 'M19 90.5 L29 94.5 L19 98.5 Z'],
  /* Two chevrons, climbing. */
  vertical: ['M15 104 L23 96.5 L31 104', 'M15 111 L23 103.5 L31 111'],
  /* One branch of a laurel wreath, for the clubs of a hundred. */
  club: [
    'M22 112 C17.6 104 18.6 95.6 24 88.8',
    'M21.8 106 L16.6 103',
    'M21.6 99 L16.4 96',
    'M23.6 92.6 L18.6 90.4',
  ],
  /* Two meridians. */
  countries: [
    'M20 89.5 C14.6 95.6 14.6 104.4 20 110.5',
    'M26.4 87.6 C20.2 94.6 20.2 105.4 26.4 112.4',
  ],
}

function Mark({ mark }: { mark: DucatMark }) {
  const strokes = MARKS[mark]

  return (
    <g className="ducat-art__mark">
      {strokes.map((d, at) => (
        <path key={at} d={d} />
      ))}
      {mark === 'time' && <circle cx="23" cy="100" r="6.8" />}

      <g transform="translate(200,0) scale(-1,1)">
        {strokes.map((d, at) => (
          <path key={at} d={d} />
        ))}
        {mark === 'time' && <circle cx="23" cy="100" r="6.8" />}
      </g>
    </g>
  )
}

/* A spiral galaxy, for the hundred kilometres of climbing that reach the edge of
 * the atmosphere. Enlarged about the middle until it fills the same width the
 * widest number is allowed, which is how far anything in the middle may go. */
function Galaxy() {
  return (
    <g
      className="ducat-art__art"
      transform="rotate(-18 100 100) translate(100 100) scale(1.4) translate(-100 -100)"
    >
      <ellipse cx="100" cy="100" rx="12.5" ry="7" />
      <path d="M110.5 94.2 C130 87 140 103 128 116 C118.5 126 101.5 127 91.5 122.5" />
      <path d="M89.5 105.8 C70 113 60 97 72 84 C81.5 74 98.5 73 108.5 77.5" />
      <circle className="ducat-art__star" cx="131" cy="90" r="2.1" />
      <circle className="ducat-art__star" cx="84" cy="127" r="1.9" />
      <circle className="ducat-art__star" cx="69" cy="110" r="2.1" />
      <circle className="ducat-art__star" cx="116" cy="73" r="1.9" />
    </g>
  )
}

/* The globe, for the one ducat that is the circumference of the Earth. */
function Globe() {
  return (
    <g className="ducat-art__art">
      <circle cx="100" cy="100" r="57" />
      <ellipse cx="100" cy="100" rx="20.7" ry="57" />
      <ellipse cx="100" cy="100" rx="41.5" ry="57" />
      <path d="M43 100 H157" />
      <path d="M50.9 71 H149.1" />
      <path d="M50.9 129 H149.1" />
    </g>
  )
}

export type DucatArtProps = {
  ducat: Ducat
  /** What the coin is, in one sentence, for a reader who cannot see it.
   *
   *  The drawing was decorative while a hint stood beside it carrying the rule.
   *  The owner took the hint away on 11.08.2026 and asked for the coins to stand
   *  still and say nothing, so the coin now has to carry its own name. Nothing
   *  of this shows on the page. */
  label: string
}

/* The value of the ducat rides on the element as a fact rather than as five
 * class names, the way the kind of the ducat already did. It is data: one of
 * five, chosen by the rule and not by the drawing, and the stylesheet answers it
 * with the metal it is struck in. */
export function DucatArt({ ducat, label }: DucatArtProps) {
  /* The two arcs are referred to by name, and a wall draws fifteen coins on one
     page, so the names have to be this drawing's own. */
  const own = useId()
  const number = coinNumber(ducat)
  const unit = unitOf(ducat)

  const topSize = legendSize(ducat.top)
  const numberSize = figureSize(number)
  const unitSize = numberSize >= 68 ? 26 : 22

  const capNumber = CAP_FIGURE * numberSize
  const capUnit = CAP_UNIT * unitSize
  /* The block of number and unit is centred on the middle of the coin, which is
     not the same as putting the number there: with the unit under it, a number
     centred on its own sits high by half the unit. */
  const numberY =
    unit === '' ? 100 + capNumber / 2 : 100 - (UNIT_GAP + capUnit - capNumber) / 2

  return (
    <span className="ducat-art" data-tier={ducat.tier}>
      {/* An image with a name, rather than a decoration. Everything struck on
          it is struck as text, but text inside a drawing is read out as a heap
          of fragments: "ISTRČANIH", "125", "km", "JUL 2027". The label is the
          same coin said as a sentence. */}
      <svg className="ducat-art__coin" viewBox="0 0 200 200" role="img" aria-label={label}>
        <defs>
          <path id={`${own}-top`} d={arcPath(TOUCH - CAP * topSize, true)} />
          <path id={`${own}-bottom`} d={arcPath(TOUCH, false)} />
        </defs>

        {/* The fourth value fills the milled edge in behind the teeth. More
            metal in the same place, without a second colour. */}
        {ducat.tier === 4 && <circle className="ducat-art__band" cx="100" cy="100" r="91.5" />}
        <circle className="ducat-art__reed" cx="100" cy="100" r="91.5" />
        <circle className="ducat-art__rim" cx="100" cy="100" r="95.5" />

        <text className="ducat-art__legend" fontSize={topSize}>
          <textPath href={`#${own}-top`} startOffset="50%" textAnchor="middle">
            {ducat.top}
          </textPath>
        </text>
        <text className="ducat-art__legend" fontSize={legendSize(ducat.bottom)}>
          <textPath href={`#${own}-bottom`} startOffset="50%" textAnchor="middle">
            {ducat.bottom}
          </textPath>
        </text>

        <Mark mark={ducat.mark} />

        {ducat.art === 'galaxy' && <Galaxy />}
        {ducat.art === 'globe' && <Globe />}

        {number !== '' && (
          <text
            className="ducat-art__number"
            x="100"
            y={numberY}
            fontSize={numberSize}
            textAnchor="middle"
          >
            {number}
          </text>
        )}

        {unit !== '' && (
          <text
            className="ducat-art__unit"
            x="100"
            y={numberY + UNIT_GAP + capUnit}
            fontSize={unitSize}
            textAnchor="middle"
          >
            {unit}
          </text>
        )}
      </svg>
    </span>
  )
}
