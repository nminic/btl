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
  const { locale, t } = useI18n()
  const [shown, setShown] = useState(0)
  const [turning, setTurning] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (!turning) {
      return
    }

    const turn = setInterval(() => {
      setShown((current) => (current + 1) % CATEGORIES.length)
    }, turnMs)

    return () => clearInterval(turn)
  }, [turnMs, turning])

  const category = CATEGORIES[shown]
  const columns = topByCategory(competitors, results, season, category, TOP)
  const highest = Math.max(1, ...columns.map((one) => one.races))

  return (
    <section className="top-cat" aria-label={t('home.turning')}>
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

      <p className="top-cat__caption">
        {t(`home.mostOf.${category}`)}
        {/* Beside the caption rather than above the bars, because it belongs to
            the turning and not to any one category. */}
        {/* The name says the whole state, and there is no `aria-pressed`
            beside it. Together they contradicted each other: stopped, the
            button read "Nastavi smenjivanje" and announced itself as pressed,
            which is heard as "resuming is on", the opposite of what is true.
            A button that renames itself is what the guidance for SC 2.2.2
            means by a pause control. */}
        <button
          type="button"
          className="top-cat__turn"
          onClick={() => setTurning((on) => !on)}
        >
          {turning ? t('home.pauseTurning') : t('home.resumeTurning')}
        </button>
      </p>
    </section>
  )
}
