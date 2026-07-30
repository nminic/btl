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
 * this season. It carries no heading and no arrows; it simply turns, one
 * category after another, round and round.
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

  useEffect(() => {
    const turn = setInterval(() => {
      setShown((current) => (current + 1) % CATEGORIES.length)
    }, turnMs)

    return () => clearInterval(turn)
  }, [turnMs])

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

      <p className="top-cat__caption">{t(`home.mostOf.${category}`)}</p>
    </section>
  )
}
