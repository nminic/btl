import { CATEGORIES } from '../../data/derive'
import { useI18n } from '../../i18n/useI18n'
/* For the five colours of `.length-dot`, which live in the table sheet because
   the results table draws them too (styles/table.css). Asked for here rather
   than left to the screen: this component draws nothing else. */
import '../../styles/table.css'

/**
 * What the colours on the chips mean, in one line under the grid (owner,
 * 31.07.2026).
 *
 * Under it rather than over it: somebody who wants the calendar wants the
 * calendar, and the legend is what they look for once they have noticed the
 * colours and not before. It is a list, so a screen reader can count it and
 * leave it.
 *
 * The front page carries the same dots and no legend, which is deliberate: six
 * rows of events do not teach a colour code, and the calendar is where somebody
 * learns it.
 */
export function LengthLegend() {
  const { t } = useI18n()

  return (
    <div className="legend">
      <span className="legend__title" id="legend-title">
        {t('calendar.legend')}
      </span>
      {/* Named by the words beside it, so a screen reader meets the list already
          knowing what it is a list of rather than after five colours. */}
      <ul className="legend__items" aria-labelledby="legend-title">
        {CATEGORIES.map((one) => (
          <li key={one} className="legend__item">
            <span className={`length-dot length-dot--${one}`} aria-hidden="true" />
            {t(`category.${one}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
