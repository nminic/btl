import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { useToday } from '../clock/useClock'
import { accountWasDeleted } from './accountDeleted'
import { DeletionSaid } from './admin/DeletionSaid'
import { Resource } from '../components/Resource'
import { citiesOf, countedIn, totalsOf } from '../data/derive'
import { boardsOpenOn, seasonShown, WARM_UP } from '../data/season'
import {
  combineFour,
  combinePair,
  useCompetitors,
  useEvents,
  useRaces,
  useResults,
  useSponsors,
} from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { CalendarExtract } from './home/CalendarExtract'
import { Calculator } from './home/Calculator'
import { TopByCategory } from './home/TopByCategory'
import { Counters } from './home/Counters'
import { President } from './home/President'
import { Sponsor, SponsorStrip } from './home/Sponsor'
import { sponsorsOrNobody } from './home/sponsorsOrNobody'
import { TopTen } from './home/TopTen'
import { putBack, whereIs, type Remembered } from './home/keepTheFocus'
import { useTwoColumns } from './home/useTwoColumns'
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
 * leva kolona.").
 *
 * **Two columns that are two columns** (owner, 20.11.2026, PDL „Četiri dodatka naslovne iz tuđeg
 * nacrta", in the words of the plan and not the owner's: the right column is a column of its own, the
 * figures as tall as their content and the calendar beginning right under them). From 31.07.2026 to then one grid held all six boxes and the rows were
 * shared, so the figures were as tall as the two boards beside them and the calendar began where
 * the boards ended. Each column is now a box of its own and the boxes in it follow one another,
 * and each column has the one box that takes what the taller column has over (`Home.css`): the
 * address on the left, and on the right the calendar or, with a sponsor, the sponsor's box. Both
 * columns end on the same line by construction.
 *
 * **The markup is the order it is seen in, on both layouts** (ADL A7, owner, 21.11.2026: „Kod prati
 * ekran"). From 860px it is the left column and then the right one. Under 860px it is one column and the
 * widgets are written in the order a phone shows them since 31.07.2026: the two boards, the figures of the
 * season, the turning chart, what is next, the address, the sponsor of the day, the calculator (the sponsor
 * between the last two since 18.11.2026). `useTwoColumns` asks the one query the stylesheet splits at, and
 * the stylesheet moves nothing with `order`, so the focus and a screen reader go the way the eye goes
 * (WCAG 2.4.3, 1.3.2). The price, accepted: the widgets are mounted again when a window crosses 860px.
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
 * **Whether there is a sponsor of the day is the server's answer, read once, here**
 * (`GET /api/sponsors`, PDL 24.11.2026), and three things read it: the box of the
 * day, how many races the calendar shows, and the shape of the grid. Without one
 * there is no box, the calendar runs to the bottom of the column and the grid is
 * variant A without the box: one layout, not two (owner, 20.11.2026). The strip is
 * a list of its own on the same answer, since 24.11.2026: the owner gave every
 * sponsor two switches, one for the box and one for the strip („Zelim prekidace i za
 * rotaciju u boksu i za donju liniju"), so a strip with nobody of the day under it,
 * and a sponsor of the day with no strip, are both states the administration can
 * set. The strip is drawn where it has anybody in it.
 */
export function Home() {
  const { t } = useI18n()
  const state = combinePair(
    combineFour(useCompetitors(), useEvents(), useResults(), useRaces()),
    sponsorsOrNobody(useSponsors()),
  )
  const today = useToday()
  const twoColumns = useTwoColumns()

  /* **THE CALCULATOR IS NOT WRITTEN AGAIN WHEN THE PAGE CHANGES ITS COLUMNS** (owner, 21.11.2026: only the
     chosen length and the chart go back to their beginning). It holds what somebody typed in its boxes, and
     those are not a thing to lose by turning a phone: it is drawn once into an element of its own (`held`),
     and the box of the page that stands where it belongs takes that element in (`takeIn`), whichever of the
     two writings of the page is there. The element and what is in it are the same ones before and after, so
     the values, the cursor and the focus stay; a focus that the move itself drops is put back on the same
     box. */
  const [held] = useState(() => {
    const holder = document.createElement('div')

    holder.style.display = 'contents'

    return holder
  })
  const inside = useRef<Element | null>(null)
  const takeIn = useCallback(
    (slot: HTMLElement | null) => {
      if (slot === null) {
        return
      }

      slot.append(held)

      if (inside.current !== null && held.contains(inside.current) && inside.current instanceof HTMLElement) {
        inside.current.focus()
      }
    },
    [held],
  )

  /* And where the focus is in the boxes that ARE written again, which is put back when the writing changes. */
  const remembered = useRef<Remembered | null>(null)

  useLayoutEffect(() => {
    putBack(document, remembered.current)
  }, [twoColumns])
  /* „Tvoj nalog je obrisan.", for the one arrival his own deletion opens this page with (owner, 20.11.2026), in
     the shape the list of teams says „Tim je obrisan." in (`Teams.tsx`, `teamDeleted.ts`). */
  const arrived = useLocation().state
  const [said, setSaid] = useState(() => (accountWasDeleted(arrived) ? t('home.accountDeleted') : ''))

  return (
    <div
      className="home"
      onFocus={(event) => {
        remembered.current = whereIs(event.target)

        if (event.target.closest('.home__calc') !== null) {
          inside.current = event.target
        }
      }}
      onBlur={() => {
        remembered.current = null
        inside.current = null
      }}
    >
      {/* Not shown, but present: the header already says the name in full right
          above, and repeating it was what the owner had removed. A page with no
          h1 at all is still a page a screen reader cannot name. */}
      <h1 className="visually-hidden">{t('app.name')}</h1>

      {said !== '' && <DeletionSaid said={said} clear={setSaid} />}

      <Resource state={state}>
        {([[competitors, events, results, races], { ofTheDay, strip }]) => {
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

          const boards = (
            <div className="home__boards">
              <TopTen competitors={field} results={results} season={season} today={today} gender="M" />
              <TopTen competitors={field} results={results} season={season} today={today} gender="F" />
            </div>
          )
          const chart = (
            <div className="home__chart">
              <TopByCategory competitors={field} results={results} season={view} />
            </div>
          )
          const address = (
            <div className="home__address">
              <President />
            </div>
          )
          const figures = (
            <div className="home__figures">
              <Counters totals={totals} title={label} members={field.length} cities={citiesOf(field)} />
            </div>
          )
          const next = (
            <div className="home__next">
              <CalendarExtract events={events} races={races} today={today} fill={ofTheDay === null} />
            </div>
          )
          const sponsor =
            ofTheDay === null ? null : (
              <div className="home__sponsor">
                <Sponsor sponsor={ofTheDay} />
              </div>
            )
          const calc = <div className="home__calc" ref={takeIn} />

          return (
            <>
              <div
                className={
                  ofTheDay === null
                    ? 'home__split home__split--cols'
                    : 'home__split home__split--cols home__split--sponsored'
                }
              >
                {twoColumns ? (
                  <>
                    <div className="home__colL">
                      {boards}
                      {chart}
                      {address}
                    </div>
                    <div className="home__colR">
                      {figures}
                      {next}
                      {sponsor}
                      {calc}
                    </div>
                  </>
                ) : (
                  <>
                    {boards}
                    {figures}
                    {chart}
                    {next}
                    {address}
                    {sponsor}
                    {calc}
                  </>
                )}
              </div>

              {createPortal(<Calculator />, held)}

              {strip.length > 0 && <SponsorStrip sponsors={strip} />}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
