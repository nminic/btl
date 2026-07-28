import { useState } from 'react'
import { racesByCategory } from '../../data/derive'
import type { RaceCategory, Result } from '../../data/types'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'

const CATEGORIES: RaceCategory[] = ['short', 'long', 'half', 'marathon', 'ultra']

/* The bar chart from the old portal, which rotated through the five length
 * categories on every page load. It still rotates, but the arrows mean nobody
 * has to reload the page to see the next one.
 *
 * Drawn as bars rather than with a charting library: five numbers do not
 * justify a dependency, and a table underneath makes it readable to a screen
 * reader, which no canvas would be.
 */
export function CategoryChart({ results, season }: { results: Result[]; season: number }) {
  const { locale, t } = useI18n()
  const [shown, setShown] = useState(0)
  const counts = racesByCategory(results, season)
  const category = CATEGORIES[shown]
  const highest = Math.max(1, ...CATEGORIES.map((one) => counts.get(one) ?? 0))

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

      <table className="chart">
        <caption className="visually-hidden">{t('home.byCategory')}</caption>
        <tbody>
          {CATEGORIES.map((one) => {
            const value = counts.get(one) ?? 0

            return (
              <tr key={one} className={one === category ? 'chart__row chart__row--on' : 'chart__row'}>
                <th scope="row">{t(`category.${one}`)}</th>
                <td>
                  <span className="chart__fill" style={{ inlineSize: `${(value / highest) * 100}%` }} />
                </td>
                <td className="chart__value">{formatNumber(value, locale)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
