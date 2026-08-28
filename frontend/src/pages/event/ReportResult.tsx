import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { btlPoints } from '../../data/scoring'
import { useFilterParams } from '../../app/useFilterParams'
import { raceLabel } from '../../data/raceLabel'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import { FormRenderer } from '../../forms/FormRenderer'
import { prijava } from '../../forms/definitions'
import type { FormValues } from '../../forms/types'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { NotRunYet } from './NotRunYet'
import { SignedOut } from '../member/SignedOut'
import '../member/Member.css'

/** Hours, minutes and seconds are all required by the definition, so there is
 *  nothing here to fall back to. */
function seconds(values: FormValues): number {
  return Number(values.hours) * 3600 + Number(values.minutes) * 60 + Number(values.seconds)
}


/**
 * A result reported from the event it was run at.
 *
 * The portal already had a form for this and it began by asking which event,
 * then the date, then the distance, the climb and the descent, all of which the
 * portal knows: they are on the race. Somebody who has just run reads the event,
 * presses one thing and types a time (owner, 03.08.2026).
 *
 * So the race is a choice out of that event's races and nothing else is asked
 * for except the time, a note, and a photograph if they have one. The note is
 * where the link to the official results goes, and it is deliberately free text
 * rather than a field called "link": a member has a screenshot, a start number,
 * an official list, or a sentence about a watch that stopped, and a form that
 * takes only a URL takes none of the other four.
 *
 * The distance, the climb and the descent come off the race, which is what makes
 * this shorter and also what makes it right: those are official data, announced
 * in the terms rather than argued case by case, and a moderator corrects them on
 * the race rather than on one member's entry.
 */
export function ReportResult() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  /* Through the shared hook and not through the router's own, which is the
     rule the whole application keeps (app/filterParams.test.ts). Reading is
     all this does; the address is written by the row that leads here. */
  const [params] = useFilterParams()
  const today = useToday()
  const { memberNumber, submit } = useSession()
  const state = combinePair(useEvents(), useRaces())
  /** The points the entry earned, once there has been one. */
  const [done, setDone] = useState<number | null>(null)

  if (memberNumber === null) {
    return <SignedOut />
  }

  const mine = memberNumber

  if (done !== null) {
    return (
      <div className="member" role="status">
        <h1>{t('newResult.doneTitle')}</h1>
        <p>{t('newResult.donePoints', { points: formatPoints(done, locale) })}</p>
        <p>{t('newResult.doneWaiting')}</p>
        <p className="member__actions">
          <Link className="button button--primary" to={`/${locale}/moji-rezultati`}>
            {t('newResult.toMine')}
          </Link>{' '}
          <Link className="button button--secondary" to={`/${locale}/kalendar/${slug}`}>
            {t('report.backToEvent')}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="member">
      <Resource state={state}>
        {([events, races]) => {
          const found = events.find((one) => one.slug === slug)

          if (found === undefined) {
            return <h1>{t('event.notFound')}</h1>
          }

          /* Narrowed once, because the handler below is written inside a
             callback the compiler cannot see runs after the check. */
          const event = found

          /* The same rule the rating keeps, and for the same reason: PDL P9
             refuses a date in the future, and a form that is merely not offered
             still answers when the address is typed. */
          if (event.date > today) {
            return <NotRunYet slug={event.slug} />
          }

          /* The races of this event that have been run, which is not the same as
             the races of an event that has begun (owner, 11.08.2026): a race
             carries its own day, and an event may run over two mornings. On the
             Saturday of a weekend the two Saturday races can be reported; on the
             Sunday all three.

             A race has no time of day, so the day it is on counts from its own
             morning: „rezultat na trku moguće uneti na kalendarski dan te trke
             ili kasnije". */
          const here = races.filter((race) => race.eventId === event.id)
          const mineHere = here.filter((race) => race.date <= today)
          /* Which of them, decided by the row the reader pressed rather than by a
             field at the top of this form (owner, 23.08.2026: „ne treba onda ni
             dropdown na vrhu za izbor trke nego to zavisi od reda iz kog je
             kliknuto"). The address carries it, so the form opens knowing.

             Nothing is guessed where the address names none or names one this
             event has not run. The one way in writes it (EventDetail.tsx), so an
             address without it was typed by hand, and a form that quietly picked
             a race would file somebody's time against a distance they never ran. */
          const chosen = mineHere.find((race) => race.id === params.get('trka'))

          if (chosen === undefined) {
            return (
              <>
                <h1>{event.name}</h1>
                <p className="profile__empty">
                  {t(mineHere.length === 0 ? 'report.noRaces' : 'report.noRace')}
                </p>
                <p className="member__actions">
                  <Link className="button button--secondary" to={`/${locale}/kalendar/${slug}`}>
                    {t('report.backToEvent')}
                  </Link>
                </p>
              </>
            )
          }

          /* Narrowed once, for the same reason the event is: the handler below
             runs after the check above and the compiler cannot see that. */
          const race = chosen

          function onSubmit(values: FormValues) {
            const total = seconds(values)
            const earned = btlPoints(race.distanceKm, race.ascentM, race.descentM, total) ?? 0

            submit({
              memberNumber: mine,
              /* The race, not the event it is run at. The field was renamed and the
                 value was left behind, so a race the administrator had called
                 „Beogradski polumaraton" reached the moderator as „Beogradski
                 maraton", on two of the three screens the owner named. Measured
                 23.08.2026, and nothing in the package saw it because every race in
                 the file carries its event's name. */
              raceName: race.name,
              /* The race's day and not the event's, for the same reason the name
                 beside it is the race's. An event may run over several mornings
                 (PDL P10) and the event's own day is the first of them, so a
                 result reported from the second morning of a two day event was
                 filed on the first: the race carries the day it is run on
                 (`data/types.ts`), and that is the day somebody ran. */
              date: race.date,
              /* Off the race, not off the member. These are the official figures
                 and a moderator corrects them on the race itself, where the
                 correction reaches everybody who ran it. */
              distanceKm: race.distanceKm,
              ascentM: race.ascentM,
              descentM: race.descentM,
              photo: String(values.photo),
              seconds: total,
              points: earned,
              category: race.category,
              /* The address of the official results, asked for here since
                 23.08.2026 exactly as the form outside the calendar asks for it:
                 the owner had the foot of the two forms made the same, „Link ka
                 zvanicnim rezultatima, slika, komentar (i da funkcionise sta je
                 obavezno a sta ne kao do sada)". Until then this form asked for
                 words alone and wrote nothing here. */
              link: String(values.link),
              comment: String(values.comment),
            })

            setDone(earned)
          }

          return (
            <>
              <p className="member__note">
                {/* The race said the way every screen on the portal says one:
                    its name and its length, and its day where two of them share
                    both (data/raceLabel.ts). It is the same sentence the chooser
                    used to write into its own list, which is why the helper stays
                    after the chooser has gone. */}
                {t('report.note', {
                  event: event.name,
                  /* Among **all** the races of the event and not only the run
                     ones, because that is what the table on the event says
                     (EventDetail.tsx) and a race must not change its name between
                     the row somebody pressed and the form it opened. Measured on
                     23.08.2026: the row read „42,2 km, 14. 3. 2022." and the form
                     said „42,2 km", which is two names for one race in two steps
                     of one flow. */
                  race: raceLabel(race, here, locale),
                })}
              </p>

              <FormRenderer form={prijava} onSubmit={onSubmit} />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
