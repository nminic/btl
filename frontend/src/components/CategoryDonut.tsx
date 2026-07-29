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
 * Drawn as one SVG circle per segment using stroke-dasharray. No charting
 * library: five numbers do not justify one, and the table in the legend is what
 * makes it readable to a screen reader.
 */

const RADIUS = 60
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** One colour per length, from short to long. Not the gold: gold means
 *  achievement on this portal and a chart is not an achievement. */
const COLOURS: Record<RaceCategory, string> = {
  short: '#5b93ec',
  long: '#1657bd',
  half: '#10459a',
  marathon: '#0b3372',
  ultra: '#06214a',
}

export function CategoryDonut({
  counts,
  caption,
}: {
  counts: Map<RaceCategory, number>
  caption: string
}) {
  const { locale, t } = useI18n()
  const [active, setActive] = useState<RaceCategory | null>(null)
  const total = CATEGORIES.reduce((sum, one) => sum + (counts.get(one) ?? 0), 0)

  let offset = 0
  const segments = CATEGORIES.map((one) => {
    const value = counts.get(one) ?? 0
    const share = total === 0 ? 0 : value / total
    const segment = { one, value, share, offset }

    offset += share

    return segment
  })

  return (
    <div className="donut-block">
      <div className="donut-wrap">
        <svg className="donut" viewBox="0 0 160 160" aria-hidden="true">
          <circle className="donut__track" cx="80" cy="80" r={RADIUS} />
          {segments.map((segment) => (
            <circle
              key={segment.one}
              className={
                active === null || active === segment.one
                  ? 'donut__seg'
                  : 'donut__seg donut__seg--dim'
              }
              cx="80"
              cy="80"
              r={RADIUS}
              stroke={COLOURS[segment.one]}
              strokeDasharray={`${segment.share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={-segment.offset * CIRCUMFERENCE}
            />
          ))}
        </svg>
        <div className="donut__center">
          <strong>{formatNumber(total, locale)}</strong>
          <span>{t('profile.racesTotal')}</span>
        </div>
      </div>

      <table className="donut__legend">
        <caption className="visually-hidden">{caption}</caption>
        <tbody>
          {segments.map((segment) => (
            <tr
              key={segment.one}
              onMouseEnter={() => setActive(segment.one)}
              onMouseLeave={() => setActive(null)}
            >
              <th scope="row">
                <span className="donut__dot" style={{ background: COLOURS[segment.one] }} />
                {t(`category.${segment.one}`)}
              </th>
              <td>{formatNumber(segment.value, locale)}</td>
              <td className="donut__share">{formatNumber(segment.share * 100, locale)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
