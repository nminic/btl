import { useId } from 'react'
import { DESKTOP_CONTOURS, DESKTOP_VIEW, LANE_VIEW, PHONE_CONTOURS, PHONE_VIEW, ROUTE, TRAVEL, WAYPOINTS } from './terrain'
import './RaceInMotion.css'

/* „RACE IN MOTION" (owner, 14.11.2026, PDL „Vizuelno osveženje „Race in Motion""): running drawn
 * into the atmosphere of the portal and not onto its content. Two layers and nothing else, both
 * drawn once by the shell, so no screen carries a copy and no screen can forget one.
 *
 * Both are pictures that say nothing: hidden from the reader's tree (`aria-hidden`), never a
 * stop for the keyboard (`focusable="false"` is for the old Edge and IE, which made every SVG a
 * tab stop), and never in the way of the pointer (`pointer-events: none` in the sheet). Colour,
 * stroke and which part is drawn at which width are the sheet's (`app/RaceInMotion.css`), so the
 * palette decides the colour once and these components know nothing about it.
 *
 * THE HEADER IS A COPY OF THE OWNER'S REFERENCE (15.11.2026: „Moze li da se iskopira verno ovo sto
 * sam ti dao kao primer?", `btl-produkt/primeri/dizajn-race-in-motion/referenca.webp`). Every line,
 * the runner and the strength of the gold along each line were traced out of that picture, so all
 * numbers below are the reference's own pixels: x across its 1714px header, y down from its top. The
 * sheet places them: what stands beside the column of the page (the lanes and the gold behind the
 * logo and past the navigation) is drawn from the middle of the header, at the column's own scale,
 * and what stands past the tools (the runner and the gold he runs up) is drawn from the right edge.
 */

type Span = { d: string; stops: readonly (readonly [number, number])[] }

/** The faint blue lanes, two beside the logo and three past the navigation, in three strengths. */
const LANES: readonly { d: string; strength: 'full' | 'mid' | 'faint' }[] = [
  { d: 'M0 90.9C7.3 89.9 29.3 86.6 44 84.8C58.7 82.9 74 81.1 88 79.9C102 78.7 114.7 77.9 128 77.5C141.3 77.1 154.7 77.1 168 77.5C181.3 77.9 194.7 78.7 208 79.9C221.3 81 235.3 83 248 84.5C260.7 86 278 88.2 284 89', strength: 'mid' },
  { d: 'M20 101.1C26.7 100.2 46.7 97.1 60 95.4C73.3 93.7 86.7 91.9 100 90.7C113.3 89.6 126.7 88.9 140 88.5C153.3 88.1 166.7 88 180 88.3C193.3 88.6 206 89.1 220 90.1C234 91.1 252.7 93.3 264 94.4C275.3 95.4 284 96 288 96.3', strength: 'faint' },
  { d: 'M594 89.8C600.7 89.7 620.7 89.4 634 88.9C647.3 88.4 660.7 87.6 674 86.8C687.3 85.9 700.7 85 714 83.9C727.3 82.8 740.7 81.4 754 80.1C767.3 78.7 780.7 77.3 794 75.8C807.3 74.3 820.7 72.8 834 71.1C847.3 69.4 860.7 67.4 874 65.7C887.3 63.9 900.7 62.1 914 60.6C927.3 59 940.7 57.8 954 56.4C967.3 54.9 980.7 52.8 994 51.8C1007.3 50.9 1020.7 50.8 1034 50.6C1047.3 50.5 1060.7 50.4 1074 50.8C1087.3 51.1 1100.7 51.6 1114 52.5C1127.3 53.4 1140.7 54.6 1154 56.2C1167.3 57.8 1180.7 59.7 1194 62.1C1207.3 64.5 1220.7 67.5 1234 70.5C1247.3 73.5 1260.7 77 1274 79.9C1287.3 82.7 1300.7 85.5 1314 87.8C1327.3 90 1340.7 91.7 1354 93.3C1367.3 94.9 1384.7 96.5 1394 97.4C1403.3 98.2 1407.3 98.2 1410 98.3', strength: 'full' },
  { d: 'M830 88.1C839.3 87.4 869.3 85.6 886 84.4C902.7 83.1 916 81.6 930 80.3C944 79.1 956.7 77.7 970 76.7C983.3 75.7 996.7 74.9 1010 74.3C1023.3 73.7 1036.7 73.1 1050 73C1063.3 72.8 1076.7 73 1090 73.5C1103.3 74.1 1116.7 74.8 1130 76.1C1143.3 77.4 1156.7 78.9 1170 81.3C1183.3 83.6 1193 86.2 1210 90.1C1227 94.1 1257 101.7 1272 105.1C1287 108.5 1295.3 109.5 1300 110.4', strength: 'mid' },
  { d: 'M1286 97.6C1293.3 98.6 1315.3 101.6 1330 103.4C1344.7 105.2 1362 107.4 1374 108.5C1386 109.7 1397.3 110.1 1402 110.4', strength: 'faint' },
]

/** A lane comes in out of nothing and goes back into it. */
const LANE_FADE: Span['stops'] = [
  [0, 0],
  [0.15, 1],
  [0.85, 1],
  [1, 0],
]

/** The one gold line, where the reference lets it be seen: behind the logo, over the end of the
 *  navigation, and up under the runner. Between those it fades to nothing, so it is drawn as the
 *  three spans it is seen in, each with the strength it has in the reference at every tenth of its
 *  length. */
const GOLD_LOGO: Span = { d: 'M66 68.8C70 68.5 82 67.5 90 66.9C98 66.4 106 65.9 114 65.6C122 65.3 130 64.9 138 64.8C146 64.8 154 64.8 162 65.1C170 65.3 178 65.9 186 66.4C194 67 202 67.6 210 68.4C218 69.2 226 70.2 234 71.3C242 72.4 250 73.6 258 74.9C266 76.2 274 77.7 282 79.2C290 80.8 300 83 306 84.2C312 85.4 316 86 318 86.3', stops: [[0, 0], [0.1, 0.28], [0.2, 0.43], [0.3, 0.71], [0.4, 0.85], [0.5, 0.85], [0.6, 0.85], [0.7, 0.68], [0.8, 0.43], [0.9, 0.23], [1, 0]] }
const GOLD_NAVIGATION: Span = { d: 'M982 63.9C986 63.8 998 63.2 1006 62.9C1014 62.7 1022 62.6 1030 62.5C1038 62.4 1046 62.4 1054 62.4C1062 62.5 1070 62.5 1078 62.7C1086 63 1094 63.5 1102 64C1110 64.5 1118 65 1126 65.8C1134 66.5 1142 67.4 1150 68.4C1158 69.3 1166 70.4 1174 71.7C1182 73 1190 74.4 1198 76C1206 77.5 1214.5 79.5 1222 81.1C1229.5 82.7 1239.5 84.8 1243 85.6', stops: [[0, 0], [0.1, 0.33], [0.2, 0.55], [0.3, 0.82], [0.4, 1], [0.5, 1], [0.6, 1], [0.7, 0.92], [0.8, 0.58], [0.9, 0.33], [1, 0]] }
const GOLD_RUNNER: Span = { d: 'M1394 128.7C1398 128.4 1410 127.6 1418 126.8C1426 125.9 1434 124.8 1442 123.6C1450 122.4 1458 121.1 1466 119.6C1474 118.1 1482 116.4 1490 114.6C1498 112.8 1506 110.8 1514 108.8C1522 106.8 1530 104.6 1538 102.7C1546 100.7 1554 98.8 1562 97.1C1570 95.4 1578 93.9 1586 92.5C1594 91.2 1602 90.1 1610 89.2C1618 88.3 1626 87.5 1634 87.1C1642 86.6 1650 86.5 1658 86.6C1666 86.6 1674 87 1682 87.4C1690 87.8 1701 88.8 1706 89.2C1711 89.6 1711 89.5 1712 89.6', stops: [[0, 0], [0.1, 0.18], [0.2, 0.35], [0.3, 0.58], [0.4, 0.85], [0.5, 0.85], [0.6, 0.85], [0.7, 0.66], [0.8, 0.54], [0.9, 0.29], [1, 0]] }

/** The runner, one thin outline and nothing inside it, traced along the MIDDLE of the reference's
 *  stroke (owner, 15.11.2026: „mozes li u potpunosti da iskopiras coveka sa prilozenog primera???"):
 *  enlarged eight times, thinned to one pixel and walked, with no smoothing beyond two pixels of the
 *  enlargement, so the cap's visor, the neck, both elbows and both fists keep their corners. Where
 *  the soles stand on the gold line their points are the line's own (`GOLD_RUNNER`), so the feet
 *  touch it and do not cross it; `geometry/raceInMotion.geometry.ts` holds that on the screen. */
const RUNNER = 'M1557.7 21.4L1560.4 22.1L1561.8 23.1L1562.9 24.5L1563.3 26.3L1562.9 31.6L1561.9 34.2L1560.7 35.2L1558.3 35.4L1557.6 36.3L1559.1 40.9L1558.7 49.7L1560.4 50.2L1564.2 49.2L1568.9 46.1L1570.3 45.7L1571.8 46.4L1572.7 48.6L1571.2 50.8L1568.1 51.3L1563.2 53.6L1556.7 55.8L1555.1 55.8L1553.1 52.7L1552.2 52.8L1547.2 59.4L1546.9 60.2L1547.4 61L1557.7 65.5L1560.9 67.7L1562.2 69.6L1562.4 71.3L1561.7 73.4L1555.1 82.3L1551.3 88.3L1551.2 90.1L1552 92.7L1555.2 95.7L1557.5 98.1L1549 100L1548.4 95.7L1544.4 93.5L1543.7 91.6L1544.2 90.4L1546.8 87.9L1548.7 85.1L1550.1 79.8L1552.9 72.7L1552.2 72.2L1541.1 70.6L1527.9 83.9L1521.9 87.5L1511.3 96.7L1509 99.3L1506.6 104.8L1507 110.5L1503.8 111.3L1503.2 108.6L1501.9 105.2L1502.2 101.4L1501.3 98.7L1501.4 97.6L1502.4 96.7L1505.1 96.4L1507.8 94.7L1514.9 85.1L1517.6 82.7L1523.7 78.9L1526 74.4L1531.6 65.7L1531.7 62.6L1532.3 60.4L1534.5 57.3L1538.5 53.5L1540.5 49.6L1543.3 39.9L1542.7 39.1L1538.4 37.4L1537.5 37.8L1536.1 39.2L1530.7 45.9L1529.8 48.1L1529.9 50.4L1528.8 52L1527.6 52.9L1526.3 52.7L1524.2 50.8L1524.1 49.2L1527.2 46.5L1531 38.6L1534.6 33.1L1536.6 32.3L1549.4 33.1L1551.3 32.8L1552.8 30.9L1551.6 26.6L1549.2 26.9L1551.5 26.3L1554.7 22.3Z'

function Fade({ id, stops, kind }: { id: string; stops: Span['stops']; kind: 'gold' | 'lane' }) {
  return (
    <linearGradient id={id} className={`race-header__fade race-header__fade--${kind}`}>
      {stops.map(([offset, opacity]) => (
        <stop key={offset} offset={offset} stopOpacity={opacity} />
      ))}
    </linearGradient>
  )
}

export function HeaderDecoration() {
  /* The gradients are named, and a name in a document has to be one: React's own id, with the
     characters a URL fragment would have to escape taken out. */
  const id = useId().replaceAll(/[^a-zA-Z0-9]/g, '')
  const at = (name: string) => `race-${id}-${name}`

  return (
    <div className="race-header" aria-hidden="true">
      <svg className="race-header__track" viewBox="-100 0 1550 142" preserveAspectRatio="none" focusable="false">
        <defs>
          <Fade id={at('lane')} stops={LANE_FADE} kind="lane" />
          <Fade id={at('logo')} stops={GOLD_LOGO.stops} kind="gold" />
          <Fade id={at('navigation')} stops={GOLD_NAVIGATION.stops} kind="gold" />
        </defs>
        {LANES.map((lane) => (
          <path
            key={lane.d}
            className={`race-header__lane race-header__lane--${lane.strength}`}
            stroke={`url(#${at('lane')})`}
            d={lane.d}
          />
        ))}
        <path className="race-header__gold" stroke={`url(#${at('logo')})`} d={GOLD_LOGO.d} />
        <path className="race-header__gold" stroke={`url(#${at('navigation')})`} d={GOLD_NAVIGATION.d} />
      </svg>
      <svg className="race-header__rise" viewBox="1300 0 280 142" focusable="false">
        <defs>
          <Fade id={at('runner')} stops={GOLD_RUNNER.stops} kind="gold" />
        </defs>
        <path className="race-header__gold" stroke={`url(#${at('runner')})`} d={GOLD_RUNNER.d} />
        <path className="race-header__runner" d={RUNNER} />
      </svg>
    </div>
  )
}

/** The ground of the page: four hills of their own along the edges, each a set of nested contour
 *  lines, with a route that runs between them, and a dot that runs the route once and leaves over the
 *  bottom edge of the window (owner,
 *  14.11.2026 and the approved draft of 20.11.2026). The route and the dot are in a lane of their own,
 *  a strip in the gutter beside the column of the page (owner, 20.11.2026: „Jaka tačka, nikad ispod
 *  teksta"), so they are never over a word, and the drawing is squeezed across where the gutter is narrower
 *  than the window is tall (`--fit`, `app/RaceInMotion.css`), so none of it is cut off by the window or the strip. A telephone gets a drawing of its own, long
 *  lines along both edges and two small hills, with no route and no dot. The shapes are data
 *  (`app/terrain.ts`); how strong they are, which of the two drawings is drawn and when the dot
 *  moves are the sheet's (`app/RaceInMotion.css`). The cards and tables stay opaque, so the ground
 *  shows in the gutters and in the gaps between them.
 *
 *  `screen` names the screen that is open (its path). The dot is given it as its key, so a new
 *  screen is a new dot, and a new dot starts to run from the beginning: it runs on every screen that
 *  opens and not only when the portal loads. A filter that writes itself into the query is not a
 *  new screen, and the caller passes the path alone. */
export function PageBackgroundDecoration({ screen }: { screen: string }) {
  return (
    <div className="race-page" aria-hidden="true">
      <svg className="terrain terrain--wide" viewBox={DESKTOP_VIEW} preserveAspectRatio="xMidYMid slice" focusable="false">
        <g className="terrain__hills">
          {DESKTOP_CONTOURS.map((contour) => (
            <path key={contour.d} d={contour.d} opacity={contour.opacity} />
          ))}
        </g>
      </svg>
      <svg className="terrain terrain--lane" viewBox={LANE_VIEW} preserveAspectRatio="xMaxYMid slice" focusable="false">
        <g className="race-lane__fit">
          <path className="terrain__route" d={ROUTE} />
          {WAYPOINTS.map(([x, y]) => (
            <g key={`${x},${y}`}>
              <circle className="terrain__waypoint" r="3" cx={x} cy={y} />
              <circle className="terrain__waypoint-ring" r="7.5" cx={x} cy={y} />
            </g>
          ))}
          <g key={screen} className="race-page__dot" style={{ offsetPath: `path('${TRAVEL}')` }}>
            <circle className="race-page__dot-ring" r="11" />
            <circle className="race-page__dot-core" r="5" />
          </g>
        </g>
      </svg>
      <svg className="terrain terrain--narrow" viewBox={PHONE_VIEW} preserveAspectRatio="xMidYMid slice" focusable="false">
        <g className="terrain__hills">
          {PHONE_CONTOURS.map((contour) => (
            <path key={contour.d} d={contour.d} opacity={contour.opacity} />
          ))}
        </g>
      </svg>
    </div>
  )
}
