import { DOTS, EVENT_KINDS } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
/* For the five colours of `.length-dot`, which live in the table sheet because
   the results table draws them too (styles/table.css). Asked for here rather
   than left to the screen, since this file has no sheet of its own to ask
   through (ADL A7). The `.legend` names beside them are in Calendar.css and
   still arrive borrowed, which is the same fault one sheet over and is written
   down as open rather than fixed here. */
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
        {/* The three kinds of event first, because that is what the whole tile is
            coloured by, and the lengths are the dots on it. Owner, 23.08.2026:
            „Za Skup i Trening koristi druge boje i objasni ih u legendi." All
            three and not only the two that are new: a reader learns a code by
            seeing it whole, and the colour of a race was never named either. */}
        {EVENT_KINDS.map((one) => (
          <li key={one} className="legend__item">
            <span
              className={one === 'race' ? 'legend__tile' : `legend__tile legend__tile--${one}`}
              aria-hidden="true"
            />
            {t(`event.kind.${one}`)}
          </li>
        ))}
        {DOTS.map((one) => (
          <li key={one} className="legend__item">
            <span className={`length-dot length-dot--${one}`} aria-hidden="true" />
            {t(`category.${one}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
