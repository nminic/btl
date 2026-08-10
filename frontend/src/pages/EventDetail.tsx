import { Link, useParams } from 'react-router'
import { PageMeta } from '../app/PageMeta'
import { useToday } from '../clock/useClock'
import { Resource } from '../components/Resource'
import {
  combinePair,
  useCompetitors,
  useEvents,
  useRaces,
  useResults,
} from '../data/useResource'
import {
  formatDate,
  formatDuration,
  formatNumber,
  formatPoints,
  formatShortDate,
} from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { mineClass } from '../components/mine'
import { useSession } from '../session/useSession'
import { EventActions } from './event/EventActions'
import { EventComments } from './event/EventComments'
import './Profile.css'

/* The races load separately from the event on purpose: the name of the event is
 * useful the moment it arrives, and the race table is the heavier half. The date
 * and the organiser used to be named here too; both came off the head on
 * 06.08.2026. */
function RaceTable({ eventId }: { eventId: string }) {
  const { locale, t } = useI18n()
  const races = useRaces()

  return (
    <Resource state={races} inline label={t('event.races')}>
      {(all) => {
        /* In the order they are run, and told whether that is more than one
           morning. */
        const mine = all
          .filter((race) => race.eventId === eventId)
          .sort(
            (left, right) =>
              left.date.localeCompare(right.date) || left.distanceKm - right.distanceKm,
          )
        const overDays = new Set(mine.map((race) => race.date)).size > 1

        return (
          <div className="table-scroll">
            <table className="table">
              {/* Named, like every other table on the portal. Two tables stand on
                  this screen once anybody has run the event, and a screen reader
                  offered two unnamed ones cannot say which is which. */}
              <caption className="visually-hidden">{t('event.races')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('event.raceName')}</th>
                  {/* The day, drawn only where the event runs over more than one
                      (owner, 10.08.2026). A column of one repeated date under a
                      heading that already says the day is a column that says
                      nothing. */}
                  {overDays && <th scope="col">{t('event.raceDay')}</th>}
                  <th scope="col">{t('event.category')}</th>
                  <th scope="col">{t('event.distance')}</th>
                  <th scope="col" className="table__hide-phone">
                    {t('event.ascent')}
                  </th>
                  <th scope="col" className="table__hide-phone">
                    {t('event.descent')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {mine.map((race) => (
                    <tr key={race.id}>
                      <td>{race.name}</td>
                      {overDays && <td>{formatShortDate(race.date, locale)}</td>}
                      <td>{t(`category.${race.category}`)}</td>
                      <td>{formatNumber(race.distanceKm, locale, 2)}</td>
                      <td className="table__hide-phone">{formatNumber(race.ascentM, locale)}</td>
                      <td className="table__hide-phone">{formatNumber(race.descentM, locale)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )
      }}
    </Resource>
  )
}

/**
 * Who from the league ran here, and how it went.
 *
 * The event used to end at the list of its races, which made it the one screen
 * on the portal that answers a question with a question: a visitor arriving from
 * the calendar to see yesterday's race found the distances and nothing about
 * anybody. PDL P10 asked for this outright ("na svakoj trci u kalendaru se
 * istorijski vidi ko ju je istrčao i sa kojim rezultatom"), and the owner asked
 * for it again on 31.07.2026, from the other end: the name of a race on a
 * profile is a link, and this is what it should lead to.
 *
 * Ordered by points, which is the order that means something in this league. The
 * result carries the address of its event, so this is a filter and not a join
 * through the races.
 *
 * A name is a link only while the membership is live (PDL P11); the name itself
 * stays in the table for every season the person raced, because the history did
 * happen. An event nobody from the league ran gets no section at all rather than
 * a table saying so: for the whole of next season's calendar that sentence would
 * be on every screen and would mean nothing but "not yet".
 */
function EventResults({ slug, date }: { slug: string; date: string }) {
  const { locale, t } = useI18n()
  const today = useToday()
  /* Whoever is reading, so their own result is marked here as their row is in
     every standing (owner, 05.08.2026). Null for a visitor. */
  const { memberNumber: mine } = useSession()
  const state = combinePair(useResults(), useCompetitors())

  /* An event still to be run draws no section here at all, so while its data is
     on its way it must not hold a box open either: the reader would watch a
     space that resolves into nothing, and on a broken connection an alert about
     a section that was never going to be there. The comments at the foot say
     the same thing the same way (event/EventComments.tsx). */
  if (date > today && state.status !== 'ready') {
    return null
  }

  return (
    <Resource state={state} inline label={t('event.results')}>
      {([results, competitors]) => {
        const ran = results
          .filter((one) => one.eventSlug === slug)
          .sort((left, right) => right.points - left.points)

        if (ran.length === 0) {
          /* A race that has not been run yet gets nothing at all: for the whole
             of next season's calendar the sentence would be on every screen and
             would mean only "not yet". A race that has been run and has nobody
             from the league in it is a fact worth saying, and it is the
             difference between the portal being empty and the race being
             unattended. */
          return date > today ? null : (
            <>
              <h2 className="profile__section">{t('event.results')}</h2>
              <p className="profile__empty">{t('event.noResults')}</p>
            </>
          )
        }

        const byNumber = new Map(competitors.map((one) => [one.memberNumber, one]))

        return (
          <>
            <h2 className="profile__section">
              {t('event.results')} <span className="profile__count">{ran.length}</span>
            </h2>

            <div className="table-scroll">
              <table className="table">
                <caption className="visually-hidden">{t('event.results')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('event.competitor')}</th>
                    {/* Both of these used to read "Dužina", one beside the
                        other: `event.distance` is the word too. The results
                        table on a profile has had the answer all along, and it
                        is the kilometres that get the shorter head, because the
                        length is a name and the kilometres are a number.

                        The length goes with the phone columns as well. Left in,
                        the table was three hundred and thirty six pixels inside
                        a box of three hundred and twenty eight, which is the
                        horizontal scroll PDL P24 forbids on a table. */}
                    <th scope="col" className="table__hide-phone">
                      {t('profile.columns.length')}
                    </th>
                    <th scope="col" className="table__hide-phone">
                      {t('profile.columns.distance')}
                    </th>
                    <th scope="col">{t('profile.columns.time')}</th>
                    <th scope="col">{t('profile.columns.points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ran.map((result) => {
                    const person = byNumber.get(result.memberNumber)
                    const name =
                      person === undefined
                        ? result.memberNumber
                        : `${person.firstName} ${person.lastName}`

                    return (
                      /* The rows of whoever is reading, marked as they are in
                         every standing (owner, 05.08.2026; src/components/mine.ts).
                         More than one of them where somebody ran two races of
                         the same event. */
                      <tr key={result.id} className={mineClass(result.memberNumber, mine)}>
                        <td>
                          {person !== undefined && person.active ? (
                            <Link to={`/${locale}/takmicar/${result.memberNumber}`}>{name}</Link>
                          ) : (
                            name
                          )}
                          {mineClass(result.memberNumber, mine) === undefined ? null : (
                            <span className="visually-hidden"> {t('rankings.myRow')}</span>
                          )}
                        </td>
                        <td className="table__hide-phone">
                          {t(`category.${result.category}`)}
                        </td>
                        <td className="table__hide-phone">
                          {formatNumber(result.distanceKm, locale, 2)}
                        </td>
                        <td>{formatDuration(result.seconds)}</td>
                        <td className="table__points">{formatPoints(result.points, locale)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      }}
    </Resource>
  )
}

export function EventDetail() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const events = useEvents()
  /* Read for what it is worth rather than waited for: the buttons at the top of
     the screen must not hold up the name and the date, and the only one that
     needs the races is the copy. */
  const races = useRaces()
  /* For the deletion, which takes what hangs off the event with it. */
  const results = useResults()

  return (
    <Resource state={events}>
      {(all) => {
        const event = all.find((one) => one.slug === slug)

        if (event === undefined) {
          return <h1>{t('event.notFound')}</h1>
        }

        return (
          <>
            {/* An event is shared as a link far more often than it is browsed to,
                so the date goes in the name: a shared link that says only "Trka
                kroz Košutnjak" leaves out the one thing the person needs. */}
            <PageMeta
              title={t('seo.event.recordTitle', {
                name: event.name,
                date: formatDate(event.date, locale),
              })}
              description={t('seo.event.recordDescription', {
                name: event.name,
                city: event.city,
              })}
            />

            <div className="profile">
              {/* The name and what can be done with it, on the row every screen
                  with a control keeps (owner, 05.08.2026; Rankings.css).

                  Three things came off this head on 06.08.2026, all on the
                  owner's word: the way back to the calendar, because the browser
                  already has one; the line reading the date, the city and the
                  status; and the organiser. What is left is the name of the
                  event and the two things a reader can do about it.

                  The buttons wait for the races and the results, and this is not
                  impatience: they act on both. Deleting takes them with it and
                  copying carries them across, and drawn against what had not
                  loaded yet the question said "and 0 of its races", the deletion
                  left every race behind and the copy came across empty. */}
              <header className="profile__head rankings--tooled">
                <h1>{event.name}</h1>
                {races.status === 'ready' && results.status === 'ready' && (
                  <EventActions event={event} races={races.data} results={results.data} />
                )}
              </header>

              <h2 className="profile__section">{t('event.races')}</h2>

              <RaceTable eventId={event.id} />

              <EventResults slug={event.slug} date={event.date} />

              {/* At the foot of the event, which is where the owner put it
                  (06.08.2026): a reader looks at the races and the results
                  first, and what other people thought of it after.

                  Nothing at all before the race, for the reason the results
                  above give: nobody can rate a race that has not been run, so
                  "Za ovaj događaj još nema odobrenih komentara." would stand on
                  every screen of next season's calendar and would mean only
                  "not yet". */}
              <EventComments eventId={event.id} date={event.date} />
            </div>
          </>
        )
      }}
    </Resource>
  )
}
