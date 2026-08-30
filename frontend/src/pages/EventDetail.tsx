import { profilePath } from './profileAddress'
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
import { raceLabel, raceMeasure } from '../data/raceLabel'
import { outsideHost, outsideLink } from '../data/outsideLink'
import type { Race, BtlEvent } from '../data/types'
import { useSession } from '../session/useSession'
import { EventActions } from './event/EventActions'
import { GoingToEvent } from './event/GoingToEvent'
import { OverallMark } from './event/OverallMark'
import { EventComments } from './event/EventComments'
import '../styles/outsideLink.css'
import './Profile.css'

/* The races load separately from the event on purpose: the name of the event is
 * useful the moment it arrives, and the race table is the heavier half. The date
 * and the organiser used to be named here too; both came off the head on
 * 06.08.2026. */
function RaceTable({ event }: { event: BtlEvent }) {
  const { locale, t } = useI18n()
  const races = useRaces()
  const today = useToday()
  const { memberNumber } = useSession()

  return (
    <Resource state={races} inline label={t('event.races')}>
      {(all) => {
        /* In the order they are run, and told whether that is more than one
           morning. */
        const mine = all
          .filter((race) => race.eventId === event.id)
          .sort(
            (left, right) =>
              left.date.localeCompare(right.date) || left.distanceKm - right.distanceKm,
          )
        const overDays = new Set(mine.map((race) => race.date)).size > 1

        /* The way into the form, one per race, for whoever is signed in (owner,
           23.08.2026). It replaces the one button that stood over the table and
           asked which race afterwards: the row already knows.

           A race that has not been run yet gets no button, and a whole event of
           them gets no column. PDL P9 refuses a result dated in the future, and
           a race carries its own day, so on the Saturday of a weekend the two
           Saturday races can be reported and the Sunday one cannot. A column of
           empty cells would say the opposite. */
        const canEnter = (race: Race) => memberNumber !== null && race.date <= today
        const options = mine.some(canEnter)
        /* Four that are always there: the name, the length, the climb and the fall.
           The day is a fifth on an event that runs over more than one morning, and the
           way in a sixth for somebody who may report a result.

           It was five for a few hours, when the name arrived and the category was
           still here, and a round measured what a seventh column costs this table:
           the floor that keeps a date unbroken is 6,75rem, so seven of them ask for
           756px of a box that is 653 at 700px and 721 at 768. The column that fell
           outside was the one holding „Unesi rezultat", and nothing on the screen said
           it was cut. The owner's answer was to take the category out here (23.08.2026),
           which this table can afford: the length stands beside it and the category is
           read off the length. The same column goes from the administration too, but
           in its own delivery; this one is only about the public page.

           Written by hand three lines from the headings it counts, and that too was
           measured: with the two disagreeing the table drew five columns in the width
           of four and ended 253px short of the edge. */
        const columns = (overDays ? 1 : 0) + 4 + (options ? 1 : 0)
        /* How many the fullest reading of this same event would have, which is what a
           column's share of the box is worked out from: „tabela ostaje kraća za tu
           kolonu, pa se prethodne četiri završavaju gde i kad ih ima 5" (owner,
           23.08.2026).

           The share used to be a fifth written into the stylesheet, and a round
           measured what that cost once the count could reach six: on an event over two
           mornings the visitor's five columns and the member's six were both the whole
           box, so nothing stayed where it was and the first column moved by up to
           35,59px. Worked out here, beside the count it belongs to, there is one place
           that knows how many columns this table can have. */
        const full = (overDays ? 1 : 0) + 5

        return (
          <div className="table-scroll">
            {/* Five columns of one width, and four of that same width where the
                last one is not drawn (owner, 23.08.2026: „a treba da ima 5 kolona
                jednake sirine", and without the options „tabela ostaje kraca za
                tu kolonu"). The count rides on the element because only the
                render knows it; the sheet turns it into a width (Profile.css). */}
            <table
              className="table table--races"
              style={{ '--race-columns': columns, '--race-full': full }}
            >
              {/* Named, like every other table on the portal. Two tables stand on
                  this screen once anybody has run the event, and a screen reader
                  offered two unnamed ones cannot say which is which.

                  It is the only name the table has since 23.08.2026: the heading
                  „TRKE" over it went on the owner's word, and a caption says the
                  same thing to a screen reader without a second line of type. */}
              <caption className="visually-hidden">{t('event.races')}</caption>
              <thead>
                <tr>
                  {/* The day, drawn only where the event runs over more than one
                      (owner, 10.08.2026). A column of one repeated date under a
                      heading that already says the day is a column that says
                      nothing. */}
                  {/* The name first, because it is what a race is read by since
                      isporuka 121: „u opisu događaja gde su izlistane trke nedostaje
                      naziv trke u prvoj koloni" (owner, 23.08.2026). Every race in
                      the file is named after its event, so this column repeats the
                      heading above it until somebody renames one, which is exactly
                      what the name is for. */}
                  <th scope="col">{t('event.raceName')}</th>
                  {overDays && <th scope="col">{t('event.raceDay')}</th>}
                  {/* „Mera" and not „Dužina" since 30.08.2026, on the owner's word:
                      a race of a length is measured by its length, a timed race by
                      how long it lasts, and a free race by nothing until somebody
                      has run it, so a heading that says „Dužina" is untrue of two of
                      the three kinds. He was offered the two ways of closing that
                      and took this one; the other was for the first column to write
                      the race's full name, which repeats the year on every row of a
                      table already standing under one event.

                      Only this table. The table of results below is a table of runs
                      that happened, and every one of those has a length, so the word
                      there stays what it was. */}
                  <th scope="col">{t('event.measure')}</th>
                  <th scope="col" className="table__hide-phone">
                    {t('event.ascent')}
                  </th>
                  <th scope="col" className="table__hide-phone">
                    {t('event.descent')}
                  </th>
                  {options && <th scope="col">{t('event.options')}</th>}
                </tr>
              </thead>
              <tbody>
                {mine.map((race) => (
                    <tr key={race.id}>
                      <td>{race.name}</td>
                      {overDays && <td>{formatShortDate(race.date, locale)}</td>}
                      {/* What the race is measured by, from the one place that
                          answers that (`data/raceLabel.ts`): its length, how long
                          it lasts, or nothing at all.

                          Empty for a free race and not „0,00". The grid of a
                          competition settled that shape on 31.07.2026: a race
                          somebody did not run is an empty cell and not a nought,
                          „jer nula tvrdi da je trčao i osvojio nula". A nought here
                          says the same untrue thing, that somebody measured this
                          course and it came to nothing.

                          Two decimals, which is finer than the name of a race
                          writes. That difference is not decoration: `raceLabel`
                          parts two races of one name on one morning by the finer
                          reading and says so, and it says so about this table. */}
                      <td>
                        {raceMeasure(race, locale, 2)}
                      </td>
                      <td className="table__hide-phone">{formatNumber(race.ascentM, locale)}</td>
                      <td className="table__hide-phone">{formatNumber(race.descentM, locale)}</td>
                      {options && (
                        <td>
                          {canEnter(race) && (
                            /* A link and not a button, like everything else on
                               the portal that leads somewhere. The race rides in
                               the address, which is what lets the form stop
                               asking which one it was. */
                            <Link
                              className="button button--secondary button--compact"
                              /* Named by the race it leads to, because three of
                                 these stand in one table and „Unesi rezultat"
                                 three times over is one entry said three times in
                                 a screen reader's list of links (WCAG 2.2 SC
                                 2.4.4). The row does not name itself: it has no
                                 `th`, so nothing else tells them apart. Said the
                                 way every screen says a race, by its name and its
                                 length (data/raceLabel.ts). */
                              aria-label={t('event.enterResultNamed', {
                                race: raceLabel(race, mine, locale),
                              })}
                              to={`/${locale}/kalendar/${event.slug}/prijava?trka=${race.id}`}
                            >
                              {t('event.enterResult')}
                            </Link>
                          )}
                        </td>
                      )}
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
                            <Link to={profilePath(person, locale)}>{name}</Link>
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
                {/* What everybody thought of this race, in one place and only
                    here (owner, 11.08.2026). It draws nothing until it has
                    something to say, so it never moves the name under the
                    reader's eye. */}
                <OverallMark eventId={event.id} />
                {races.status === 'ready' && results.status === 'ready' && (
                  <EventActions event={event} races={races.data} results={results.data} />
                )}
              </header>

              {/* What the organiser says this race is, and where they say the
                  rest of it. Both were asked for on the form and carried onto a
                  copy from that same day, and until now no screen drew either, so
                  an address that could not be opened was a record rather than a
                  link. Owner, 23.08.2026, on what an event's page shows: it
                  „pokazuje detalje, opis i link ka strani organizatora ako
                  postoji, ali bez trka" for a gathering, which is the sentence
                  that puts both of them above the table rather than under it.

                  Prose and not a heading, because a heading over one paragraph is
                  a label on a thing that names itself; the owner took the heading
                  off the table below for the same reason.

                  Empty draws nothing at all, which is what „ako postoji" means and
                  is also the ordinary case: neither field is required, and no
                  event in the file carries either. */}
              {event.description !== '' && <p className="event__said">{event.description}</p>}

              {/* And the address, asked of the store again rather than taken on
                  trust from the form that stored it (`data/outsideLink.ts` says
                  why both ask). Anything that is not an address this portal is
                  willing to hand a browser draws nothing, exactly as an event that
                  carries none does: a repaired address is one nobody wrote.

                  The host beside the words, because the words here are the
                  portal's own and so say nothing about where the press lands, and
                  because this link leaves the site. Inside the anchor, so it is
                  read with the link rather than after it. */}
              {outsideLink(event.link) !== undefined && (
                <p className="event__where">
                  <a
                    href={outsideLink(event.link)}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    {t('event.organiserPage')}
                    <span className="outside-host">{outsideHost(event.link)}</span>
                  </a>
                </p>
              )}

              {/* No heading over it since 23.08.2026 (owner: „Naslov TRKE ne
                  treba da postoji"). The table names itself in a caption a
                  screen reader reads and nobody sees.

                  And nothing at all for a gathering or a training, which have no
                  races (owner, 23.08.2026): such an event „i dalje stoji u
                  kalendaru, može se otvoriti, i pokazuje detalje, opis i link ka
                  strani organizatora ako postoji, ali bez trka". Measured by a
                  round before this line was here: a gathering drew a table with
                  four headings and no rows, which is exactly the „a race whose
                  distances nobody has entered yet" that its tile was given its own
                  colour to deny, so the tile and the page said opposite things. */}
              {event.kind === 'race' && <RaceTable event={event} />}

              <EventResults slug={event.slug} date={event.date} />

              {/* Who is going, ahead of the race and for members only (owner,
                  11.08.2026). Under the results and over the comments: what is
                  still to come, then what was said about what has been. */}
              <GoingToEvent event={event} />

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
