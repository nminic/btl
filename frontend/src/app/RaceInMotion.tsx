import './RaceInMotion.css'

/* „RACE IN MOTION" (owner, 14.11.2026, PDL „Vizuelno osveženje „Race in Motion""): running drawn
 * into the atmosphere of the portal and not onto its content. Two layers and nothing else, both
 * drawn once by the shell, so no screen carries a copy and no screen can forget one.
 *
 * Both are pictures that say nothing: hidden from the reader's tree (`aria-hidden`), never a
 * stop for the keyboard (`focusable="false"` is for the old Edge and IE, which made every SVG a
 * tab stop), and never in the way of the pointer (`pointer-events: none` in the sheet). Colour,
 * stroke and which lines are drawn at which width are the sheet's (`app/RaceInMotion.css`), so
 * the theme decides the colour once and these components know nothing about it.
 */

type Lane = { d: string; from: 'always' | 'tablet' | 'desktop' }

/** The lanes of a running track, drawn across the header. Mobile first: the two that are always
 *  drawn come first, the third joins from a tablet and the fourth from where the navigation
 *  unfolds, so a telephone gets two lines and the gold one and not the desktop scaled down. */
const LANES: readonly Lane[] = [
  { d: 'M-20 70C300 52 640 46 920 64S1400 122 1640 108', from: 'always' },
  { d: 'M-20 82C320 64 660 58 940 76S1410 132 1640 120', from: 'always' },
  { d: 'M-20 58C300 40 620 34 900 52S1400 112 1640 96', from: 'tablet' },
  { d: 'M-20 94C340 76 680 70 960 88S1420 142 1640 132', from: 'desktop' },
]

/** The one gold line, running beside the second lane over the half of the track that bends
 *  down towards the runner. */
const GOLD = 'M600 64C760 62 860 76 946 82C1220 100 1410 138 1640 126'

export function HeaderDecoration() {
  return (
    <div className="race-header" aria-hidden="true">
      <svg className="race-header__track" viewBox="0 0 1600 160" focusable="false">
        {LANES.map((lane) => (
          <path key={lane.d} className={`race-header__lane race-header__lane--${lane.from}`} d={lane.d} />
        ))}
        <path className="race-header__gold" d={GOLD} />
      </svg>
      <svg className="race-header__runner" viewBox="0 0 64 72" focusable="false">
        <circle cx="41" cy="9" r="5" />
        <path d="M37 16C34 24 31 31 28 38" />
        <path d="M36 20C41 24 45 25 50 22L53 16" />
        <path d="M35 21C30 25 26 27 21 25L18 30" />
        <path d="M28 38C34 42 38 46 41 50L36 60L41 62" />
        <path d="M28 38C24 46 20 52 14 58L6 56" />
      </svg>
    </div>
  )
}

/** Contour lines and a route with its waypoints along the two outer edges of every page. The
 *  drawing itself is two tiles in the sheet, repeated down the window, so a page of any height
 *  gets it without a seam and the middle of the screen is left quiet. */
export function PageBackgroundDecoration() {
  return (
    <div className="race-page" aria-hidden="true">
      <span className="race-page__edge race-page__edge--start" />
      <span className="race-page__edge race-page__edge--end" />
    </div>
  )
}
