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

/** The gold line (owner, 15.11.2026: „lepe istaknute zlatne linije"), bright, and for that reason
 *  drawn only where no word of the header stands. On every screen it runs along the foot of the
 *  header, in a strip 1rem tall stretched to the whole width, whose units across are thousandths of
 *  the width and whose units down are sixteenths of a rem: between a quarter and three quarters of a
 *  rem above the foot, which is the padding under the last line of the bar on a telephone and under
 *  the navigation from a tablet. Over the middle of a desktop it lies at about ten pixels up, where
 *  the runner's rear foot comes down on it. `geometry/raceInMotion.geometry.ts` holds that it
 *  touches no text at any width. */
const GOLD = 'M-10 12C150 10.5 300 8.5 450 8S560 6.4 640 6.2S820 6 880 7.4S960 10.4 1010 10.6'

/** A thinner companion beside it, crossing it twice, the way the reference draws its lines in
 *  pairs. Drawn at half the strength of the line it follows. */
const GOLD_ECHO = 'M-10 9C200 12.2 420 13 620 11.2S860 8.4 1010 9.8'

/** Where the line climbs, from a desktop: the reference's runner runs up a gold slope, and so does
 *  this one. Drawn in pixels and never stretched, leaving the line above at its own height, climbing
 *  under the runner (his rear foot at 110 across, 22 up) and on into the empty corner under the
 *  tools of the bar, never higher than five rem above the foot of the header, which is below the
 *  tools at every width it is drawn at. */
const GOLD_RISE = 'M0 70C40 70 70 66 120 56S240 30 360 21S640 11 960 9'

/** The runner (owner, 15.11.2026: „nema veze sa trkacem koji sam ti dao kao primer"): a figure in a
 *  sprint, leaning into the run, the rear arm swung back and the front knee up, drawn as ONE closed
 *  outline in the reference's manner, a gold rim around a body in a quiet tone, never as strokes.
 *  Built from tapered limbs joined into one silhouette and traced; the box is cut to the figure, so
 *  its foot is the bottom of the drawing less two units. */
const RUNNER =
  'M66.9 5.8C67.7 5.6 68.5 5.8 69.2 6.1C69.9 6.4 70.6 7 71.1 7.6C71.6 8.2 71.8 8.8 72 9.4C72.2 10.1 72.4 10.7 72.2 11.5C72 12.3 71.8 13.4 71.1 14.4C70.4 15.4 68.9 15.8 67.9 17.4C66.9 19 65.5 22.1 65 23.8C64.5 25.5 64.8 26.1 64.9 27.6C65 29.1 65.3 31.8 65.6 32.8C65.8 33.8 66.1 33.5 66.4 33.6C66.7 33.7 66 34.3 67.3 33.5C68.6 32.7 72.9 29.6 74.3 29C75.7 28.4 75.6 29.4 75.9 29.8C76.2 30.2 76.2 30.8 76.1 31.2C76 31.6 77.2 30.8 75.3 32.4C73.3 33.9 66.5 39.2 64.4 40.5C62.3 41.8 63.2 40.6 62.6 40C62 39.4 61.5 37.4 61.1 36.8C60.7 36.2 60.6 36.3 60.4 36.2C60.2 36.1 60.6 35.1 59.7 36.4C58.8 37.6 55.8 42.2 54.9 43.7C54 45.2 54.4 44.6 54.6 45.1C54.8 45.6 54.1 45.6 55.9 46.5C57.7 47.4 63.5 49.7 65.4 50.7C67.3 51.8 67.2 52 67.5 52.8C67.8 53.6 68.4 52 67.5 55.3C66.6 58.5 63 69.2 62.1 72.3C61.2 75.4 61.5 73.1 62.4 73.9C63.2 74.8 66.4 76.6 67.2 77.4C68 78.2 67.5 78.6 67.3 78.9C67.1 79.2 66.8 79.6 65.8 79.4C64.8 79.2 62.7 77.9 61.5 77.6C60.3 77.3 59.4 77.9 58.6 77.7C57.9 77.5 57 77.5 57 76.3C57 75.1 58.4 72 58.6 70.3C58.8 68.6 58.2 68.3 58.4 66.3C58.6 64.3 59.5 60.1 59.7 58.5C59.9 56.9 59.9 57.2 59.4 56.7C58.9 56.2 58.7 56.1 57 55.7C55.3 55.3 50.6 54.4 49 54.4C47.4 54.4 49.4 53.2 47.2 55.7C45.1 58.2 40.5 64.4 36.1 69.3C31.7 74.2 23.2 82.1 20.6 85C18 87.9 19.9 85.6 20.3 86.8C20.7 88 22.5 91.1 22.8 92.3C23.1 93.5 22.6 93.5 22.3 93.7C22 93.9 21.6 94.4 20.9 93.7C20.1 93 18.7 90.4 17.8 89.3C16.9 88.2 15.9 87.8 15.4 87.1C14.9 86.4 14 87.1 15.1 85.4C16.2 83.7 20.2 79.5 22.2 76.8C24.2 74.1 25.6 71.3 26.9 69.5C28.2 67.7 27.9 69.9 30.2 66.2C32.5 62.5 38.4 51 40.8 47.1C43.2 43.2 42.8 45.7 44.4 43.1C46 40.5 49.3 33.5 50.3 31.3C51.3 29.1 50.4 30.5 50.2 30.2C50 29.9 50.3 29.6 49.3 29.7C48.3 29.8 46.2 28.9 44.2 30.7C42.2 32.5 38.8 38.8 37.3 40.3C35.8 41.8 35.6 39.9 35.2 39.6C34.8 39.3 34.7 39 34.7 38.5C34.7 38 33.8 38.9 35 36.9C36.2 34.9 38.7 28.9 41.8 26.7C44.9 24.5 51 24.4 53.4 23.5C55.8 22.6 55.3 21.9 56.4 21.3C57.5 20.7 58.8 20.8 59.9 19.8C61 18.8 62.6 16.6 63 15.3C63.4 14 62.5 13 62.5 11.9C62.5 10.8 62.7 9.7 63 8.9C63.3 8.1 63.8 7.5 64.4 7C65.1 6.5 66.1 6 66.9 5.8Z'

export function HeaderDecoration() {
  return (
    <div className="race-header" aria-hidden="true">
      <svg className="race-header__track" viewBox="0 0 1600 160" focusable="false">
        {LANES.map((lane) => (
          <path key={lane.d} className={`race-header__lane race-header__lane--${lane.from}`} d={lane.d} />
        ))}
      </svg>
      <svg className="race-header__strip" viewBox="0 0 1000 16" preserveAspectRatio="none" focusable="false">
        <path className="race-header__gold race-header__gold--echo" d={GOLD_ECHO} />
        <path className="race-header__gold" d={GOLD} />
      </svg>
      <svg className="race-header__rise" viewBox="0 0 960 80" focusable="false">
        <path className="race-header__gold" d={GOLD_RISE} />
      </svg>
      <svg className="race-header__runner" viewBox="13 4 66 92" focusable="false">
        <path d={RUNNER} />
      </svg>
    </div>
  )
}

/** Contour lines and a route with its waypoints across the whole window (owner, 15.11.2026: the
 *  drawing goes through the middle as well, between the boxes, and not only along the sides). The
 *  drawing itself is two tiles in the sheet, repeated across and down the window, so a page of any
 *  size gets it without a seam; the cards and tables stay opaque, so it shows in the gaps. */
export function PageBackgroundDecoration() {
  return <div className="race-page" aria-hidden="true" />
}
