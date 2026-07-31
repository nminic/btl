import { CATEGORIES } from '../data/derive'
import type { RaceCategory } from '../data/types'
import { formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import {
  BAND,
  CIRCUMFERENCE,
  CX,
  CY,
  HEIGHT,
  RADIUS,
  WIDTH,
  leaderPoints,
  placeCallouts,
  type Slice,
} from './donutLayout'
import './CategoryDonut.css'

/* A ring rather than bars, because the question here is what share of a
 * runner's races each length is, not how many of each there were in absolute
 * terms. The total sits in the middle, which is the number people look for
 * first.
 *
 * Everything is one SVG: the ring, the names and the lines that join them
 * (owner, 31.07.2026). It used to be a ring beside an HTML table, which meant
 * the name of a length and the slice it belonged to were two separate things
 * the reader had to match up by colour. Now each name is tied to the middle of
 * its own slice by a line, so there is nothing to match.
 *
 * Only the lengths this person has actually run are named. A row reading
 * "Ultramaraton 0" is not information, it is furniture, and on most profiles
 * three of the five rows were exactly that.
 *
 * No charting library: five numbers do not justify one, and the table below,
 * which only a screen reader reads, is what makes the drawing readable without
 * eyes.
 */

/**
 * One colour per length, shortest to longest, named rather than written.
 *
 * The values are in `styles/tokens.css`, one set per theme, because they have to
 * be: the old ramp was written here and ran straight into the dark background,
 * where three of its five segments measured under 2:1 against the surface and
 * the whole ring read as one blue smudge. A component that picks its own colour
 * cannot know which theme it is in.
 *
 * Not the gold: gold means achievement on this portal and a chart is not an
 * achievement.
 */
const COLOURS: Record<RaceCategory, string> = {
  short: 'var(--chart-1)',
  long: 'var(--chart-2)',
  half: 'var(--chart-3)',
  marathon: 'var(--chart-4)',
  ultra: 'var(--chart-5)',
}

export function CategoryDonut({
  counts,
  caption,
}: {
  counts: Map<RaceCategory, number>
  caption: string
}) {
  const { locale, t } = useI18n()
  const total = CATEGORIES.reduce((sum, one) => sum + (counts.get(one) ?? 0), 0)

  let offset = 0
  const slices: Slice[] = []

  for (const one of CATEGORIES) {
    const value = counts.get(one) ?? 0
    const share = total === 0 ? 0 : value / total

    // Only what was actually run gets a slice, a name and a line.
    if (value > 0) {
      slices.push({ one, value, share, offset })
    }

    offset += share
  }

  const callouts = placeCallouts(slices)

  return (
    <div className="donut-block">
      {/* Hidden from the reading altogether, because everything in it is in the
          table below, word for word. Chrome does not treat the children of an
          `img` as presentational the way the specification says it may, so with
          a name on the drawing a screen reader read every length twice: once off
          the picture and once off the table. The table carries the caption this
          used to be named by. */}
      <svg className="donut" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        {/* The whole ring when nothing has been run, and the gap behind the
            slices otherwise. */}
        <circle className="donut__track" cx={CX} cy={CY} r={RADIUS} strokeWidth={BAND} />

        <g className="donut__ring">
          {callouts.map((slice) => (
            <circle
              key={slice.one}
              className="donut__seg"
              cx={CX}
              cy={CY}
              r={RADIUS}
              strokeWidth={BAND}
              stroke={COLOURS[slice.one]}
              strokeDasharray={`${slice.share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={-slice.offset * CIRCUMFERENCE}
            />
          ))}
        </g>

        <text className="donut__total" x={CX} y={CY + 4} textAnchor="middle">
          {formatNumber(total, locale)}
        </text>
        {/* The word declines with the number, the way it does on the front page:
            1 trka, 3 trke, 5 trka. The count is handed in for the rules to read
            and never printed, because the number is already above it. */}
        <text className="donut__unit" x={CX} y={CY + 22} textAnchor="middle">
          {t('profile.racesWord', { count: total })}
        </text>

        {callouts.map((slice) => (
          <g key={slice.one}>
            {/* The line is drawn twice: once thick in the colour of the card
                behind it, then thin on top. The halo is what keeps it visible
                where it lands, now that the lightest segment of the dark theme
                is very nearly white and a white line on it measured 1,20:1. */}
            <polyline className="donut__leader-halo" points={leaderPoints(slice)} />
            <polyline className="donut__leader" points={leaderPoints(slice)} />
            <text
              className="donut__name"
              x={slice.nameX}
              y={slice.bendY + 4}
              textAnchor={slice.right ? 'start' : 'end'}
            >
              {slice.right ? (
                <>
                  {t(`category.${slice.one}`)}
                  <tspan className="donut__value"> {formatNumber(slice.value, locale)}</tspan>
                </>
              ) : (
                <>
                  <tspan className="donut__value">{formatNumber(slice.value, locale)} </tspan>
                  {t(`category.${slice.one}`)}
                </>
              )}
            </text>
          </g>
        ))}
      </svg>

      {/* The same numbers as a table, for anyone who cannot see the drawing. The
          shares are here and not on screen: on the ring the share is the size of
          the slice, which is the whole reason it is a ring.

          Everything the drawing says has to be here, the total included. It was
          not, for one commit: hiding the drawing took the number in the middle
          of the ring with it, and the widget beside it had stopped counting
          races in the same change, so the one number this whole card is about
          was on screen and nowhere else. */}
      <table className="visually-hidden">
        <caption>{caption}</caption>
        <tbody>
          {callouts.map((slice) => (
            <tr key={slice.one}>
              <th scope="row">{t(`category.${slice.one}`)}</th>
              <td>{formatNumber(slice.value, locale)}</td>
              <td>{formatNumber(slice.share * 100, locale)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t('profile.totals')}</th>
            <td colSpan={2}>
              {formatNumber(total, locale)} {t('profile.racesWord', { count: total })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
