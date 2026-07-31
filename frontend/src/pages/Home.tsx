import { useToday } from '../clock/useClock'
import { Resource } from '../components/Resource'
import { defaultSeason, totalsOf, fieldFor } from '../data/derive'
import { combineResources, useCompetitors, useEvents, useResults } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { CalendarExtract } from './home/CalendarExtract'
import { Calculator } from './home/Calculator'
import { TopByCategory } from './home/TopByCategory'
import { Counters } from './home/Counters'
import { EnrolmentSlot } from './home/EnrolmentSlot'
import { NEWS, seasonLabelKey, SPONSORS } from './home/content'
import { News } from './home/News'
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
 * calendar, the calculator, and the membership slot.
 *
 * Two blocks went out with this: "Kako radi BTL u 3 koraka", which explained on
 * the front page what the written pages explain properly, and "Zajednica u
 * brojkama", whose member count is now the first row of the counters where it
 * stands beside the rest of the season (owner, 31.07.2026).
 *
 * News, the sponsor of the day and the strip of partners keep the full width
 * under both columns. They are the only part of the page that has nothing to say
 * most of the time, and they disappear entirely when they do.
 *
 * On a phone it is one column, left before right.
 */
export function Home() {
  const { t } = useI18n()
  const state = combineResources(useCompetitors(), useEvents(), useResults())
  const today = useToday()

  return (
    <div className="home">
      {/* Not shown, but present: the header already says the name in full right
          above, and repeating it was what the owner had removed. A page with no
          h1 at all is still a page a screen reader cannot name. */}
      <h1 className="visually-hidden">{t('app.name')}</h1>

      <Resource state={state}>
        {([competitors, events, results]) => {
          // The running season once it has results; until then the fullest one
          // there is, so the widgets can be judged before the first race.
          const season = defaultSeason(results, today)
          /* Who the widgets of this season are drawn from (PDL P11): a member
             whose fee has run out is not in the season now at all, and the top
             ten and the chart are that season's standing in another shape. */
          const field = fieldFor(competitors, season, today)
          const totals = totalsOf(results.filter((one) => one.date.startsWith(String(season))))
          // The running season is the calendar year, not the year the
          // membership is sold for.
          const label = t(seasonLabelKey(season, Number(today.slice(0, 4))), { season })

          return (
            <>
              <div className="home__split">
                <div className="home__main">
                  <div className="home__boards">
                    <TopTen
                      competitors={field}
                      results={results}
                      season={season}
                      gender="M"
                    />
                    <TopTen
                      competitors={field}
                      results={results}
                      season={season}
                      gender="F"
                    />
                  </div>

                  <TopByCategory competitors={field} results={results} season={season} />

                  <President />
                </div>

                <div className="home__side">
                  <Counters totals={totals} title={label} members={field.length} />
                  <CalendarExtract events={events} today={today} />
                  <Calculator />
                  <EnrolmentSlot today={today} />
                </div>
              </div>

              <div className="home__row home__row--calendar">
                <News items={NEWS} today={today} />
                <Sponsor sponsors={SPONSORS} />
              </div>

              <SponsorStrip sponsors={SPONSORS} />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
