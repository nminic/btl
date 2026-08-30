import { Link } from 'react-router'
import { dotsAt } from '../../data/derive'
import type { BtlEvent, Race } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
/* For the five colours of `.length-dot`, which live in the table sheet because
   the results table draws them too (styles/table.css). Asked for here rather
   than left to the screen, since this file has no sheet of its own to ask
   through (ADL A7).

   That is the dots and not the chip. The rest of what this draws, `.chip` and
   the two names under it, is in Calendar.css and arrives the same borrowed way
   the dots used to: the screen around this one asks for it. Only table.css is
   read by the test that keeps this honest, so the rest is named in ADL A7 as
   still open rather than quietly fixed here. */
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
  const lengths = dotsAt(event, races)

  return (
    <Link
      /* A gathering and a training take a colour of their own, because they carry
         no lengths and would otherwise read as a race whose distances nobody has
         entered yet (owner, 23.08.2026). A race keeps the tile it always had, so
         it takes no modifier. */
      className={event.kind === 'race' ? 'chip' : `chip chip--${event.kind}`}
      to={`/${locale}/kalendar/${event.slug}`}
      title={event.name}
    >
      <span className="chip__name">{event.name}</span>
      {/* And the word beside the colour, for whoever cannot separate two of them
          (WCAG 2.2 SC 1.4.1). Only where the tile is not a race: a race is what
          the calendar is made of, and saying so on every one of them would be
          read out on every tile of every day. */}
      {event.kind !== 'race' && (
        <span className="visually-hidden">{t(`event.kind.${event.kind}`)}</span>
      )}
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
