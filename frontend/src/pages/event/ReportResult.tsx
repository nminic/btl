import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { btlPoints } from '../../data/scoring'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import { FormRenderer } from '../../forms/FormRenderer'
import prijava from '../../forms/definitions/prijava-sa-trke.form.json'
import type { FormDef, FormValues } from '../../forms/types'
import { formatDistance, formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { NotRunYet } from './NotRunYet'
import { raceFor } from './raceFor'
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
             Saturday of a weekend the form offers the two Saturday races; on the
             Sunday it offers all three.

             A race has no time of day, so the day it is on counts from its own
             morning: „rezultat na trku moguće uneti na kalendarski dan te trke
             ili kasnije". */
          const mineHere = races.filter(
            (race) => race.eventId === event.id && race.date <= today,
          )
          /* The first of them is the one the form opens on, which is what the
             owner asked for: most events hold one race, and where they hold five
             the member changes it in one press. Taken apart rather than indexed,
             so the empty case is the one the screen already answers. */
          const [first, ...rest] = mineHere

          if (first === undefined) {
            /* An event with no races run yet is not a thing to report a result
               on, and a form whose one choice is empty is a form that cannot be
               submitted and does not say why. Two ways to get here: an event
               whose distances are not entered yet, and one whose first morning
               has not come. */
            return (
              <>
                <h1>{event.name}</h1>
                <p className="profile__empty">{t('report.noRaces')}</p>
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
          const opened = first

          function onSubmit(values: FormValues) {
            const race = raceFor([opened, ...rest], String(values.raceId), opened)
            const total = seconds(values)
            const earned = btlPoints(race.distanceKm, race.ascentM, race.descentM, total) ?? 0

            submit({
              memberNumber: mine,
              eventName: event.name,
              date: event.date,
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
              /* No address: this form asks for words. What the member wrote
                 goes in the field for words, because the queue draws the link
                 as a link and a sentence in an `href` is an address made of
                 somebody's sentence. */
              link: '',
              comment: String(values.comment),
            })

            setDone(earned)
          }

          return (
            <>
              <p className="member__note">
                {t('report.note', { event: event.name })}
              </p>

              <FormRenderer
                form={prijava as FormDef}
                initial={{ raceId: opened.id }}
                options={{
                  raceId: mineHere.map((race) => ({
                    value: race.id,
                    /* Its length, which is what tells two races of one event
                       apart: a race has no name of its own (data/types.ts), and
                       the event is already the page this form was opened from.
                       `labelKey` takes a key and falls back to what it is given
                       when there is no such key, which is what puts a value into
                       a list of choices (src/i18n/translate.ts). */
                    labelKey: formatDistance(race.distanceKm, locale),
                  })),
                }}
                onSubmit={onSubmit}
              />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
