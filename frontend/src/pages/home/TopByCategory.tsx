import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CATEGORIES, topByCategory } from '../../data/derive'
import type { Competitor, Result } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import './TopByCategory.css'

/** How long one category stays up before the next one comes round. */
const TURN_MS = 6000

const TOP = 10

/* Initials in a circle, because there are no photographs yet. The old portal
 * put faces above the columns and that is what made the widget worth looking
 * at; a monogram holds the place until the photographs exist. */
function Face({ competitor }: { competitor: Competitor }) {
  return (
    <span className="top-cat__face" aria-hidden="true">
      {competitor.firstName.slice(0, 1)}
      {competitor.lastName.slice(0, 1)}
    </span>
  )
}

/** Whether the visitor has asked their system for less movement. */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* Two bars and a triangle, drawn rather than typed: the media characters render
 * as anything from a glyph to an emoji to a blank box depending on the machine,
 * and this one has to read as a control at 28 pixels. */
function PauseGlyph() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <rect x="2" y="1.5" width="3" height="9" fill="currentColor" />
      <rect x="7" y="1.5" width="3" height="9" fill="currentColor" />
    </svg>
  )
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M3 1.5 L10.5 6 L3 10.5 Z" fill="currentColor" />
    </svg>
  )
}

/* The bar chart from the old portal: who has run the most races of one length
 * this season. It carries no heading and no arrows; it simply turns, one
 * category after another, round and round.
 *
 * The one control on it stops the turning. Anything that starts moving by
 * itself, keeps it up for more than five seconds and sits beside other content
 * has to be stoppable (WCAG 2.2.2, and ADL A7 sets WCAG 2.2 AA as the floor).
 * Arrows are still deliberately absent: the fault was that the movement could
 * not be stopped, not that it could not be steered.
 *
 * The turning is a timer rather than an animation, so the reduced motion block
 * in index.css cannot reach it and the preference is read here by hand. Anyone
 * who asked for less movement gets the widget standing still, with the control
 * offering to start it.
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
  const { locale, t } = useI18n()
  const [shown, setShown] = useState(0)
  const [running, setRunning] = useState(() => !prefersReducedMotion())

  useEffect(() => {
    if (!running) {
      return
    }

    const turn = setInterval(() => {
      setShown((current) => (current + 1) % CATEGORIES.length)
    }, turnMs)

    return () => clearInterval(turn)
  }, [running, turnMs])

  const category = CATEGORIES[shown]
  const columns = topByCategory(competitors, results, season, category, TOP)
  const highest = Math.max(1, ...columns.map((one) => one.races))

  return (
    <section className="top-cat" aria-live="off">
      {columns.length === 0 ? (
        <p className="card__empty">{t('home.noneYet')}</p>
      ) : (
        <ol className="top-cat__columns">
          {columns.map((column) => (
            <li key={column.competitor.memberNumber} className="top-cat__column">
              <Face competitor={column.competitor} />
              <Link
                className="top-cat__bar"
                style={{ blockSize: `${(column.races / highest) * 100}%` }}
                to={`/${locale}/takmicar/${column.competitor.memberNumber}`}
                title={`${column.competitor.firstName} ${column.competitor.lastName}`}
              >
                <span className="top-cat__count">{column.races}</span>
                <span className="visually-hidden">
                  {column.competitor.firstName} {column.competitor.lastName}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <div className="top-cat__foot">
        <p className="top-cat__caption">{t(`home.mostOf.${category}`)}</p>

        {/* The name says what the press will do, the way the navigation toggle
            in the header does, rather than naming a state the visitor then has
            to work out the opposite of. */}
        <button
          type="button"
          className="top-cat__pause"
          onClick={() => setRunning((was) => !was)}
        >
          {running ? <PauseGlyph /> : <PlayGlyph />}
          <span className="visually-hidden">
            {t(running ? 'home.pauseCategories' : 'home.resumeCategories')}
          </span>
        </button>
      </div>
    </section>
  )
}
