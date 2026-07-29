import { CATEGORIES } from '../data/derive'
import type { RaceCategory } from '../data/types'
import { formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './CategoryBars.css'

/* Bars with a table under them rather than a charting library: five numbers do
 * not justify a dependency, and a canvas would be silent to a screen reader.
 *
 * All five lengths are always shown, including the ones nobody ran. An empty
 * category is information too: it says what kind of runner this is.
 */
export function CategoryBars({
  counts,
  caption,
  highlight,
}: {
  counts: Map<RaceCategory, number>
  caption: string
  highlight?: RaceCategory
}) {
  const { locale } = useI18n()
  const { t } = useI18n()
  const highest = Math.max(1, ...CATEGORIES.map((one) => counts.get(one) ?? 0))

  return (
    <table className="chart">
      <caption className="visually-hidden">{caption}</caption>
      <tbody>
        {CATEGORIES.map((one) => {
          const value = counts.get(one) ?? 0

          return (
            <tr key={one} className={one === highlight ? 'chart__row chart__row--on' : 'chart__row'}>
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
  )
}
