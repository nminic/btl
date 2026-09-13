import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { raceLabel } from '../../data/raceLabel'
import type { League } from '../../data/types'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { leagueRaces, racesByEvent } from './leagueCounting'
import '../Leagues.css'

/**
 * Which events count towards a competition and, under each of them, which of its races do,
 * inside a box that folds.
 *
 * **On the list of all competitions, under the prizes** (owner, 13.09.2026): „na pregledu svih
 * liga ispisuje ono što i sad (naziv, opšti detalji, PROPOZICIJE, NAGRADE, pa onda ide i
 * sekcijica DOGAĐAJI / TRKE koja se može ekspandovati tako da se vide sve označene." It stood on
 * the page of a single competition for one day, on his word of 12.09.2026, and he corrected
 * himself the next morning: „ne vidi se na pojedinačnim stranama lige."
 *
 * **Two levels, and the second one is the point** (owner, 12.09.2026, the half of that day that
 * survived): an event, and under it the races that enter the competition by name, „da član vidi
 * zašto mu neka trka sa tog dana nije u tabeli." A member who ran the short race of a morning
 * whose long race is the one that counts has that answered here, in words, rather than by
 * noticing that a column of the standing is missing.
 *
 * **Folded until somebody asks.** This screen carries every competition of a season at once, and
 * three competitions of forty six events each would bury the names the reader came for. What is
 * open is said by `aria-expanded` rather than by the words on the button, which is what a
 * disclosure is; the shape is the portal's own (`app/Dropdown.tsx`, `admin/PendingQueue.tsx`):
 * a button, `aria-controls` naming the panel, and the panel carrying `hidden` rather than being
 * taken out of the document, so what the button points at is there to be pointed at.
 *
 * **Named after its own competition.** Four of these stand on one screen, and four buttons
 * reading „Događaji i trke" are four controls a screen reader cannot tell apart (WCAG 2.2 SC
 * 2.4.4). The words on the button stay the short ones and the name adds the competition, which is
 * how this portal already names a control that repeats (`components/GenderTabs.tsx`,
 * `admin/PendingQueue.tsx`), and the visible words are the first half of the name, which is what
 * SC 2.5.3 asks.
 *
 * **The standing's own heading is untouched by this.** There a column is one event and its head
 * is the day alone, with the names of the events read out over it (owner, 07.09.2026, and again
 * on 12.09.2026: „u samoj tabeli rezultata lige kolona i dalje nosi samo datum"). Naming the
 * races is this box's work and not the table's.
 */
export function LeagueEvents({ league }: { league: League }) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const panelId = `league-counting-${league.id}`
  /* Said once and read twice: on the button and on the wait, so a reader working by ear hears the
     same competition named either way. */
  const named = t('leagues.countingOf', { name: league.name })

  return (
    <section className="leagues__counting">
      {/* The button inside the heading, which is what parts a box that folds from a button that
          happens to sit above one: a screen reader's list of headings still holds this box, and
          the control the reader lands on from it is the one that opens it. */}
      <h3>
        <button
          type="button"
          className="leagues__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={named}
          onClick={() => setOpen((was) => !was)}
        >
          {t('leagues.counting')}
        </button>
      </h3>

      <div id={panelId} hidden={!open}>
        <Resource state={combinePair(useEvents(), useRaces())} inline label={named}>
          {([events, races]) => {
            const counting = racesByEvent(leagueRaces(league, races), events)

            /* A competition with nothing in it yet says so. Two silences end up here and one
               sentence is true of both: a competition no event has been given, and one whose
               events have no races entered yet. What a reader wants to know is the same in
               either case, that no race counts towards this competition so far. */
            if (counting.length === 0) {
              return <p className="profile__empty">{t('leagues.noCounting')}</p>
            }

            return (
              <ul className="leagues__events">
                {counting.map(({ event, races: mine }) => (
                  <li key={event.id}>
                    <h4 className="leagues__event-name">
                      <Link to={`/${locale}/kalendar/${event.slug}`}>{event.name}</Link>
                    </h4>

                    <p className="leagues__event-day">{formatShortDate(event.date, locale)}</p>

                    <ul className="leagues__event-races">
                      {mine.map((race) => (
                        /* Named through the one function that names a race among the races it is
                           shown beside (`data/raceLabel.ts`), which is what the event's own page
                           names them by as well. Every race in the file starts out carrying its
                           event's name, so a list written as the bare name would be „BTL trening
                           trek" three times over; the label adds what parts them, and adds the
                           day only where the day is what does it. */
                        <li key={race.id}>{raceLabel(race, mine, locale)}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )
          }}
        </Resource>
      </div>
    </section>
  )
}
