import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { dotsAt, upcomingSeries } from '../../data/derive'
import type { BtlEvent, Race, RaceCategory } from '../../data/types'
import { formatDayMonth } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { LengthFilter } from '../../components/LengthFilter'
/* For the five colours of `.length-dot`, which live in the table sheet because
   the results table draws them too (styles/table.css). The front page needs it
   said out loud more than the calendar does: Home.css asks only for the counter,
   so nothing else on this screen was bringing the colours along.

   The dots and not the card around them. `.card` and the `.extract` names are in
   Home.css, which this file does not ask for either; that is the same fault and
   it is written down as open (ADL A7) rather than fixed here, since only
   table.css is read by the test that keeps this honest. */
import '../../styles/table.css'
import { NavSymbolIcon } from '../../app/icons'
import { NAV_SYMBOL } from '../../app/navSymbol'
import { useRowsThatFit } from './rowsThatFit'

/* "Priprema, pozor, SAD!" The calendar is the main reason people come, so what
 * is next stands high on the page.
 *
 * One line per event: the day and month, the lengths it holds as coloured dots,
 * then the name (owner, 31.07.2026). The name is not in bold and never wraps: a
 * second line here would put this widget out of step with the chart beside it,
 * which is the whole point of the two of them sharing a row, so a name that does
 * not fit ends in an ellipsis.
 *
 * The dots are the same five colours as everywhere else, one per length actually
 * run at that event rather than one per race. There is no legend here; the
 * calendar carries it (owner, 31.07.2026).
 *
 * A recurring event takes one row and says when it runs next, instead of five
 * consecutive Wednesdays eating the whole widget.
 *
 * Four races while there is a sponsor of the day under it, and as many as fit to the bottom of the
 * column while there is none (PDL P24, variant A, owner 18.11.2026; `rowsThatFit.ts`). It drew six
 * until then, a number no decision had set.
 *
 * **The filter by length** (owner, 20.11.2026, PDL „Četiri dodatka naslovne iz tuđeg nacrta"): six
 * buttons in one row, „Sve, Kratke, 21,1 km, Duge, 42,2 km, Ultra", in the order the profile has them
 * (`CATEGORIES`, which goes by length). A click filters at once. A length chosen shows the races of that
 * length **in the number „Sve" shows**, as many as fit, or four with a sponsor, and if there are fewer
 * ahead, all there are. The row is as it was: the date, the name, the dots; no „za N dana" under the
 * name (owner: „Nema potrebe za dodatnim redovima "Za 16 dana" i sl.").
 */
/** The calendar of the header of a telephone: the symbol the navigation gives its own „Kalendar", never a drawing of this card's. */
const CALENDAR_SYMBOL = NAV_SYMBOL.calendar

export function CalendarExtract({
  events,
  races,
  today,
  fill,
}: {
  events: BtlEvent[]
  races: Race[]
  today: string
  /** No sponsor of the day: the list fills the column rather than stopping at four. */
  fill: boolean
}) {
  const { locale, t } = useI18n()
  const list = useRef<HTMLUListElement>(null)
  const [length, setLength] = useState<RaceCategory | null>(null)
  /* Every race there is to show, in the order of its date, and then as many of them as fit: the count
     is the same whichever length is chosen, so „Sve" and a length fill the card alike. */
  const ahead = upcomingSeries(events, today, Infinity, length === null ? undefined : { length, races })
  const fits = useRowsThatFit(list, fill, ahead.length)
  const series = ahead.slice(0, fits)

  return (
    <section className="card" aria-labelledby="calendar-extract-heading">
      {/* The way on to the whole calendar stands in the row of the title, on its right (owner, 21.11.2026,
          „Ceo kalendar”), so the room it took under the list is the list's. The row wraps: in a larger
          text the link goes under the title, still on the right. The month today is in (owner,
          04.08.2026) is not where the calendar opens by itself: left to choose, it opens on the first
          month that has anything in it, and in a league whose season starts in January that is months
          away from whoever pressed this. */}
      <div className="card__head">
        <h2 className="card__title" id="calendar-extract-heading">
          {t('home.readySetGo')}
        </h2>
        {/* The word where it fits beside the title and the calendar of the header where it does not (owner,
            21.11.2026, after the review of PR 770): the card decides which (`Home.css`, `.card__head-word`), and
            the name of the link is the same word either way: the one a reader hears is the hidden copy, and the
            one a sighted reader sees is hidden from the reader, so it is never read twice. */}
        <Link className="card__head-link" to={`/${locale}/kalendar?mesec=${today.slice(0, 7)}`}>
          <NavSymbolIcon of={CALENDAR_SYMBOL} className="card__head-icon" />
          <span className="card__head-word" aria-hidden="true">
            {t('home.seeCalendar')}
          </span>
          <span className="visually-hidden">{t('home.seeCalendar')}</span>
        </Link>
      </div>

      <LengthFilter value={length} onChange={setLength} />

      {/* The list stays in the page when there is nothing to put in it, so the count that is kept for
          the column is kept for the element that is measured. */}
      {series.length === 0 && (
        <p className="card__empty">{t(length === null ? 'calendar.empty' : 'home.noneOfLength')}</p>
      )}

      <ul className="extract" ref={list}>
        {series.map((entry) => {
          const lengths = dotsAt(entry.next, races)

          return (
            <li key={entry.next.id} className="extract__row">
              {/* A real date underneath, so what a machine reads is never the
                  shortened form a person reads. */}
              <time className="extract__date" dateTime={entry.next.date}>
                {formatDayMonth(entry.next.date)}
              </time>
              <span className="extract__name">
                <Link to={`/${locale}/kalendar/${entry.next.slug}`}>{entry.name}</Link>
              </span>
              <span className="extract__lengths">
                {lengths.map((one) => (
                  <span
                    key={one}
                    className={`length-dot length-dot--${one}`}
                    aria-hidden="true"
                  />
                ))}
                {/* The colours mean nothing to anyone who cannot separate
                    them, so the names travel with the dots. */}
                <span className="visually-hidden">
                  {lengths.map((one) => t(`category.${one}`)).join(', ')}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
