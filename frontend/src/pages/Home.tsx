import { Resource } from '../components/Resource'
import { defaultSeason, totalsOf } from '../data/derive'
import { combineResources, useCompetitors, useEvents, useResults } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { CalendarExtract } from './home/CalendarExtract'
import { Calculator } from './home/Calculator'
import { CategoryChart } from './home/CategoryChart'
import { CommunityNumbers } from './home/CommunityNumbers'
import { Counters } from './home/Counters'
import { EnrolmentSlot } from './home/EnrolmentSlot'
import { Hero } from './home/Hero'
import { HowItWorks } from './home/HowItWorks'
import { NEWS, seasonLabelKey, SPONSORS } from './home/content'
import { News } from './home/News'
import { Sponsor, SponsorStrip } from './home/Sponsor'
import { TopTen } from './home/TopTen'
import './Home.css'

/* The widget order is the one fixed in PDL P14, top to bottom:
 *
 *   hero with the season counters
 *   "Priprema, pozor, SAD!" (2/3) beside the seasonal slot (1/3)
 *   Top 10 men (1/4) | Top 10 women (1/4) | rotating chart (1/2)
 *   calculator (1/2) beside how it works (1/2)
 *   news (2/3) beside sponsor of the day (1/3)
 *   the strip of partner logos
 *
 * On a phone it is the same order in one column. News, sponsor and strip
 * disappear entirely when they have nothing fresh to say.
 */
export function Home() {
  const { t } = useI18n()
  const state = combineResources(useCompetitors(), useEvents(), useResults())
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="home">
      <Resource state={state}>
        {([competitors, events, results]) => {
          // The running season once it has results; until then the fullest one
          // there is, so the widgets can be judged before the first race.
          const season = defaultSeason(results, today)
          const totals = totalsOf(results.filter((one) => one.date.startsWith(String(season))))
          // The running season is the calendar year, not the year the
          // membership is sold for.
          const label = t(seasonLabelKey(season, Number(today.slice(0, 4))), { season })

          return (
            <>
              <Hero today={today} />
              <Counters totals={totals} seasonLabel={label} />

              <div className="home__row home__row--calendar">
                <CalendarExtract events={events} today={today} />
                <EnrolmentSlot today={today} />
              </div>

              <div className="home__row home__row--standing">
                <TopTen competitors={competitors} results={results} season={season} gender="M" />
                <TopTen competitors={competitors} results={results} season={season} gender="F" />
                <CategoryChart results={results} season={season} />
              </div>

              <div className="home__row home__row--halves">
                <Calculator />
                <HowItWorks />
              </div>

              <div className="home__row home__row--calendar">
                <News items={NEWS} today={today} />
                <Sponsor sponsors={SPONSORS} />
              </div>

              <CommunityNumbers competitors={competitors} />
              <SponsorStrip sponsors={SPONSORS} />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
