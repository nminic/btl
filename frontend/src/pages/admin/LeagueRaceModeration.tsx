import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { raceLabel } from '../../data/raceLabel'
import type { League, Race } from '../../data/types'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { countedDaysOf } from './leagueCounted'
import { askTheServer, type Answer } from '../account/askTheServer'
import { WHEN_MODERATING_LEAGUE_RACES } from './leagueWrites'
import '../Leagues.css'

/**
 * WHICH RACES COUNT TOWARDS ONE COMPETITION, AND THE `+` THAT PUTS ONE THERE.
 *
 * **Owner, PDL P15a, 22.09.2026:** „Sve trke su u BTL kalendaru. A u opsege liga ulaze
 * događaji koji postoje u kalendaru. **Mogu ih dodati sa strane lige, preko opcije +, jednu
 * po jednu.** Uzmi u obzir da **mogu dodavati trke u ligu i tokom godine te lige**." And
 * PDL P28b, 24.09.2026: the screen goes with the routes in the same round, „jer bez ekrana
 * liga ne može da se proba, a proba je bila ceo cilj".
 *
 * **A DAY IS A CONVENIENCE AND A RACE IS THE FACT** (owner, 12.09.2026, and V19 is built on
 * it): „selekcijom događaja, selektujem automatski i sve njegove trke, a mogu i samo da
 * selektujem neku od trka." So the chooser asks for a day first and then offers that day
 * whole or one distance of it, and what is sent either way is `POST /api/leagues/{id}/races`
 * with exactly one of the two named.
 *
 * **THIS PANEL DECIDES NOTHING AND THE ROUTE DECIDES EVERYTHING.** Whether a race is of the
 * competition's year and whether the season has frozen are `LeagueWriteApi`'s to answer, and
 * every refusal it names is drawn here as its own sentence rather than folded into
 * „something went wrong". The chooser does narrow the days it offers to the competition's
 * own season, and that is a convenience rather than a rule: a day that got through anyway is
 * refused by the database through `league_race`'s composite keys (V19) and comes back as a
 * sentence saying which.
 *
 * **WHAT IS COUNTED IS NEITHER READ NOR HELD HERE, SINCE 28.09.2026, AND THAT IS THE WHOLE
 * OF WHAT THIS PANEL GAVE UP.** It used to seed a `useState` off the served answer and put
 * every accepted write into that state, which was correct about itself and was a SECOND HOME
 * for a fact the row above was also drawing. The owner met the two halves disagreeing on QA
 * and read it as a competition that had not saved („nista se ne sacuva, nije se kreirala Liga
 * sa ovim dogadjajem", 28.09.2026) - the panel listed four races and the badge beside it said
 * „Bez dogadjaja", because only one of the two homes had heard about the write.
 *
 * So the list arrives as a prop and every change to it is reported back through `onCounted`,
 * inside the branch that ran only because the route said the write went through.
 * `AdminLeagues.tsx` holds it, draws the badge off the same list, and empties the cached
 * answer in the same breath. **One home, reached one way**, which is the sentence this file
 * already used about where the seed comes from and which it was only half keeping.
 *
 * **AND THE STATE SURVIVING THE EDITOR IS PART OF WHY, not a side effect of it.** Opening a
 * competition's form swaps this whole subtree, so a panel that held its own list lost every
 * race entered during that visit the moment somebody pressed „Otvori" and came back - the
 * races were on the server and the panel drew them gone. The screen above is not unmounted by
 * that, so what it holds outlives it.
 *
 * **IT IS HANDED DOWN AND NO LONGER FETCHED OUT OF `data/client.ts`'s CACHE, SINCE
 * 25.09.2026, AND THAT IS A MEASUREMENT.** The seed used to be `arrivedResource('leagues')`,
 * read at every mount out of the module the resource is cached in - and on 25.09.2026 the
 * screen above began CLEARING that very entry once one of its own writes went through
 * (`clearResourceCache('leagues')`). Closing the editor after a save swaps the whole subtree,
 * so every one of these panels mounted again and read an empty cache: a competition that
 * counts races drew „no race has been given to this competition yet", with no control to take
 * one out, while `AdminLeagues` beside it still held the served answer in full. The answer is
 * one home reached one way - the list the screen was served - rather than two readers of one
 * store, one of whom empties it.
 */
export function LeagueRaceModeration({
  league,
  /** Which races this competition counts as the screen above it holds that fact now. */
  counted,
  /**
   * That the route has accepted a change to it, as the change itself rather than as the list
   * it produces.
   *
   * **A function of what was, and not the new list worked out here**, because two presses can
   * be answered between one render and the next: a second press computing its list off the
   * `counted` THIS render was given would write the first press's race back out of it. That
   * is the same reason a `useState` takes an updater, and it is the shape this panel had
   * before the fact moved upstairs.
   */
  onCounted,
}: {
  league: League
  counted: number[]
  onCounted: (change: (was: number[]) => number[]) => void
}) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  /** The day chosen in the first box, and the empty string until somebody chooses one. */
  const [day, setDay] = useState('')
  /** One race of that day, or the empty string, which means the whole of it. */
  const [one, setOne] = useState('')
  /** What the server said about the last press, drawn beneath the form. */
  const [refused, setRefused] = useState<string | null>(null)
  /** What just happened, for whoever is not watching the list. */
  const [said, setSaid] = useState('')

  const panelId = `league-moderation-${league.id}`
  const named = t('admin.leagueRacesOf', { name: league.name })
  const races = useRaces()

  /**
   * The sentence for a refusal the route named.
   *
   * **It probed the dictionary until 25.09.2026 and now reads a table** (`leagueWrites.ts`,
   * `WHEN_MODERATING_LEAGUE_RACES`). The words that come out are the same six; what changes
   * is that there is now something a guard can hold. Probing built the key out of the reason
   * and read a key coming back unchanged as „no words for this", so a reason the server
   * added and a key somebody deleted were ONE answer, and neither could ever be reported.
   * `pages/account/refusals.test.ts` reads the eleven names `LeagueWriteApi` declares and
   * fails on the day a twelfth is written.
   *
   * **The fallback stays exactly as it was**, because it is a real state and not a gap: a
   * screen one release behind its server must say something rather than nothing, and
   * `unknown` is that sentence.
   */
  function sentenceFor(reason: string | null): string {
    const known =
      reason !== null && Object.hasOwn(WHEN_MODERATING_LEAGUE_RACES, reason)
        ? WHEN_MODERATING_LEAGUE_RACES[reason]
        : undefined

    return known === undefined ? t('admin.leagueRefused.unknown') : t(known)
  }

  async function answered(asking: Promise<Answer>, done: () => void): Promise<void> {
    const answer = await asking

    if (answer.got === 'done') {
      setRefused(null)
      done()

      return
    }

    setRefused(sentenceFor(answer.got === 'refused' ? answer.reason : null))
  }

  return (
    <section className="leagues__counting">
      {/* The button inside the heading, which is the shape this portal already gives a box
          that folds (`league/LeagueEvents.tsx`, `admin/PendingQueue.tsx`): a reader working
          by headings still finds the box, and the control they land on is the one that opens
          it. Named after its own competition, because a screen carries several of these and
          four controls reading the same three words are four controls a screen reader cannot
          tell apart (WCAG 2.2 SC 2.4.4). */}
      <h3>
        <button
          type="button"
          className="leagues__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={named}
          onClick={() => setOpen((was) => !was)}
        >
          {t('admin.leagueRaces')}
        </button>
      </h3>

      <div id={panelId} hidden={!open}>
        <Resource state={combinePair(useEvents(), races)} inline label={named}>
          {([events, everyRace]) => {
            /* THE SAME CALL THE BADGE ON THE ROW ABOVE MAKES (`leagueCounted.ts`), so the
               list and the number over it cannot answer differently. Pulled out of this file
               on 28.09.2026 for exactly that: two places grouping one list two ways is how a
               box of four races came to stand under a badge saying „Bez dogadjaja". */
            const listed = countedDaysOf(counted, everyRace, events)
            /* The days this competition may take, which are those of its own season.
               Narrowed on the RACE'S year and not on the event's own day, because an event
               may run over more than one morning (V7) and it is the race's year that
               `league_race`'s key pairs with the competition's. A day with no race at all is
               therefore not offered either, which is the same state the route answers with a
               sentence of its own. */
            const offered = events.filter((event) =>
              everyRace.some(
                (race) => race.eventId === event.id && race.date.startsWith(String(league.season)),
              ),
            )
            const chosen = everyRace.filter((race) => String(race.eventId) === day)

            /** Which races a press just entered: one of them, or a whole day of them. */
            function entered(): number[] {
              return one === '' ? chosen.map((race) => race.id) : [Number(one)]
            }

            async function addToTheLeague(pressed: { preventDefault: () => void }) {
              pressed.preventDefault()

              const asking = one === '' ? { eventId: Number(day) } : { raceId: Number(one) }
              const going = entered()

              await answered(askTheServer(`/api/leagues/${league.id}/races`, asking), () => {
                onCounted((was) => [...new Set([...was, ...going])])
                setSaid(t('admin.leagueRaceAdded'))
                setOne('')
              })
            }

            async function takeOutOfTheLeague(race: Race) {
              const where = `/api/leagues/${league.id}/races/${race.id}`

              await answered(askTheServer(where, {}, 'DELETE'), () => {
                onCounted((was) => was.filter((kept) => kept !== race.id))
                setSaid(t('admin.leagueRaceDropped'))
              })
            }

            return (
              <>
                {listed.length === 0 ? (
                  <p className="profile__empty">{t('leagues.noCounting')}</p>
                ) : (
                  <ul className="leagues__events">
                    {listed.map(({ event, races: run }) => (
                      <li key={event.id}>
                        <h4 className="leagues__event-name">{event.name}</h4>
                        <p className="leagues__event-day">{formatShortDate(event.date, locale)}</p>

                        <ul className="leagues__event-races">
                          {run.map((race) => (
                            /* THE NAME AND THE CONTROL AS TWO PARTS OF A ROW, so the controls
                               stand in a column (owner, 28.09.2026). Written as one run of text
                               with a button after it, each button began wherever its race's name
                               and distance happened to end, which on a day of four distances is
                               four different places. The class is on the item and not on the
                               list, because `.leagues__event-races` is also what the public
                               competition page draws its races in (`league/LeagueEvents.tsx`),
                               and nothing there has a control to line up. */
                            <li key={race.id} className="leagues__counted-race">
                              <span>{raceLabel(race, run, locale)}</span>
                              {/* The words on the button are short and the name adds the
                                  race, which is how this portal already names a control that
                                  repeats - and the visible words are the first part of the
                                  name, which is what SC 2.5.3 asks. */}
                              <button
                                type="button"
                                className="button button--secondary"
                                aria-label={t('admin.dropRaceNamed', {
                                  race: raceLabel(race, run, locale),
                                })}
                                onClick={() => void takeOutOfTheLeague(race)}
                              >
                                {t('admin.dropRace')}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}

                {offered.length === 0 ? (
                  <p className="profile__empty">
                    {t('admin.noEventsOfSeason', { season: league.season })}
                  </p>
                ) : (
                  <form className="leagues__adding" onSubmit={(press) => void addToTheLeague(press)}>
                    {/* THE SHAPE EVERY OTHER CHOICE ON THIS PORTAL WEARS, AND IT IS COPIED
                        RATHER THAN INVENTED (owner, 28.09.2026: „zasto su dropdowns ovako
                        nakaradni?"). These two were a bare `<label>` beside a bare `<select>`,
                        so the browser drew its own control - white on the portal's dark ground,
                        in the browser's own font, unlike the twenty-eight other fields on the
                        portal. `.rankings__field` is what administration already dresses a
                        chooser in: the queue of proposals puts a country `select` in one
                        (`admin/PendingQueue.tsx`), and the members, the events, the payments and
                        the review queue each put their own control in one. The sheet is already
                        asked for by the one this screen imports (`Leagues.css` opens with
                        `@import 'Rankings.css'`), so nothing new is loaded and nothing under
                        `forms/` is touched. */}
                    <div className="rankings__field">
                      <label htmlFor={`${panelId}-event`}>{t('admin.chooseEvent')}</label>
                      <select
                        id={`${panelId}-event`}
                        value={day}
                        onChange={(typed) => {
                          setDay(typed.target.value)
                          setOne('')
                        }}
                      >
                        <option value="">{t('admin.chooseNothing')}</option>
                        {offered.map((event) => (
                          <option key={event.id} value={String(event.id)}>
                            {event.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rankings__field">
                      <label htmlFor={`${panelId}-race`}>{t('admin.chooseRace')}</label>
                      <select
                        id={`${panelId}-race`}
                        value={one}
                        onChange={(typed) => setOne(typed.target.value)}
                      >
                        {/* The whole day first, because it is the owner's own shortcut and it
                            writes every race of that day (V19). */}
                        <option value="">{t('admin.wholeEvent')}</option>
                        {chosen.map((race) => (
                          <option key={race.id} value={String(race.id)}>
                            {raceLabel(race, chosen, locale)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button type="submit" className="button" disabled={day === ''}>
                      {t('admin.addRace')}
                    </button>
                  </form>
                )}

                {refused === null ? null : (
                  <p role="alert" className="entity-row-note">
                    {refused}
                  </p>
                )}

                {/* Said once and politely: the list beside it has already changed, and a
                    reader who is not looking at it gets the one sentence that says so. */}
                <p aria-live="polite" className="visually-hidden">
                  {said}
                </p>
              </>
            )
          }}
        </Resource>
      </div>
    </section>
  )
}
