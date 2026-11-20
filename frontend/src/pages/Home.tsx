import { useState } from 'react'
import { useLocation } from 'react-router'
import { useToday } from '../clock/useClock'
import { accountWasDeleted } from './accountDeleted'
import { DeletionSaid } from './admin/DeletionSaid'
import { Resource } from '../components/Resource'
import { countedIn, totalsOf } from '../data/derive'
import { boardsOpenOn, seasonShown, WARM_UP } from '../data/season'
import { combineFour, useCompetitors, useEvents, useRaces, useResults } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { CalendarExtract } from './home/CalendarExtract'
import { Calculator } from './home/Calculator'
import { TopByCategory } from './home/TopByCategory'
import { Counters } from './home/Counters'
import { SPONSORS } from './home/content'
import { President } from './home/President'
import { Sponsor, SponsorStrip } from './home/Sponsor'
import { TopTen } from './home/TopTen'
import './Home.css'

/**
 * The front page, in two columns: two thirds of standing and prose on the left,
 * one third of figures and things to do on the right (owner, 31.07.2026).
 *
 * Left, top to bottom: the two top ten boards side by side, the turning chart of
 * the five lengths under them, and the address of the president at the foot.
 *
 * Right, top to bottom: the counters of the running season, what is next in the
 * calendar, the sponsor of the day, and the calculator in two rows of three
 * (PDL P24, variant A, owner 18.11.2026: „Tri desna boksa su zajedno visoka kao
 * leva kolona."). The three under the counters stand as one column beside the
 * chart and the address, so the grid puts the chart and the address across two
 * rows each and the three boxes across the five lines between them, and both
 * columns end on the same line by construction (`Home.css`).
 *
 * One grid holds all six, rather than two columns holding three each (owner,
 * 31.07.2026). The rows are what the owner asked for: the boards end where the
 * counters end, and the chart ends where the calendar does. Two columns side by
 * side cannot do that, because neither knows how tall the other came out; one
 * grid does it by itself, and the chart's bars get the height they were missing.
 *
 * The order in the markup is the order on a phone, where the grid becomes one
 * column and the placement below does nothing: the two boards, the figures of
 * the season, the turning chart, what is next, the address, the sponsor of the
 * day, the calculator (owner, 31.07.2026; the sponsor between the last two since
 * 18.11.2026: „Na telefonu „Sponzor dana” stoji posle obraćanja predsednika, a
 * pre kalkulatora."). It is not the order of either column, because on one
 * screen the two columns interleave: somebody scrolling wants the standing, then
 * the numbers behind it, then the calendar, and the prose after all of them.
 *
 * The membership slot stood at the foot of the right column until 04.08.2026,
 * when the owner had it removed: "nećemo ga koristiti do daljnjeg". The page of
 * prices it led to went with it.
 *
 * Two blocks went out with this: "Kako radi BTL u 3 koraka", which explained on
 * the front page what the written pages explain properly, and "Zajednica u
 * brojkama", whose member count is now the first row of the counters.
 *
 * Under both columns, across the full width, only the strip of sponsors. The
 * news went on 17.11.2026 (PDL P16, „vesti nema").
 *
 * **Whether there is a sponsor is answered once, here**, and four things read the
 * one answer: the box of the day, the strip, how many races the calendar shows,
 * and the shape of the grid. Without one there is neither box nor strip, the
 * calendar runs to the bottom of the column and the grid is variant A without the
 * box: one layout, not two (owner, 20.11.2026).
 */
export function Home() {
  const { t } = useI18n()
  /* The sponsor of the day is the first of them, as it was before variant A. */
  const [ofTheDay] = SPONSORS
  const state = combineFour(useCompetitors(), useEvents(), useResults(), useRaces())
  const today = useToday()
  /* „Vaš nalog je obrisan.", for the one arrival his own deletion opens this page with (owner, 20.11.2026), in
     the shape the list of teams says „Tim je obrisan." in (`Teams.tsx`, `teamDeleted.ts`). */
  const arrived = useLocation().state
  const [said, setSaid] = useState(() => (accountWasDeleted(arrived) ? t('home.accountDeleted') : ''))

  return (
    <div className="home">
      {/* Not shown, but present: the header already says the name in full right
          above, and repeating it was what the owner had removed. A page with no
          h1 at all is still a page a screen reader cannot name. */}
      <h1 className="visually-hidden">{t('app.name')}</h1>

      {said !== '' && <DeletionSaid said={said} clear={setSaid} />}

      <Resource state={state}>
        {([competitors, events, results, races]) => {
          /* The running season, and before the league has one its first, empty or
             not: nothing here falls back to a season the league did not run (owner,
             16.10.2026, `seasonShown`). */
          const season = seasonShown(today)
          /* Who the widgets of this season are drawn from (PDL P11): a member
             whose fee has run out is not in the season now at all, and the top
             ten and the chart are that season's standing in another shape.

             The list itself since 21.09.2026: `/api/competitors` does not answer
             for such a member (owner, 13.09.2026), so there is nothing here left
             to take out. */
          const field = competitors
          /* THE COUNTERS AT THE TOP OF THE RIGHT COLUMN AND THE TURNING CHART ARE THE WARM-UP before the
             first season has begun, and the season shown after it (owner, 12.11.2026: „widgeti na
             naslovnoj strani gore desno (umesto Sezona 2027. treba da se zove zagrevanje) i ovaj
             rotirajući widget po dužini trke"; `boardsOpenOn`). The two boards of ten stay on the
             season: before it has begun they already read the history (PR 716). */
          const view = boardsOpenOn(today)
          /* The view's own figures, so what its season counts and nothing else (`countedIn`, PDL P9,
             18.10.2026): a run of somebody who was not a member that year is not the season's. */
          const totals = totalsOf(results.filter((one) => countedIn(one, view)))
          /* „Sezona 2019, probni podaci" stood here until 16.10.2026, over the fullest season of the
             imported history. */
          const label = view === WARM_UP ? t('rankings.warmUp') : t('home.season', { season: view })

          return (
            <>
              <div className={ofTheDay === undefined ? 'home__split' : 'home__split home__split--sponsored'}>
                <div className="home__boards">
                  <TopTen competitors={field} results={results} season={season} today={today} gender="M" />
                  <TopTen competitors={field} results={results} season={season} today={today} gender="F" />
                </div>

                <div className="home__figures">
                  <Counters totals={totals} title={label} members={field.length} />
                </div>

                <div className="home__chart">
                  <TopByCategory competitors={field} results={results} season={view} />
                </div>

                <div className="home__next">
                  <CalendarExtract events={events} races={races} today={today} fill={ofTheDay === undefined} />
                </div>

                <div className="home__address">
                  <President />
                </div>

                {ofTheDay !== undefined && (
                  <div className="home__sponsor">
                    <Sponsor sponsor={ofTheDay} />
                  </div>
                )}

                <div className="home__calc">
                  <Calculator />
                </div>
              </div>

              {ofTheDay !== undefined && <SponsorStrip sponsors={SPONSORS} />}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
