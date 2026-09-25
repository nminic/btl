import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { raceLabel } from '../../data/raceLabel'
import type { League, Race } from '../../data/types'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { racesByEvent } from '../league/leagueCounting'
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
 * **WHAT IS COUNTED IS READ OFF THE ANSWER AND THEN KEPT HERE.** A screen that is still
 * mounted never asks its resource again, so after a write there is nothing to re-read: what
 * is held is what the server has just accepted. What it starts from is `raceIds` on the
 * served competition, handed down by the screen that is holding that answer
 * (`AdminLeagues.tsx`, through `leagueCounted.ts`, which says why the field is read off the
 * answer rather than off the shared type).
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
  /**
   * Which races the served answer says this competition counts.
   *
   * **Read once, as this mounts, exactly as it was before it became a prop.** What comes
   * after is this panel's own: a race entered or taken out is put in below, inside the branch
   * that ran only because the route said the write went through.
   */
  counted: whenItMounted,
}: {
  league: League
  counted: number[]
}) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [counted, setCounted] = useState<number[]>(whenItMounted)
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
            const mine = everyRace.filter((race) => counted.includes(race.id))
            const listed = racesByEvent(mine, events)
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
                setCounted((was) => [...new Set([...was, ...going])])
                setSaid(t('admin.leagueRaceAdded'))
                setOne('')
              })
            }

            async function takeOutOfTheLeague(race: Race) {
              const where = `/api/leagues/${league.id}/races/${race.id}`

              await answered(askTheServer(where, {}, 'DELETE'), () => {
                setCounted((was) => was.filter((kept) => kept !== race.id))
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
                            <li key={race.id}>
                              {raceLabel(race, run, locale)}{' '}
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
