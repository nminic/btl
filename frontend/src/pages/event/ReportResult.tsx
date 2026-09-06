import { Link, useParams } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import type { RaceKind } from '../../data/types'
import { useFilterParams } from '../../app/useFilterParams'
import { raceLabel } from '../../data/raceLabel'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import { FormRenderer } from '../../forms/FormRenderer'
import { noTime } from '../../forms/clock'
import { reportForm } from './reportForm'
import { reportedResult } from './reportedResult'
import { raceKind } from '../../data/raceKind'
import type { FormValues } from '../../forms/types'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSend, useSent } from '../sent'
import { useSession } from '../../session/useSession'
import { NotRunYet } from './NotRunYet'
import { SignedOut } from '../member/SignedOut'
import '../member/Member.css'


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
/* One sentence per kind, because the sentence says what the portal already knows
   and that is a different thing on each of the three. A record and not a branch, so
   a kind added to `RACE_KINDS` and forgotten here does not compile. What holds the
   three keys to the dictionary is `i18n/said.test.ts`, which sweeps every key the
   portal asks for; `keys.test.ts` walks lists written into it by hand and knows
   nothing of these. */
const NOTE = {
  length: 'report.note',
  time: 'report.noteTime',
  free: 'report.noteFree',
} as const satisfies Record<RaceKind, string>

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
  /* The points the entry earned, once there has been one, held by the address rather
     than by the screen: the way back from this confirmation is the member's own list of
     results, not the form they have already sent (PDL, 05.09.2026). */
  const said = useSent()
  const done = typeof said === 'number' ? said : null
  const confirm = useSend()

  if (memberNumber === null) {
    return <SignedOut />
  }

  const mine = memberNumber

  if (done !== null) {
    return (
      <div className="member" role="status">
        <h1>{t('newResult.doneTitle')}</h1>
        <p>{t('newResult.donePoints', { points: formatPoints(done, locale) })}</p>
        {/* The same sentence on this road, since the same thing may happen to it:
            the administration settles the time at verification. */}
        <p>{t('newResult.pointsNotFinal')}</p>
        <p>{t('newResult.doneWaiting')}</p>
        <p className="member__actions">
          <Link className="button button--primary" to={`/${locale}/moji-rezultati`}>
            {t('newResult.toMine')}
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
            return <NotRunYet />
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
              </>
            )
          }

          /* Narrowed once, for the same reason the event is: the handler below
             runs after the check above and the compiler cannot see that. */
          const race = chosen
          /* Read through the one function that knows the three words, and not off
             the record. The type says `RaceKind`, but the record comes out of a
             file nothing checks, and both of the things chosen by it below are
             written one per kind: a word that is not one of the three gives
             `undefined` from either, and `undefined` handed to the translator or to
             the renderer takes this screen down to the error boundary. Measured
             30.08.2026, and the same reading is what the table of races in the
             administration does (`admin/AdminEvents.tsx`). */
          const kind = raceKind(race.kind)

          function onSubmit(values: FormValues) {
            const run = reportedResult(race, values)

            submit({
              memberNumber: mine,
              /* Read off the race and its event, never asked. This road starts
                 from a row of the calendar, so the portal already knows which of
                 the three kinds the race is and where it is run; the form away
                 from the calendar asks the member exactly because there is no
                 race behind it to ask. */
              raceKind: kind,
              /* And which race, since this road starts from its row. Verification
                 reads the absence of this to know it has to make a race first
                 (owner, 31.08.2026); present, there is nothing to make. */
              raceId: race.id,
              city: event.city,
              country: event.country,
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
              /* What was run, and which of those figures come from the race rather
                 than from the member depends on what the race fixes
                 (`reportedResult.ts`). */
              distanceKm: run.distanceKm,
              ascentM: run.ascentM,
              descentM: run.descentM,
              photo: String(values.photo),
              seconds: run.seconds,
              points: run.points,
              category: run.category,
              /* The address of the official results, asked for here since
                 23.08.2026 exactly as the form outside the calendar asks for it:
                 the owner had the foot of the two forms made the same, „Link ka
                 zvanicnim rezultatima, slika, komentar (i da funkcionise sta je
                 obavezno a sta ne kao do sada)". Until then this form asked for
                 words alone and wrote nothing here. */
              link: String(values.link),
              comment: String(values.comment),
            })

            confirm(`/${locale}/moji-rezultati`, run.points)
          }

          return (
            <>
              <FormRenderer
                form={reportForm(kind)}
                /* Above the fields and under the heading, so the heading is the
                   first thing on the page. Drawn before the form, this note stood
                   ahead of it and the page began without a heading at all (owner,
                   01.09.2026; the third screen of the same shape, found in review
                   04.09.2026 after the first two were closed). */
                above={
                  <p className="member__note">
                    {/* The race said the way every screen on the portal says one: its
                        name, when it was run, and its measure in brackets
                        (`data/raceLabel.ts`). It is the same sentence the chooser used
                        to write into its own list, which is why the helper stays after
                        the chooser has gone.

                        **And the race alone.** Owner, 29.08.2026, asked which of three
                        forms this sentence should take and answered „Nikad događaj,
                        uvek trka." One form everywhere, whether the two names differ or
                        not, and no second form for the case where they do.

                        Why it needed asking: a race's name starts out as its event's,
                        and 886 of the 1163 events that hold any race at all hold exactly
                        one, so on 885 of them the sentence said the same name twice over
                        (Mrazijada is the one race in the file somebody renamed).

                        What that cost, measured in Chrome on 360 by 780 over every one
                        of the 1612 races rather than over the worst of them: the old
                        sentence ran to four lines on 724 and to five on two, and the new
                        one never passes three. So 763 races get a line back and 849 get
                        nothing, which is the honest shape of the gain. An earlier
                        version of this note gave the five-line reading as though it were
                        the ordinary case; it is two races out of 1612.

                        What it costs, in his words as he took it: where a race is named
                        differently from its event, the member no longer sees from this
                        sentence which event it belongs to. He sees it on the page he
                        came from, which is the event's own. */}
                    {t(NOTE[kind], {
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
                }
                /* The third road a time reaches a submission by, and the one that
                   was left out when the rule was written: a race run in no time is
                   not a result (owner, 31.08.2026), and no single box can refuse
                   it because each of the three is right to take nought on its own.
                   Measured in review: 0 / 0 / 0 went through here and reached the
                   queue while the form away from the calendar and the panel in it
                   both turned it away.
                 *
                   **On a timed race there is nothing to ask, because there are no
                   boxes.** This form drops the three of them for that kind
                   (`reportForm.ts`), since the race answers for the time itself, so
                   `fromBoxes` reads nothing at all and `noTime` is true of every
                   such report. Without this half, no result from a timed race
                   could be sent at all. The locking of filled boxes is the other
                   form, the one away from the calendar (`racesToOffer.ts`); it is
                   named here because an earlier note put it on this screen, where
                   it does not happen. */
                alsoRefuses={(values) =>
                  kind === 'time' || !noTime(values) ? undefined : 'newResult.needsTime'
                }
                onSubmit={onSubmit}
              />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
