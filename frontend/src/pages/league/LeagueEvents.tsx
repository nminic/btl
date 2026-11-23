import { useEffect, useState } from 'react'

import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { raceMeasure } from '../../data/raceLabel'
import type { League } from '../../data/types'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { leagueRaces, racesByEvent, statesOf } from './leagueCounting'
import { YearStrip } from './YearStrip'
import '../Leagues.css'

/**
 * Which events count towards a competition and, in each of them, which of its races do, inside a box
 * that folds, with the line through the year at its head.
 *
 * **On the list of all competitions, under the prizes** (owner, 13.09.2026): „na pregledu svih
 * liga ispisuje ono što i sad (naziv, opšti detalji, PROPOZICIJE, NAGRADE, pa onda ide i
 * sekcijica DOGAĐAJI / TRKE koja se može ekspandovati tako da se vide sve označene." It stood on
 * the page of a single competition for one day, on his word of 12.09.2026, and he corrected
 * himself the next morning: „ne vidi se na pojedinačnim stranama lige."
 *
 * **A tile to an event, two to a row where there is room for two, since 21.11.2026** (owner, PDL
 * „„Događaji i trke” na listu lige: pločice u dve kolone”, chosen between the ones offered, variant A of
 * `predlozi/lige-dogadjaji-nacrt.html`): „pločice u dve kolone na računaru (jedna na telefonu) … u prvom
 * redu stanje levo („Održan / Sledeći / Predstoji”) i datum desno, u drugom naziv levo i dužine desno;
 * oba reda su vertikalno poravnata (stanje i datum u istoj liniji, naziv i dužine u istoj liniji).” And
 * in his words: „prvi red mora biti vertikalno aligned (SLEDEĆI, DATUM) kao i drugi BBKT, DUŽINE”. Until
 * that day an event was one line, its name, its day in brackets and its lengths after a dash (owner,
 * 03.11.2026). What that line carried is carried still:
 *
 * - **the name of the event is the link to it**;
 * - **the day is the event's**, written the way the rest of the portal writes one (chosen 03.11.2026,
 *   between the two offered, on my recommendation), and never the day of one of its races;
 * - **only the races that count are measured**, so what the box was first built for still holds: „da
 *   član vidi zašto mu neka trka sa tog dana nije u tabeli". A member who ran the short race of a
 *   morning whose long race counts reads its length missing from the tile;
 * - **a length is never rounded** (owner, 03.11.2026: „ako trka ima 7.03 km, nema skracivanja"), only
 *   stripped of the noughts it ends in, so 7,03 km and 21,1 km and 12 km;
 * - **the measure is the one a race's name carries in brackets** (`data/raceLabel.ts`, `raceMeasure`):
 *   a length for a race of a length, how long it lasts for a timed race, and nothing for a free one,
 *   which he chose on 03.11.2026 between the two offered, on my recommendation. An event whose counted
 *   races are all free has no lengths on its tile at all, rather than an empty list.
 *
 * **Which state a tile says is the dot's own answer** (`leagueCounting.ts`, `statesOf`), and the state
 * is said in words and not by colour alone (WCAG 2.2 SC 1.4.1): the gold edge of the next one and the
 * broken frame of the ones ahead only repeat it.
 *
 * **A tile and its dot light together, in both directions** (the same decision): „Prelaz mišem ili fokus
 * na tačku na traci obasja i njenu pločicu, i obrnuto; dodir na tačku na telefonu ističe pločicu i
 * dovodi je u vidno polje.” Which one is lit is held here, by the identity of its event, because this is
 * the one component that draws both. A pointer that hovers lights it while it is over the tile or the
 * dot; the focus on the name of a tile lights it when the focus arrives, which is how the keyboard
 * reaches it (the one light is the last that was asked for, so a pointer that passes over another tile
 * and leaves puts it out although the focus stays, and the ring of the focus stays with it), since the dots are out of the order of the keyboard and hidden from a reader by ear
 * (`YearStrip.tsx` says why). A touch on a dot lights its tile and brings it into view, smoothly unless
 * the reader asked for less motion, and the tile stays lit until a finger touches anything else. The
 * light is a picture and nothing more: what it points at is already said by the tile itself.
 *
 * **Always open, with nothing to press** (owner, 23.11.2026: „ne treba uopšte da postoji dugme za
 * collapsing / expanding trka. Neka se uvek prikazuju za odabranu ligu”). It was a box that folded, open
 * on arrival (owner, 03.11.2026), until that day; the heading is a heading now and not a control, and
 * nothing in this file keeps whether the box is open.
 *
 * **Which column a tile stands in** (owner, 23.11.2026, PDL „Pločice se u dve kolone slažu po kolonama”):
 * the first half of the events, rounded up, down the left column and the rest down the right. The order of
 * the list in the document stays the order of the season, which is what a reader by ear and the keyboard
 * walk and what the one column of a telephone shows; only the sheet sets the columns, from the number of
 * rows this list hands it (`--league-tile-rows`, `Leagues.css`).
 *
 * **Named after its own competition** where it waits for its data (`leagues.countingOf`), so a wait or an
 * error can be told apart from any other of its kind (WCAG 2.2 SC 2.4.4).
 *
 * **The standing's own heading is untouched by this.** There a column is one event and its head
 * is the day alone, with the names of the events read out over it (owner, 07.09.2026, and again
 * on 12.09.2026: „u samoj tabeli rezultata lige kolona i dalje nosi samo datum"). Naming the
 * races is this box's work and not the table's.
 */
/** As many decimals as a race's length is stored with (`race.distance_km`, `numeric(8, 4)` since V25), so
 *  that no length is rounded on its way to the line, only stripped of the noughts it ends in. */
const LENGTH_AS_STORED = 4

/* **The line through the year stands at the head of the open box** (owner, 21.11.2026, proposal B of
   `predlozi/lige-nacrt.html`), drawn from the same list the box writes out (`YearStrip.tsx`), so it
   folds away with the list it is a picture of. `today` is handed in by the screen that reads the clock
   once, so the gold dot and the screen agree on what day it is. */
export function LeagueEvents({ league, today }: { league: League; today: string }) {
  const { locale, t } = useI18n()
  /* The event whose dot and tile are lit, and whether a finger lit it: a finger has no leaving, so
     what it lit stays lit until it touches something else. */
  const [lit, setLit] = useState<{ event: number; byTouch: boolean } | null>(null)
  /* Said once and read twice: on the button and on the wait, so a reader working by ear hears the
     same competition named either way. */
  const named = t('leagues.countingOf', { name: league.name })
  const tileOf = (event: number) => `league-${league.id}-event-${event}`

  const light = (event: number | null) => setLit(event === null ? null : { event, byTouch: false })

  /* A touch anywhere but on a dot lets the tile go; a touch on a dot lights its own (below). */
  useEffect(() => {
    if (lit === null || !lit.byTouch) {
      return
    }

    function away(down: PointerEvent) {
      if (down.pointerType === 'touch' && !(down.target instanceof Element && down.target.closest('.leagues__dot') !== null)) {
        setLit(null)
      }
    }

    document.addEventListener('pointerdown', away)

    return () => document.removeEventListener('pointerdown', away)
  }, [lit])

  /** A finger on a dot: its tile is lit and brought into view, without motion for a reader who asked
   *  for less of it. „Into view" and no further, so a tile already in sight does not move. */
  function touched(event: number) {
    setLit({ event, byTouch: true })
    document.getElementById(tileOf(event))?.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  return (
    <section className="leagues__counting">
      <h3>{t('leagues.counting')}</h3>

      <div className="leagues__counting-panel">
        <Resource state={combinePair(useEvents(), useRaces())} inline label={named}>
          {([events, races]) => {
            const counting = racesByEvent(leagueRaces(league, races), events)
            const stateOf = statesOf(counting, today)

            /* A competition with nothing in it yet says so. Two silences end up here and one
               sentence is true of both: a competition no event has been given, and one whose
               events have no races entered yet. What a reader wants to know is the same in
               either case, that no race counts towards this competition so far. */
            if (counting.length === 0) {
              return <p className="profile__empty">{t('leagues.noCounting')}</p>
            }

            return (
              <>
                <YearStrip
                  counting={counting}
                  season={league.season}
                  today={today}
                  lit={lit?.event ?? null}
                  onLight={light}
                  touched={touched}
                />
                <ul
                  className="leagues__event-tiles"
                  style={{ '--league-tile-rows': Math.ceil(counting.length / 2) }}
                >
                  {counting.map(({ event, races: mine }) => {
                    const state = stateOf(event)
                    const measures = mine
                      .map((race) => raceMeasure(race, locale, LENGTH_AS_STORED, 0))
                      .filter((measure) => measure !== '')
                    const look = `leagues__event-tile leagues__event-tile--${state}`

                    return (
                      <li
                        key={event.id}
                        id={tileOf(event.id)}
                        className={lit?.event === event.id ? `${look} leagues__event-tile--lit` : look}
                        onPointerEnter={(entered) => {
                          if (entered.pointerType !== 'touch') {
                            light(event.id)
                          }
                        }}
                        onPointerLeave={(left) => {
                          if (left.pointerType !== 'touch') {
                            light(null)
                          }
                        }}
                        onFocus={() => light(event.id)}
                        onBlur={() => light(null)}
                      >
                        <div className="leagues__event-top">
                          <p className="leagues__event-state">
                            <span className="leagues__event-pip" aria-hidden="true" />
                            {t(`leagues.state.${state}`)}
                          </p>
                          <p className="leagues__event-when">
                            <time dateTime={event.date}>{formatShortDate(event.date, locale)}</time>
                          </p>
                        </div>
                        <div className="leagues__event-mid">
                          <Link to={`/${locale}/kalendar/${event.slug}`}>{event.name}</Link>
                          {measures.length > 0 && (
                            <ul className="leagues__event-lengths">
                              {measures.map((measure, index) => (
                                <li key={index}>{measure}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )
          }}
        </Resource>
      </div>
    </section>
  )
}
