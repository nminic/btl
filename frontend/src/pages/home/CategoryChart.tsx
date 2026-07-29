import { useState } from 'react'
import { CategoryBars } from '../../components/CategoryBars'
import { CATEGORIES, racesByCategory } from '../../data/derive'
import type { Result } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'

/* The bar chart from the old portal, which rotated through the five length
 * categories on every page load. It still rotates, but the arrows mean nobody
 * has to reload the page to see the next one.
 *
 * Drawn as bars rather than with a charting library: five numbers do not
 * justify a dependency, and a table underneath makes it readable to a screen
 * reader, which no canvas would be.
 */
export function CategoryChart({ results, season }: { results: Result[]; season: number }) {
  const { t } = useI18n()
  const [shown, setShown] = useState(0)
  const counts = racesByCategory(results, season)
  const category = CATEGORIES[shown]

  const step = (by: number) => setShown((current) => (current + by + CATEGORIES.length) % CATEGORIES.length)

  return (
    <section className="card" aria-labelledby="chart-heading">
      <div className="chart__bar-row">
        <h2 className="card__title" id="chart-heading">
          {t('home.byCategory')}
        </h2>
        <div className="chart__arrows">
          <button type="button" onClick={() => step(-1)} aria-label={t('home.previousCategory')}>
            {'\u2039'}
          </button>
          <button type="button" onClick={() => step(1)} aria-label={t('home.nextCategory')}>
            {'\u203a'}
          </button>
        </div>
      </div>

      <p className="chart__current">{t(`category.${category}`)}</p>

      <CategoryBars counts={counts} caption={t('home.byCategory')} highlight={category} />

    </section>
  )
}
