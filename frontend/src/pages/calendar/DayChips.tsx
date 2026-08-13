import { Link } from 'react-router'
import { categoriesAt } from '../../data/derive'
import type { BtlEvent, Race } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
/* For the five colours of `.length-dot`, which live in the table sheet because
   the results table draws them too (styles/table.css). Asked for here rather
   than left to the screen: this component draws nothing else. */
import '../../styles/table.css'

/**
 * One event in the grid: the name and the lengths it holds, on one line (owner,
 * 31.07.2026).
 *
 * The chip used to carry the town and a count of races under the name, over as
 * many lines as it took. In a cell one seventh of the page wide that is three
 * lines for one event, so a day with four of them was taller than the week
 * around it. The lengths say more than the count did anyway: five races all of
 * them half marathons is one green dot, and somebody scanning for a marathon
 * finds it without opening anything.
 *
 * The dots are the same five colours the ring and the results table use, one per
 * length actually run there. Their names travel with them, because a colour on
 * its own says nothing to anybody who cannot separate two of them.
 */
export function EventChip({ event, races }: { event: BtlEvent; races: Race[] }) {
  const { locale, t } = useI18n()
  const lengths = categoriesAt(event, races)

  return (
    <Link className="chip" to={`/${locale}/kalendar/${event.slug}`} title={event.name}>
      <span className="chip__name">{event.name}</span>
      <span className="chip__lengths">
        {lengths.map((one) => (
          <span key={one} className={`length-dot length-dot--${one}`} aria-hidden="true" />
        ))}
        <span className="visually-hidden">
          {lengths.map((one) => t(`category.${one}`)).join(', ')}
        </span>
      </span>
    </Link>
  )
}
