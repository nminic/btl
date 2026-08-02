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
 * Pointing at it has to work on a telephone too, where there is no hover: a
 * touch chooses a slice as a mouse does, and the answer is written in the middle
 * of the ring rather than in a tooltip, because a tooltip is a thing a finger
 * cannot open. Without that the ring on a telephone was five unnamed colours,
 * which is WCAG 2.2 SC 1.4.1 with nothing else carrying the meaning.
 *
 * No charting library: five numbers do not justify one, and the table below,
 * which only a screen reader reads, is what makes the drawing readable without
 * eyes.
 */

/** The drawing, in its own units. Square, because the ring is all there is. */
const SIDE = 200
const CENTRE = SIDE / 2
/** Radius of the middle of the band. */
const RADIUS = 70
const BAND = 30
/**
 * How much the slice being pointed at grows, and it grows outwards only (owner,
 * 31.07.2026).
 *
 * It used to grow on both edges, half in and half out, which kept the ring's
 * middle still but ate into the room the figures stand in and made the growth
 * itself half as visible. Outwards it is one clear movement, and the hole in the
 * middle never changes size. The band and the radius came down to make room for
 * it: the outer edge of a grown slice reaches 97 of the 100 there are.
 */
const GROWTH = 12

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

  const chosen = slices.find((slice) => slice.one === pointed)

  return (
    <div className="donut-block">
      <svg className="donut" viewBox={`0 0 ${SIDE} ${SIDE}`} aria-hidden="true">
        {/* The whole ring when nothing has been run, and the gap behind the
            slices otherwise. */}
        <circle className="donut__track" cx={CENTRE} cy={CENTRE} r={RADIUS} strokeWidth={BAND} />

        <g className="donut__ring">
          {slices.map((slice) => {
            /* Growing outwards means a wider band on a longer radius, so the
               arc has to be measured on its own circle: the same share of a
               bigger circle is a longer arc, and a slice drawn to the old
               measure would slide round as it grew. */
            const grown = pointed === slice.one
            const radius = grown ? RADIUS + GROWTH / 2 : RADIUS
            const round = 2 * Math.PI * radius

            return (
              <circle
                key={slice.one}
                className="donut__seg"
                cx={CENTRE}
                cy={CENTRE}
                r={radius}
                strokeWidth={grown ? BAND + GROWTH : BAND}
                stroke={COLOURS[slice.one]}
                strokeDasharray={`${slice.share * round} ${round}`}
                strokeDashoffset={-slice.offset * round}
              >
                {/* The browser's own tooltip, which is also what a screen reader
                    reads off a shape. One element, both jobs. */}
                <title>
                  {t(`category.${slice.one}`)}: {formatNumber(slice.value, locale)}
                </title>
              </circle>
            )
          })}
        </g>

        {/* What the pointer actually touches: the same slices at the size they
            are when nothing is chosen, drawn over the top and never seen (owner,
            01.08.2026).

            The drawing above used to catch the pointer itself, and a slice that
            grows moves its own edge. On the line between two slices that made
            the ring flicker: the pointer chose the second slice, the second
            slice grew over the line, the pointer was now inside the second
            slice's grown body but the first slice's grown body had already
            taken the ground back, and the two swapped for as long as the mouse
            stood still. The hit area cannot be allowed to move, so it is a layer
            of its own that never does. */}
        <g className="donut__hits">
          {slices.map((slice) => {
            const round = 2 * Math.PI * RADIUS

            return (
              <circle
                key={slice.one}
                className="donut__hit"
                cx={CENTRE}
                cy={CENTRE}
                r={RADIUS}
                strokeWidth={BAND}
                strokeDasharray={`${slice.share * round} ${round}`}
                strokeDashoffset={-slice.offset * round}
                /* Pointer rather than mouse, so a finger and a stylus choose a
                   slice the same way. The choice sticks until another slice is
                   chosen or the ring is left, which is what a touch needs and
                   what a mouse gets anyway. */
                onPointerEnter={() => setPointed(slice.one)}
                onPointerDown={() => setPointed(slice.one)}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') {
                    setPointed(null)
                  }
                }}
              />
            )
          })}
        </g>

        <text className="donut__total" x={CENTRE} y={CENTRE + 6} textAnchor="middle">
          {formatNumber(chosen === undefined ? total : chosen.value, locale)}
        </text>
        {/* Whose number it is. Left alone that is the word for races, declined
            with the count the way it is on the front page: 1 trka, 3 trke, 5
            trka. While a slice is chosen it is the name of that length, which is
            the only way somebody on a telephone can find out. */}
        <text className="donut__unit" x={CENTRE} y={CENTRE + 28} textAnchor="middle">
          {chosen === undefined
            ? t('profile.racesWord', { count: total })
            : t(`profile.categoryWord.${chosen.one}`, { count: chosen.value })}
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
