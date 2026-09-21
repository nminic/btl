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
 * cannot come to say different things about one event.
 *
 * **Every piece of a scale carries the whole of this, and the stylesheet only ever
 * moves it out of SIGHT** (`ADL.md` A7, 31.07.2026: „Kontrola koja menja natpis po
 * širini ekrana mora zadržati oba natpisa u pristupačnom stablu … Skrivanje se radi
 * pomeranjem van vidnog polja …, nikad uklanjanjem"). The first draft of the scale
 * broke that rule in both of the ways that decision was written about: a continuing
 * piece was `aria-hidden` whole, and its body was taken away with
 * `visibility: hidden`. Above 780px that looked right, because the piece was a
 * coloured stump; below it, where the days stack and nothing hides anything, the
 * same piece stood as a full tile with a name and dots that **could not be tapped
 * and did not exist for a screen reader at all**. Measured on a running portal at
 * 360, 390 and 768: 26 such tiles in the served calendar.
 */
function ChipBody({
  event,
  races,
  said,
}: {
  event: BtlEvent
  races: Race[]
  /** The range, in words. Every piece of a scale says it; a one-day tile has none. */
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
 * **WHAT THE OWNER ASKED FOR, 22.09.2026, in his own words:** „Horizontalna skala
 * dogadjaja treba da pocinje u jednom danu kalendara i da prelazi preko narednog ili
 * narednih, a **naziv pise preko cele strafte**, dok su **tacke skroz na desnom kraju
 * iste**."
 *
 * So the run of pieces carries ONE name and ONE row of dots between them: the name is
 * drawn by the piece that opens the run and reaches out over the pieces that follow it,
 * and the dots are drawn by the piece that ends the run, against its right edge. Which
 * piece does which is said by the two classes below and done in the sheet; the markup
 * gives every piece the whole body, so what is drawn is a matter of width and what is
 * SPOKEN never is.
 *
 * **EVERY PIECE IS A LINK AND EVERY PIECE IS NAMED**, at every width, because the
 * markup does not know how wide the screen is and must not pretend to. Each one goes
 * to the event and says the whole range, so a day of a four-day event is reached and
 * read exactly like any other day of the calendar. Below 780px the days stack, there
 * is no run to write a name across, and each piece is simply the tile it always was.
 *
 * **This is the correction of 22.09.2026 and it was a fault of the kind `ADL.md` A7
 * was written about.** The first draft made one piece a month the link and every
 * other piece an `aria-hidden` span whose body the sheet took away with
 * `visibility: hidden`. Both of those are REMOVAL, and A7 (31.07.2026) says hiding by
 * width is done „pomeranjem van vidnog polja …, nikad uklanjanjem", after a first
 * attempt at the same trick „ostavio šest dugmadi bez ijednog imena ispod 620px".
 * Here it left 26 tiles on a telephone that looked like every other tile, could not
 * be tapped, and were not in the accessibility tree at all: the removal was written
 * unconditionally while the only thing that made it defensible, the piece being a
 * mute stump, held only above 780px.
 *
 * **The same name on several links is deliberate and is not the „identical labels"
 * fault.** That one is about links with the same name going to DIFFERENT places
 * (SC 2.4.4); every piece of one bar goes to one event, so one name is the honest
 * one. It is the opposite of the shortcut in a day's corner, which carries its day
 * precisely because those thirty one links lead thirty one different ways.
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

  return (
    <Link className={className} to={`/${locale}/kalendar/${event.slug}`} title={event.name}>
      {/* What holds the line where the sheet moves the name out of sight, and drawn
          nowhere else: above 780px a piece that does not open the run has no name in
          the flow, and with nothing in it the tile would be only its own padding tall,
          so the bar would thin out along its own middle. Decorative and `aria-hidden`,
          which is what lets the sheet take it away below that width without taking a
          word from anybody: the thing A7 forbids removing is the LABEL, and this one
          says nothing.

          **First and not last**, so the lengths can be pushed against the right edge of
          the piece that ends the run: a space standing after them would hold them that
          much off it. */}
      {!piece.opens && (
        <span className="chip__hold" aria-hidden="true">
          &nbsp;
        </span>
      )}
      <ChipBody event={event} races={races} said={said} />
    </Link>
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
