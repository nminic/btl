import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { topByCategory } from '../../data/derive'
import type { Competitor, RaceCategory, Result } from '../../data/types'
import type { CSSProperties } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { FIRST, NEXT } from './rotation'
import { Portrait } from './Portrait'
import './TopByCategory.css'

/** How long one category stays up before the next one comes round. */
const TURN_MS = 6000

const TOP = 10

/* Two bars and a triangle: the marks every player in the world uses, so the
 * button says what it does without a word on it (owner, 31.07.2026). The name
 * is still there for anyone who cannot see them, in `aria-label`. */
function PauseMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
    </svg>
  )
}

function PlayMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M8.5 5.4l10 6.6-10 6.6z" />
    </svg>
  )
}

/**
 * One column of the chart: a bar as tall as the share of races it stands for,
 * carrying the number and, out of sight, the name it belongs to.
 *
 * A link while there is a profile to link to, and a plain block otherwise, the
 * same rule the tables keep: a member whose fee has run out is hidden as though
 * they did not exist (PDL P11), so a link to them is a door onto a wall.
 */
function Bar({
  column,
  highest,
  category,
  season,
}: {
  column: { competitor: Competitor; races: number }
  highest: number
  /* What the chart is showing, carried through to the profile so it opens on the
     same thing that was pressed (owner, 01.08.2026). A bar under "Najviše
     polumaratona" led to the whole of somebody's running life, and the reader
     had to find the half marathons again by hand. */
  category: RaceCategory
  season: number
}) {
  const { locale } = useI18n()
  const name = `${column.competitor.firstName} ${column.competitor.lastName}`
  const inside = (
    <>
      {/* The face, the bar and the name all stand in the track, because all
          three are placed from the bar's own height: the face rides on top of
          it and the name is across the middle of the face. */}
      <span className="top-cat__track">
        <Portrait competitor={column.competitor} />
        <span className="top-cat__bar">
          <span className="top-cat__count">{column.races}</span>
        {/* Seen on hover and on focus, read out always.
         *
         * Inside the bar, which is what it is measured from. The face rides on
         * top of the bar, so where the face is depends on how tall the bar came
         * out; the name used to be placed at a fixed distance from the top of
         * the column, which is right for the tallest column and for no other,
         * and on the shorter ones it hung as much as a hundred and fifty pixels
         * above the face it names (owner, 03.08.2026).
         *
         * The asked-for height cannot answer that either, because the bar does
         * not always get it: the tallest bar asks for the whole column and then
         * gives room back to the face above it, so the number in the style and
         * the number on the screen are fifty pixels apart. Only the bar knows
         * how tall the bar ended up, and inside it `100%` is that. */}
          <span className="top-cat__who">{name}</span>
        </span>
      </span>
    </>
  )

  /** How tall this bar asks to be. */
  const height = { '--bar': `${(column.races / highest) * 100}%` } as CSSProperties

  if (!column.competitor.active) {
    return (
      <span className="top-cat__link" style={height} title={name}>
        {inside}
      </span>
    )
  }

  return (
    <Link
      className="top-cat__link"
      style={height}
      title={name}
      /* The season is written out even though the chart is of the running one:
         a profile opens on all of them by default (owner, 31.07.2026), so
         leaving it out would widen the very thing the bar was showing. */
      to={`/${locale}/takmicar/${column.competitor.memberNumber}?sezona=${season}&duzina=${category}`}
    >
      {inside}
    </Link>
  )
}

/* The bar chart from the old portal: who has run the most races of one length
 * this season, one category after another, round and round.
 *
 * It turned forever with nothing to stop it, which WCAG 2.2 SC 2.2.2 does not
 * allow: anything that moves by itself for more than five seconds beside other
 * content has to be stoppable. There is a button now, and anyone who has asked
 * their system for less motion gets it stopped to begin with, the same rule the
 * counters in this folder already follow.
 *
 * The section is named as well. It had `aria-live="off"`, which is the default
 * and does nothing, and no heading, so a screen reader met a region with no name
 * whose contents changed under it.
 */
export function TopByCategory({
  competitors,
  results,
  season,
  turnMs = TURN_MS,
}: {
  competitors: Competitor[]
  results: Result[]
  season: number
  /** Only a test shortens this; nothing in the application passes it. */
  turnMs?: number
}) {
  const { t } = useI18n()
  const [category, setCategory] = useState<RaceCategory>(FIRST)
  const [turning, setTurning] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (!turning) {
      return
    }

    const turn = setInterval(() => {
      setCategory((current) => NEXT[current])
    }, turnMs)

    return () => clearInterval(turn)
  }, [turnMs, turning])

  const columns = topByCategory(competitors, results, season, category, TOP)
  const highest = Math.max(1, ...columns.map((one) => one.races))

  const name = turning ? t('home.pauseTurning') : t('home.resumeTurning')

  return (
    <section className="top-cat" aria-label={t('home.turning')}>
      {/* A discreet gold disc in the corner rather than a labelled pill on the
          band below (owner, 31.07.2026). The name it carried is now the
          accessible name; an icon is not a name. It is the name and nothing
          else: a hidden label and a tooltip carrying the same words are read
          out one after the other.

          There is no `aria-pressed` beside it, and there was none before: the
          name says the whole state, and the two together contradicted each
          other. Stopped, the button read "Nastavi smenjivanje" and announced
          itself as pressed, which is heard as "resuming is on", the opposite of
          what is true. A button that renames itself is what the guidance for
          WCAG 2.2 SC 2.2.2 means by a pause control. */}
      <button
        type="button"
        className="top-cat__turn"
        aria-label={name}
        onClick={() => setTurning((on) => !on)}
      >
        {turning ? <PauseMark /> : <PlayMark />}
      </button>

      {columns.length === 0 ? (
        <p className="card__empty">{t('home.noneYet')}</p>
      ) : (
        <ol className="top-cat__columns">
          {columns.map((column) => (
            <li key={column.competitor.memberNumber} className="top-cat__column">
              <Bar column={column} highest={highest} category={category} season={season} />
            </li>
          ))}
        </ol>
      )}

      <p className="top-cat__caption">{t(`home.mostOf.${category}`)}</p>
    </section>
  )
}
