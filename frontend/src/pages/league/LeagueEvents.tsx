import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { raceMeasure } from '../../data/raceLabel'
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
 * **One line to an event** (owner, 03.11.2026, „u jednom redu formata BBKT (10.1.2027.) - 12 km,
 * 6 km, 3 km"): the name of the event as a link, its day in brackets, and after a dash the
 * measures of the races of it that count, with no nought after the decimal comma that can be left
 * off. Only noughts go: a length is never rounded (owner, the same day: „ako trka ima 7.03 km,
 * nema skracivanja"), so 7,03 km and 21,1 km and 12 km. The day is written the way the rest of the portal writes one (he chose it the same day,
 * between the two offered, on my recommendation). Until 03.11.2026 the races stood under the event
 * one to a line and by name (owner, 12.09.2026). What that was for still holds: „da član vidi
 * zašto mu neka trka sa tog dana nije u tabeli". Only the races that count are measured here, so
 * a member who ran the short race of a morning whose long race counts reads its length missing
 * from the line.
 *
 * **The measure is the one a race's name carries in brackets** (`data/raceLabel.ts`,
 * `raceMeasure`): a length for a race of a length, how long it lasts for a timed race, and nothing
 * for a free one, which he chose on 03.11.2026 between the two offered, on my recommendation. An
 * event whose races counting are all free has no dash after its day, since a dash with nothing
 * after it says nothing.
 *
 * **Open on arrival, and folded on a press** (owner, 03.11.2026: „kutija treba da bude default
 * otvorena (expanded), ne collapsed"). Until that day it was folded until somebody asked, on the
 * reasoning that this screen carries every competition of a season at once; one line to an event
 * is what made the open box short enough to stand. Each box keeps its own state. What is
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
/** As many decimals as a race's length is stored with (`race.distance_km`, `numeric(8, 4)` since V25), so
 *  that no length is rounded on its way to the line, only stripped of the noughts it ends in. */
const LENGTH_AS_STORED = 4

export function LeagueEvents({ league }: { league: League }) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(true)
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
                {counting.map(({ event, races: mine }) => {
                  const measures = mine
                    .map((race) => raceMeasure(race, locale, LENGTH_AS_STORED, 0))
                    .filter((measure) => measure !== '')

                  return (
                    <li key={event.id} className="leagues__event-line">
                      <Link to={`/${locale}/kalendar/${event.slug}`}>{event.name}</Link>{' '}
                      <span className="leagues__event-what">
                        ({formatShortDate(event.date, locale)})
                        {measures.length > 0 && ` - ${measures.join(', ')}`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )
          }}
        </Resource>
      </div>
    </section>
  )
}
