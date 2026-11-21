import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { statesOf, type EventRaces } from './leagueCounting'

/**
 * THE YEAR OF A COMPETITION AS A LINE: ONE DOT FOR EVERY EVENT IT COUNTS, THE NEXT ONE GOLD.
 *
 * Owner, 21.11.2026 (PDL, „Strana „Lige” se radi po predlogu B”), chosen between the ones offered:
 * „Traka kroz godinu (tačka za svaki događaj, sledeći zlatan) ostaje; nije kalendar nego slika spiska
 * događaja, a klik na tačku vodi na događaj (odluka od 22.08.2026 „poseban kalendar nema” ostaje).”
 *
 * **A picture of the list under it, and nothing more.** It is drawn from exactly what
 * `LeagueEvents.tsx` lists (`EventRaces`, the events with at least one counted race), so the line and
 * the list cannot disagree about which days a competition has.
 *
 * **What a reader working by ear is given is one sentence, and the line is hidden from him.** The
 * dots are links for the mouse and the finger, and each of them is the same address as the name of
 * its event in the list right below, which is the control that meets WCAG 2.2 SC 2.5.8 and SC 2.1.1:
 * eight more stops for the keyboard would be eight stops that lead nowhere the list does not.
 * `tabIndex={-1}` keeps them out of the order, which is also what lets `aria-hidden` stand over them.
 *
 * **Where a dot stands** is the day of the year its event falls on, against the length of the
 * season's year, so a competition read in December and one read in March draw the same line.
 *
 * `mini` is the one on a card of the showcase: no months, no links (the whole card is the link that
 * opens the competition), and no sentence, because the card already says how many events it has.
 *
 * **A dot and the tile of its event light together** (owner, 21.11.2026, PDL „„Događaji i trke” na
 * listu lige: pločice u dve kolone”): „Prelaz mišem ili fokus na tačku na traci obasja i njenu pločicu,
 * i obrnuto; dodir na tačku na telefonu ističe pločicu i dovodi je u vidno polje.” Which event is lit is
 * held by the box that draws both (`LeagueEvents.tsx`) and handed in here as `lit`, so the dot and the
 * tile read one answer. A pointer that hovers lights the dot it is over and lets go when it leaves; a
 * finger has no hovering, so its touch is `touched`, and that touch does not follow the link: the tile
 * it brings into view carries the same address in its name. A mouse press still leads to the event, as
 * the decision of the same day about the line says („klik na tačku vodi na događaj”). Told apart by the
 * kind of pointer and not by the width of the window, as `components/CategoryDonut.tsx` tells a mouse
 * from a finger.
 *
 * **The events are handed in in the order the season is run in** (`racesByEvent`), which is what makes
 * the first that has not passed the next one (`statesOf`).
 */
export function YearStrip(props: Strip & ({ mini: true } | ({ mini?: false } & Lighting))) {
  const { counting, season, today } = props
  const mini = props.mini === true
  const { locale, t } = useI18n()
  const stateOf = statesOf(counting, today)
  const next = counting.find(({ event }) => stateOf(event) === 'next')
  const months = t('leagues.months').split(' ')
  const todayAt = today.startsWith(`${season}-`) ? placeOf(today, season) : null
  /* The kind of pointer that pressed last, read by the click that follows the press: a click carries no
     kind of its own in every browser, and the press always comes first. */
  const pressedBy = useRef('')

  function pressed(down: PointerEvent<HTMLAnchorElement>, byFinger: () => void) {
    pressedBy.current = down.pointerType

    if (down.pointerType === 'touch') {
      byFinger()
    }
  }

  function followed(click: MouseEvent<HTMLAnchorElement>) {
    if (pressedBy.current === 'touch') {
      click.preventDefault()
    }

    pressedBy.current = ''
  }

  const line = (
    <div className={mini ? 'leagues__year leagues__year--mini' : 'leagues__year'} aria-hidden="true">
      <span className="leagues__year-line" />
      {todayAt !== null && <span className="leagues__year-today" style={{ '--at': `${todayAt}%` }} />}
      {counting.map(({ event }) => {
        const dot = `leagues__dot leagues__dot--${stateOf(event)}`
        const at = { '--at': `${placeOf(event.date, season)}%` }

        return props.mini === true ? (
          <span key={event.id} className={dot} style={at} />
        ) : (
          <Link
            key={event.id}
            className={props.lit === event.id ? `${dot} leagues__dot--lit` : dot}
            style={at}
            to={`/${locale}/kalendar/${event.slug}`}
            tabIndex={-1}
            title={`${event.name} (${formatShortDate(event.date, locale)})`}
            onPointerEnter={(entered) => {
              if (entered.pointerType !== 'touch') {
                props.onLight(event.id)
              }
            }}
            onPointerLeave={(left) => {
              if (left.pointerType !== 'touch') {
                props.onLight(null)
              }
            }}
            onPointerDown={(down) => pressed(down, () => props.touched(event.id))}
            onClick={followed}
            onFocus={() => props.onLight(event.id)}
            onBlur={() => props.onLight(null)}
          />
        )
      })}
      {!mini && (
        <span className="leagues__months">
          {months.map((month) => (
            <span key={month}>
              <span className="leagues__month-long">{month}</span>
              <span className="leagues__month-short">{month.slice(0, 1)}</span>
            </span>
          ))}
        </span>
      )}
    </div>
  )

  if (mini) {
    return line
  }

  return (
    <>
      <p className="visually-hidden">
        {next === undefined
          ? t('leagues.yearHeld', { count: counting.length, number: counting.length })
          : t('leagues.yearNext', {
              count: counting.length,
              number: counting.length,
              next: formatShortDate(next.event.date, locale),
            })}
      </p>
      {line}
    </>
  )
}

/** What every line is drawn from: the events in the order the season is run in, and the day it is read. */
type Strip = { counting: EventRaces[]; season: number; today: string }

/** What a line on the sheet is handed besides, to light a dot together with its tile. */
type Lighting = {
  /** The event lit together with its tile, by its identity, or nothing. */
  lit: number | null
  /** Asked to light one event, or none, by a pointer that hovers or by the focus. */
  onLight: (event: number | null) => void
  /** A finger touched the dot of this event. */
  touched: (event: number) => void
}

/** How far into the season's year a day falls, as a share of it in per cent, to one decimal. */
function placeOf(day: string, season: number): number {
  const start = Date.UTC(season, 0, 1)
  const length = Date.UTC(season + 1, 0, 1) - start
  const at = Date.parse(`${day}T00:00:00Z`) - start

  return Math.round((Math.min(Math.max(at, 0), length) / length) * 1000) / 10
}
