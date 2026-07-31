import { useState } from 'react'
import { CATEGORIES } from '../data/derive'
import type { RaceCategory } from '../data/types'
import { formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './CategoryDonut.css'

/* A ring rather than bars, because the question here is what share of a
 * runner's races each length is, not how many of each there were in absolute
 * terms. The total sits in the middle, which is the number people look for
 * first.
 *
 * The ring and nothing else (owner, 31.07.2026). It carried a name beside every
 * slice with a line running to it, and before that a legend; both are gone. What
 * a slice is, is answered by pointing at it, and the same five colours stand
 * beside the distances in the table below, so the two read as one thing.
 *
 * No charting library: five numbers do not justify one, and the table below,
 * which only a screen reader reads, is what makes the drawing readable without
 * eyes.
 */

/** The drawing, in its own units. Square, because the ring is all there is. */
const SIDE = 200
const CENTRE = SIDE / 2
/** Radius of the middle of the band. */
const RADIUS = 74
const BAND = 34
/** How much wider the slice being pointed at gets. It grows on both edges, so
 *  the ring keeps its middle and the figures in it do not move. */
const GROWTH = 10

const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** One colour per length, named rather than written: the values are per theme
 *  and live in styles/tokens.css. */
const COLOURS: Record<RaceCategory, string> = {
  short: 'var(--length-short)',
  half: 'var(--length-half)',
  long: 'var(--length-long)',
  marathon: 'var(--length-marathon)',
  ultra: 'var(--length-ultra)',
}

export function CategoryDonut({
  counts,
  caption,
}: {
  counts: Map<RaceCategory, number>
  caption: string
}) {
  const { locale, t } = useI18n()
  const [pointed, setPointed] = useState<RaceCategory | null>(null)
  const total = CATEGORIES.reduce((sum, one) => sum + (counts.get(one) ?? 0), 0)

  let offset = 0
  const slices: { one: RaceCategory; value: number; share: number; offset: number }[] = []

  for (const one of CATEGORIES) {
    const value = counts.get(one) ?? 0
    const share = total === 0 ? 0 : value / total

    // Only what was actually run gets a slice.
    if (value > 0) {
      slices.push({ one, value, share, offset })
    }

    offset += share
  }

  return (
    <div className="donut-block">
      <svg className="donut" viewBox={`0 0 ${SIDE} ${SIDE}`} aria-hidden="true">
        {/* The whole ring when nothing has been run, and the gap behind the
            slices otherwise. */}
        <circle className="donut__track" cx={CENTRE} cy={CENTRE} r={RADIUS} strokeWidth={BAND} />

        <g className="donut__ring">
          {slices.map((slice) => (
            <circle
              key={slice.one}
              className="donut__seg"
              cx={CENTRE}
              cy={CENTRE}
              r={RADIUS}
              strokeWidth={pointed === slice.one ? BAND + GROWTH : BAND}
              stroke={COLOURS[slice.one]}
              strokeDasharray={`${slice.share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={-slice.offset * CIRCUMFERENCE}
              onMouseEnter={() => setPointed(slice.one)}
              onMouseLeave={() => setPointed(null)}
            >
              {/* The browser's own tooltip, which is also what a screen reader
                  reads off a shape. One element, both jobs. */}
              <title>
                {t(`category.${slice.one}`)}: {formatNumber(slice.value, locale)}
              </title>
            </circle>
          ))}
        </g>

        <text className="donut__total" x={CENTRE} y={CENTRE + 6} textAnchor="middle">
          {formatNumber(total, locale)}
        </text>
        {/* The word declines with the number, the way it does on the front page:
            1 trka, 3 trke, 5 trka. The count is handed in for the rules to read
            and never printed, because the number is already above it. */}
        <text className="donut__unit" x={CENTRE} y={CENTRE + 28} textAnchor="middle">
          {t('profile.racesWord', { count: total })}
        </text>
      </svg>

      {/* The same numbers as a table, for anyone who cannot see the drawing.
          Everything the ring says has to be here, the total included: hiding the
          drawing once took the number in its middle with it. */}
      <table className="visually-hidden">
        <caption>{caption}</caption>
        <tbody>
          {slices.map((slice) => (
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
