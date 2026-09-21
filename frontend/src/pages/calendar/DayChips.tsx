import { Link } from 'react-router'
import { dotsAt } from '../../data/derive'
import type { Drawn } from '../../data/derive'
import type { BtlEvent, Race } from '../../data/types'
import { formatDayInSentence } from '../../i18n/format'
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
 * What is inside a tile: the name, the word for its kind where it is not a race,
 * the range where it has one, and the lengths.
 *
 * One body for the tile of a single day and for every piece of a scale, so the two
 * cannot come to say different things about one event. The scale hides this body on
 * the pieces that only continue it, and it hides it **in the stylesheet**: what a
 * reader with their ears meets is decided here, in the markup, and is the same at
 * every width. A piece that continues is `aria-hidden` whole, so nothing in here is
 * spoken twice however it is drawn.
 */
function ChipBody({
  event,
  races,
  said,
}: {
  event: BtlEvent
  races: Race[]
  /** The range, in words, on the one piece that speaks for the whole event. */
  said?: string
}) {
  const { t } = useI18n()
  const lengths = dotsAt(event, races)

  return (
    <>
      <span className="chip__name">{event.name}</span>
      {/* And the word beside the colour, for whoever cannot separate two of them
          (WCAG 2.2 SC 1.4.1). Only where the tile is not a race: a race is what
          the calendar is made of, and saying so on every one of them would be
          read out on every tile of every day. */}
      {event.kind !== 'race' && (
        <span className="visually-hidden">{t(`event.kind.${event.kind}`)}</span>
      )}
      {/* The range is spoken and not only drawn (PDL P35, 21.09.2026). A bar across
          four days says „four days" with its shape, and shape is the one thing a
          reader with their ears never gets; without this the event would arrive as
          a name with no more about it than a single day's tile carries. */}
      {said !== undefined && <span className="visually-hidden">, {said}</span>}
      <span className="chip__lengths">
        {lengths.map((one) => (
          <span key={one} className={`length-dot length-dot--${one}`} aria-hidden="true" />
        ))}
        <span className="visually-hidden">
          {lengths.map((one) => t(`category.${one}`)).join(', ')}
        </span>
      </span>
    </>
  )
}

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
  const { locale } = useI18n()

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
      <ChipBody event={event} races={races} />
    </Link>
  )
}

/**
 * One day of a multi-day event, drawn as a piece of the bar that runs across all of
 * them (PDL P35, 21.09.2026, owner: „napravi skale u Kalendar view koje mogu
 * zauzimati vise dana ako se radi o takvom dogadjaju").
 *
 * **One event and one mark, not one mark a day.** Exactly one piece in a month is a
 * link, and it is the first day of the event that month holds; every other piece is
 * a span and is `aria-hidden` whole. So a reader with their ears meets the event
 * once, with its range said out in words, rather than meeting the same name on each
 * of four days and having to work out that they are one thing.
 *
 * **Why the pieces are drawn in the days rather than over them.** A bar placed on
 * the month grid itself would be a grid item beside the days, which takes the day out
 * of being the thing that holds what is on it: the ring on today, the shortcut in its
 * corner, the measured width floor and the rule that a row is as tall as its tallest
 * day are all written about `.day`, and every one of them would have had to be moved
 * or duplicated. A piece per day keeps all of that untouched, and the pieces are made
 * to read as one bar in the stylesheet, which is where the drawing belongs.
 *
 * **Nothing here is told apart by colour.** A scale wears the colour its kind always
 * wore; what makes it a scale is its shape, that it reaches across days, and the
 * range it says (ADL A7, WCAG 2.2 SC 1.4.1).
 */
export function EventScale({ piece, races }: { piece: Extract<Drawn, { at: 'scale' }>; races: Race[] }) {
  const { locale, t } = useI18n()
  const { event } = piece
  const said = t('calendar.spanDays', {
    from: formatDayInSentence(piece.from, locale),
    to: formatDayInSentence(piece.to, locale),
  })

  const className = [
    'chip',
    event.kind === 'race' ? '' : `chip--${event.kind}`,
    'chip--scale',
    /* What the piece does at each end, said as a class so the stylesheet draws it.
       A piece opens where the event starts, where the month starts, or where a row
       does; it closes where the event ends, where the month ends, or where a row
       does. The two are separate because a bar that begins on a Saturday and ends on
       a Monday has a piece that does neither. */
    piece.opens ? '' : 'chip--continues',
    piece.closes ? '' : 'chip--runs-on',
  ]
    .filter(Boolean)
    .join(' ')

  return piece.leads ? (
    <Link className={className} to={`/${locale}/kalendar/${event.slug}`} title={event.name}>
      <ChipBody event={event} races={races} said={said} />
    </Link>
  ) : (
    /* Not a link and not spoken. A second link would be a second place to stop with
       the tab key and a second name in a reader's list of links, which is the „two
       marks" the owner's rule is against; and a name drawn twice on a row that wraps
       is what the eye needs, so the drawing is left to the sheet and the record of
       what this is stays here. */
    <span className={className} aria-hidden="true">
      <ChipBody event={event} races={races} />
    </span>
  )
}

/**
 * A lane that holds nothing on this day.
 *
 * It exists so the bar under it keeps its line: on 2 June 2019 the lane above
 * Ultramaraton Palić is empty, and without this the bar would climb a row between
 * the 1st and the 2nd and read as two different things. Invisible rather than absent,
 * and made out of the tile itself so it is exactly one tile tall without a number
 * anywhere that could fall out of step with the tile it stands in for.
 *
 * **Written as the entity and not as the character it stands for.** A space that holds
 * a line open is invisible in the source as well as on the screen, and the portal
 * refuses a character nobody can see in a file it ships
 * (`test/controlBytes.test.ts`, which is what caught this one). The entity says out
 * loud what is there.
 */
export function HollowLane() {
  return (
    <span className="chip chip--hollow" aria-hidden="true">
      &nbsp;
    </span>
  )
}
