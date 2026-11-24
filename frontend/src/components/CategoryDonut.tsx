import { useEffect, useRef, useState } from 'react'
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
 *
 * THE RING WORKS QUIETLY AND WITHOUT CHOPPING (owner, 21.11.2026, PDL „Prsten radi suptilno i bez
 * seckanja"): the slices are true sectors of a ring, the chosen one lifts outwards for about 180 ms
 * with a soft slowing, the others fade a little, colours are nowhere mixed, and the number in the
 * middle fades over to the next. A touch in the middle, on the same slice again, or outside the ring,
 * and Esc, take it back to „all races". No movement for those who ask for less of it.
 */

/** The drawing, in its own units. Square, because the ring is all there is. */
const SIDE = 200
const CENTRE = SIDE / 2
/** The hole in the middle: one number for every slice at every moment, and nothing here ever moves it. */
const INNER = 55
/** Where a slice ends when nothing is chosen. */
const OUTER = 85
/**
 * How much the slice being pointed at grows, and it grows outwards only (owner, 31.07.2026): the outer
 * edge of a grown slice reaches 97 of the 100 there are.
 */
const GROWTH = 12
/** The whole of the movement, in milliseconds (owner, 21.11.2026: about 150 to 200). */
const DURATION = 180

/** The sixth slice (PDL, 14.11.2026, „Ostale discipline kao lična evidencija"): races the league does
 *  not score, which the profile draws in the ring and keeps out of every figure beside it. */
const UNSCORED = 'unscored'

/** What a slice can be: one of the five lengths, or the races the league does not score. */
type SliceKind = RaceCategory | typeof UNSCORED

/** The five lengths and then the unscored ones, in the order the ring goes round. */
const KINDS: SliceKind[] = [...CATEGORIES, UNSCORED]

/** One colour per length, named rather than written: the values live in styles/tokens.css. The
 *  unscored ones take the muted text colour, which the palette already defines and which holds 3:1
 *  against the card (WCAG 2.2 SC 1.4.11), so
 *  the ring adds no colour to a palette of five hues somebody may not be able to tell apart. */
const COLOURS: Record<SliceKind, string> = {
  short: 'var(--length-short)',
  half: 'var(--length-half)',
  long: 'var(--length-long)',
  marathon: 'var(--length-marathon)',
  ultra: 'var(--length-ultra)',
  unscored: 'var(--text-muted)',
}

/**
 * A TRUE SECTOR OF THE RING, NOT A DASHED CIRCLE.
 *
 * The slices used to be circles with a dash, and the chosen one grew by animating `r` and `stroke-width`
 * together. While the radius moves, the circumference moves with it and the dash does not, so for the
 * length of the movement every slice was a little too short or too long and the colour of its neighbour
 * showed through at the joins. A sector has both its angles written into the path and only its outer
 * radius moves: the joins are straight lines through the centre, so no frame can overlap a neighbour or
 * leave a gap, and the inner edge is the same `INNER` in every frame.
 *
 * The movement is a number animated here (`useGrowth`), not `transform: scale` (which would move the
 * inner edge too) and not the CSS `d` property (which two of the three engines cannot animate).
 */
function sector(from: number, share: number, outer: number): string {
  const point = (radius: number, angle: number) =>
    `${(CENTRE + radius * Math.cos(angle)).toFixed(3)} ${(CENTRE + radius * Math.sin(angle)).toFixed(3)}`

  if (share >= 1) {
    // A whole ring has no joins: two half circles each way, and the fill rule leaves the hole.
    return (
      `M ${point(outer, 0)} A ${outer} ${outer} 0 1 1 ${point(outer, Math.PI)} ` +
      `A ${outer} ${outer} 0 1 1 ${point(outer, 0)} Z ` +
      `M ${point(INNER, 0)} A ${INNER} ${INNER} 0 1 0 ${point(INNER, Math.PI)} ` +
      `A ${INNER} ${INNER} 0 1 0 ${point(INNER, 0)} Z`
    )
  }

  const start = from * 2 * Math.PI
  const end = (from + share) * 2 * Math.PI
  const large = share > 0.5 ? 1 : 0

  return (
    `M ${point(outer, start)} A ${outer} ${outer} 0 ${large} 1 ${point(outer, end)} ` +
    `L ${point(INNER, end)} A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)} Z`
  )
}

/** Soft slowing at the end, with no overshoot. */
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)

type Levels = Partial<Record<SliceKind, number>>

/** Each slice's own progress, 0 resting to 1 grown, moving to where the chosen one asks over `DURATION`. */
function useGrowth(pointed: SliceKind | null): Levels {
  const [levels, setLevels] = useState<Levels>({})
  const current = useRef<Levels>(levels)

  useEffect(() => {
    const from = current.current
    const goal = (one: SliceKind) => (one === pointed ? 1 : 0)
    const settle = (next: Levels) => {
      current.current = next
      setLevels(next)
    }
    const arrive = () => settle(Object.fromEntries(KINDS.map((one) => [one, goal(one)])))

    // No movement for those who ask for less of it: it is simply there.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) {
      arrive()

      return
    }

    let begun: number | undefined
    let frame = 0
    const step = (now: number) => {
      begun ??= now
      const spent = Math.min(1, (now - begun) / DURATION)

      if (spent >= 1) {
        arrive()

        return
      }

      settle(
        Object.fromEntries(
          KINDS.map((one) => {
            const was = from[one] ?? 0

            return [one, was + (goal(one) - was) * spent]
          }),
        ),
      )
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)

    return () => cancelAnimationFrame(frame)
  }, [pointed])

  return levels
}

export function CategoryDonut({
  counts,
  caption,
  unscored = 0,
}: {
  counts: Map<RaceCategory, number>
  caption: string
  /** How many of the races were ones the league does not score. Asked for only by the profile; a team
   *  page draws the ring over scored results alone and passes nothing. */
  unscored?: number
}) {
  const { locale, t } = useI18n()
  const [pointed, setPointed] = useState<SliceKind | null>(null)
  const levels = useGrowth(pointed)
  const countOf = (one: SliceKind) => (one === UNSCORED ? unscored : (counts.get(one) ?? 0))
  const nameOf = (one: SliceKind) =>
    one === UNSCORED ? t('profile.unscoredFilter') : t(`category.${one}`)
  const total = KINDS.reduce((sum, one) => sum + countOf(one), 0)

  /* Back to „all races" (owner, 21.11.2026): a touch anywhere that is not a slice, which takes in the
     middle of the ring and everything outside it, and Esc. Listened to on the document because „outside
     the ring" is by definition not inside anything here. A slice lets its own touch through, because
     what a touch on a slice does is decided on the slice. */
  useEffect(() => {
    if (pointed === null) {
      return
    }

    const away = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest('.donut__hit') === null) {
        setPointed(null)
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPointed(null)
      }
    }

    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)

    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [pointed])

  let offset = 0
  const slices: { one: SliceKind; value: number; share: number; offset: number }[] = []

  for (const one of KINDS) {
    const value = countOf(one)
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
        {/* The whole ring when nothing has been run, and the gap behind the slices otherwise. The whole
            drawing is hidden from a reader (ADL A7, 31.07.2026): the table below is the one place the
            numbers are read, and a named drawing was read out in full and then again. */}
        <circle
          className="donut__track"
          cx={CENTRE}
          cy={CENTRE}
          r={(INNER + OUTER) / 2}
          strokeWidth={OUTER - INNER}
        />

        <g className="donut__ring">
          {slices.map((slice) => (
            <path
              key={slice.one}
              className={
                pointed !== null && pointed !== slice.one ? 'donut__seg donut__seg--dim' : 'donut__seg'
              }
              fill={COLOURS[slice.one]}
              d={sector(slice.offset, slice.share, OUTER + GROWTH * easeOut(levels[slice.one] ?? 0))}
            />
          ))}
        </g>

        {/* What the pointer actually touches: the slices at the size a chosen one reaches, drawn over
            the top and never seen (owner, 01.08.2026). A slice that grows moves its own edge, and on the
            line between two slices that made the ring flicker; the hit area cannot be allowed to move,
            so it is a layer of its own that never does. */}
        <g className="donut__hits">
          {slices.map((slice) => (
            <path
              key={slice.one}
              className="donut__hit"
              d={sector(slice.offset, slice.share, OUTER + GROWTH)}
              /* A mouse chooses by passing over, as it always did. A finger has no passing over: its
                 touch chooses, and the same touch again lets go (owner, 21.11.2026). A touch is skipped
                 here because it fires a `pointerenter` just before its `pointerdown`, which would make
                 every first touch look like a second. */
              onPointerEnter={(event) => {
                if (event.pointerType !== 'touch') {
                  setPointed(slice.one)
                }
              }}
              onPointerDown={(event) =>
                setPointed(event.pointerType !== 'mouse' && pointed === slice.one ? null : slice.one)
              }
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse') {
                  setPointed(null)
                }
              }}
            >
              {/* On the layer that reads the pointer, because that is the one the browser draws a
                  tooltip for. */}
              <title>
                {nameOf(slice.one)}: {formatNumber(slice.value, locale)}
              </title>
            </path>
          ))}
        </g>

        {/* Keyed by what is chosen, so a new choice is a new element and the stylesheet's fade runs
            again: the number and the word are crossfaded, not jumped. */}
        <text
          key={`total-${pointed ?? 'all'}`}
          className="donut__total"
          x={CENTRE}
          y={CENTRE + 6}
          textAnchor="middle"
        >
          {formatNumber(chosen === undefined ? total : chosen.value, locale)}
        </text>
        {/* Whose number it is. Left alone that is the word for races, declined
            with the count the way it is on the front page: 1 trka, 3 trke, 5
            trka. While a slice is chosen it is the name of that length, which is
            the only way somebody on a telephone can find out. */}
        <text
          key={`unit-${pointed ?? 'all'}`}
          className="donut__unit"
          x={CENTRE}
          y={CENTRE + 28}
          textAnchor="middle"
        >
          {chosen === undefined
            ? t('profile.racesWord', { count: total })
            : chosen.one === UNSCORED
              ? t('profile.unscoredRingWord', { count: chosen.value })
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
              <th scope="row">{nameOf(slice.one)}</th>
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
