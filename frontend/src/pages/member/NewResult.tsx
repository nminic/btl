import { useMemo, useState } from 'react'
import { useFilterParams } from '../../app/useFilterParams'
import { Link } from 'react-router'
import { FormRenderer } from '../../forms/FormRenderer'
import { unosRezultata } from '../../forms/definitions'
import type { FormValues } from '../../forms/types'
import { fieldDate, storedDate } from '../../forms/dateField'
import { categoryOf } from '../../data/raceCategory'
import type { BtlEvent, Race, Result } from '../../data/types'
import type { Suggestion } from '../../forms/types'
import { RESULTS, useEvents, useRaces, useResults } from '../../data/useResource'
import { useToday } from '../../clock/useClock'
import { btlPoints } from '../../data/scoring'
import { formatDistance, formatNumericDate, formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import type { Submission } from '../../session/context'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
import './Member.css'

/**
 * A refused result written back into the fields it was entered in.
 *
 * The other way round from `seconds` below: the form asks for hours, minutes and
 * seconds and the record keeps one number, and a member correcting a link is not
 * to be made to type the whole race again (owner, 06.08.2026).
 */
/**
 * A result that has already been counted, put back into the form.
 *
 * The two proofs are deliberately left empty. A counted result carries none: the
 * picture is deleted once the decision is made (ADL A12) and the link was the
 * moderator's to read at the time. And the whole point of changing one is that
 * new proof comes with it (owner, 27.08.2026: „menja i dostavlja dokaz za tu
 * izmenu"), so seeding the boxes with anything would be seeding them with
 * something that proves nothing.
 */
function filledFromCounted(one: Result): FormValues {
  return {
    raceName: one.raceName,
    date: fieldDate(one.date),
    distanceKm: String(one.distanceKm),
    ascentM: String(one.ascentM),
    descentM: String(one.descentM),
    hours: String(Math.floor(one.seconds / 3600)),
    minutes: String(Math.floor((one.seconds % 3600) / 60)),
    seconds: String(one.seconds % 60),
    link: '',
    photo: '',
    comment: '',
  }
}

function filledFrom(one: Submission): FormValues {
  return {
    raceName: one.raceName,
    date: fieldDate(one.date),
    distanceKm: String(one.distanceKm),
    ascentM: String(one.ascentM),
    descentM: String(one.descentM),
    hours: String(Math.floor(one.seconds / 3600)),
    minutes: String(Math.floor((one.seconds % 3600) / 60)),
    seconds: String(one.seconds % 60),
    link: one.link,
    photo: one.photo,
    /* And what they said about the race, which this left out while returning the
       picture beside it. PDL P9 binds the two as a pair, „dva neobavezna polja,
       ista na oba puta prijave: slika i komentar", and a correction is the one
       submission where those words matter most: the refusal is usually about the
       link, and the comment is what explains it. Left out, the member reopened
       the form, saw the sentence gone, and sending the correction wiped it from
       the moderator's card as well, because a correction is the same submission
       written over (session/SessionProvider.tsx). */
    comment: one.comment,
  }
}

/**
 * The races the calendar already holds, offered while an event name is typed
 * (owner, 23.08.2026).
 *
 * Only what has been run, and newest first: „U autocomplete se navode samo
 * dogadjaji koji su u proslosti ili na taj dan, ne ubuduce", sorted „po datumu od
 * poslednje prema ranijim". A race still to come is not a result anybody can
 * enter (PDL P9 refuses a date in the future), so offering it would be offering a
 * row the form then refuses.
 *
 * One entry per race and not per event, because what is filled in is a race: an
 * event of five distances is five rows, told apart by the day and the length,
 * which is what the row says after the name.
 *
 * The races are grouped once rather than searched for each event, because the
 * data is eleven hundred events against sixteen hundred races and this is built
 * on every letter typed until it is memoised.
 */
function racesToOffer(
  events: BtlEvent[],
  races: Race[],
  today: string,
  locale: string,
): Suggestion[] {
  const byEvent = new Map<string, Race[]>()

  for (const race of races) {
    byEvent.set(race.eventId, [...(byEvent.get(race.eventId) ?? []), race])
  }

  const pairs = events.flatMap((event) =>
    (byEvent.get(event.id) ?? [])
      .filter((race) => race.date <= today)
      .map((race) => ({ event, race })),
  )

  pairs.sort((left, right) => right.race.date.localeCompare(left.race.date))

  return pairs.map(({ race }) => ({
    id: race.id,
    /* The **race** is what is searched for and what goes into the box, since
       23.08.2026: „sad je postalo logičnije da se pretražuje zapravo naziv trke sa
       datumom i dužinom" (owner). Until that day a race had no name of its own and
       the event's stood in for it.

       Only the name goes into the box (owner: „u polje se upisuje samo naziv").
       The day and the length are what one race of an event is told apart from
       another by, and they go into the fields under it rather than into the
       name. */
    value: race.name,
    said: `${race.name} – ${formatNumericDate(race.date)} – ${formatDistance(race.distanceKm, locale)}`,
    fills: {
      date: fieldDate(race.date),
      distanceKm: String(race.distanceKm),
      ascentM: String(race.ascentM),
      descentM: String(race.descentM),
    },
  }))
}

/** Hours, minutes and seconds are all required by the form definition, so
 *  there is nothing here to fall back to. */
function seconds(values: FormValues): number {
  return Number(values.hours) * 3600 + Number(values.minutes) * 60 + Number(values.seconds)
}

export function NewResult() {
  const { locale, t } = useI18n()
  const { memberNumber, submissions, submit, resubmit, remove } = useSession()
  /**
   * What the last entry earned and whether it was a correction, once there has
   * been one.
   *
   * Both together, because the second cannot be worked out afterwards: sending a
   * correction puts the result back to waiting, so the refused result the
   * address named is no longer refused and the screen would say the ordinary
   * thing about it.
   */
  const [done, setDone] = useState<{ points: number; again: boolean } | null>(null)
  /**
   * The refused result this is a correction of, where the address names one.
   *
   * Carried in the address because a screen cannot be told anything else, the
   * same way the administration opens an event by address. Read against the
   * member signed in, so a number typed into the address bar opens nobody else's
   * result.
   */
  const [params] = useFilterParams()
  const today = useToday()
  const events = useEvents()
  const results = useResults()
  const races = useRaces()
  /* Built once for the data rather than on every letter typed: the list is the
     whole calendar read through one date, and it does not change while somebody
     is typing into the box above it. Empty until both files are here, which is
     what the form shows for the first moment it is on screen. */
  const offered = useMemo(
    () =>
      events.status === 'ready' && races.status === 'ready'
        ? racesToOffer(events.data, races.data, today, locale)
        : [],
    [events, races, today, locale],
  )
  const again = params.get('ponovo')
  /* The other way in: a result that has already been counted, which a member may
     change by sending it back through the queue with new proof (owner,
     27.08.2026). A different word in the address because it is a different thing:
     `ponovo` names a submission that is still in the queue, this names a result
     that has left it. */
  const fixing = params.get('ispravka')
  /* One that was sent back, or one still waiting: both are the member's to
     change (owner, 27.08.2026), and neither is one that has been approved. The
     road in is the same address either way, so what decides is the state of the
     result rather than which button was pressed to get here.

     Still their own, which is the half that must not be dropped: the identity is
     read out of the address, so without this anybody could open somebody else's
     result by typing its number. */
  const correcting = submissions.find(
    (one) => one.id === again && one.memberNumber === memberNumber && one.status !== 'approved',
  )
  /* And the counted one this is a correction of, read the same way and against
     the same member: an identity out of the address opens nobody else's result.
     Read through the overlay, so a result taken back a moment ago is not offered
     for changing. */
  const counted = results.status === 'ready' ? results.data : []
  const fixingOne = counted.find((one) => one.id === fixing && one.memberNumber === memberNumber)
  /* Whichever of the two this is, when it is either: the race is read off the
     record on both roads in, and one name for that saves the next reader from
     having to notice that there are two. */
  const named = correcting ?? fixingOne

  if (memberNumber === null) {
    return <SignedOut />
  }

  /** Who is signed in, held once. The check above narrows it and a function
   *  written below does not see that narrowing. */
  const me = memberNumber

  function onSubmit(values: FormValues) {
    const distanceKm = Number(values.distanceKm)
    const ascentM = Number(values.ascentM)
    const descentM = Number(values.descentM)
    const total = seconds(values)
    const earned = btlPoints(distanceKm, ascentM, descentM, total) ?? 0

    const sent = {
      /* The race a correction keeps is the one the record already names, and not
         what the box holds. The box is locked (`fixed` below), so the two agree;
         read off the record anyway, because a lock is a courtesy to whoever is
         filling the form in and the rule „sve osim trke" (owner, 27.08.2026) has
         to hold whatever reaches this function.
       *
         Both roads in, and that is the correction rather than the rule: the rule
         was written for a submission being sent again and the counted result was
         added beside it without it, so `correcting === undefined` was true on the
         new road and the name came out of the box after all. Measured by a review
         on 28.08.2026: the locked field changed by other means and sent left
         „Sasvim druga trka" waiting in the queue in place of the race the member
         actually ran. */
      raceName: named?.raceName ?? String(values.raceName),
      /* Through `storedDate`, which reads the date or throws saying what was in
         the box. It was parsed here and the result called a Date without
         looking (ADL A14 bans that), and answering with an empty date instead
         would be the other half of the same fault: a result with no date
         belongs to no season and would reach the moderator looking ordinary
         (rule 2). Nothing can reach the throw, because the form refuses an
         unreadable date before it submits. */
      date: storedDate(String(values.date)),
      distanceKm,
      ascentM,
      descentM,
      photo: String(values.photo),
      seconds: total,
      points: earned,
      category: categoryOf(distanceKm),
      link: String(values.link),
      /* What the member wanted to say about the race, and it used to be thrown
         away here: the field is on the form (`unos-rezultata.form.json`), the
         rulebook lists it among what is entered from a profile (Član 37), the
         moderator's screen draws it where there is one, and the same result
         reported from the event page has carried it all along
         (pages/event/ReportResult.tsx). Only this door dropped it, silently, and
         nothing measured the difference: putting it back and taking it away both
         left the whole suite green. */
      comment: String(values.comment),
    }

    /* The same result again where one is being corrected, and a new one
       otherwise. Sending the correction as a new result would leave the refused
       one standing beside it: two rows for one race, and the moderator reading
       the same morning twice (owner, 06.08.2026). */
    if (correcting !== undefined) {
      resubmit(correcting.id, sent)
    } else if (fixingOne !== undefined) {
      /* A counted result being changed leaves the standings and goes back into
         the queue as something waiting on somebody (owner, 27.08.2026: „menja i
         dostavlja dokaz za tu izmenu (ponovo)").
       *
         Both halves in one press, and the order matters only in that neither may
         be left out: the old result is taken out of the reckoning and the new
         values go in front of a moderator. Left in, a member would have their
         old points counted while the new ones wait; taken out without the
         second, the result would simply vanish.
       *
         And the points move only when somebody agrees again, which is the whole
         reason this is not an edit in place: „odmah se ažurira poredak nakon
         verifikacije" (owner, same day). */
      remove(RESULTS, fixingOne.id)
      submit({ memberNumber: me, ...sent })
    } else {
      submit({ memberNumber: me, ...sent })
    }

    /* Stays on a confirmation rather than jumping to the list (PDL P9: "Član
       odmah po unosu vidi koliko je bodova dobio"). The points were already
       being worked out here and then thrown away, so the one thing the member
       came to find out was the one thing the screen did not say. */
    setDone({ points: earned, again: correcting !== undefined || fixingOne !== undefined })
  }

  if (done !== null) {
    return (
      <div className="member" role="status">
        <h1>{t('newResult.doneTitle')}</h1>
        <p>{t('newResult.donePoints', { points: formatPoints(done.points, locale) })}</p>
        <p>{done.again ? t('newResult.againDone') : t('newResult.doneWaiting')}</p>
        <p className="member__actions">
          <Link className="button button--primary" to={`/${locale}/moji-rezultati`}>
            {t('newResult.toMine')}
          </Link>{' '}
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setDone(null)}
          >
            {t('newResult.another')}
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="member">
      {correcting === undefined && fixingOne === undefined ? (
        <p className="member__note">{t('newResult.note')}</p>
      ) : correcting === undefined ? (
        /* The third state, and it says the two things this road does that the
           others do not: the result leaves the standing until somebody agrees
           again, and it will not be taken without new proof. */
        <p className="member__note">{t('newResult.fixingCounted')}</p>
      ) : (
        /* Why the form is full, and of what. A member who pressed „Pošalji
           ponovo" is looking at their own words back, and the reason they are
           looking at them is the sentence the moderator wrote.

           Two sentences and not one since 27.08.2026, because there are now two
           ways in: a result that was sent back carries a reason and a result
           that is still waiting carries none. Said with the words of a refusal,
           the second told a member that something had been refused when nobody
           had decided anything, and printed „Razlog je bio:" with nothing after
           it. */
        <p className="member__note">
          {correcting.status === 'rejected'
            ? t('newResult.again', { reason: correcting.note })
            : t('newResult.changing')}
        </p>
      )}

      <FormRenderer
        form={unosRezultata}
        initial={
          correcting !== undefined
            ? filledFrom(correcting)
            : fixingOne === undefined
              ? undefined
              : filledFromCounted(fixingOne)
        }
        /* Everything except which race it was (owner, 27.08.2026: „sve osim
           trke"). A correction keeps the identity of the submission a moderator
           may already have read, so letting the race change turns that row into a
           different race under the same number, and the queue is told only that
           something was corrected. Whoever picked the wrong race deletes it and
           enters another, which is what the list beside this offers. */
        fixed={correcting === undefined && fixingOne === undefined ? undefined : ['raceName']}
        /* And a counted result does not go back into the queue on somebody's
           word alone: „menja i dostavlja dokaz za tu izmenu" (owner,
           27.08.2026). Either proof will do, which is the pair the portal
           already treats as one (PDL P9: a link or a picture, and a picture
           carries a comment with it).

           Refused rather than the fields made required, because the requirement
           is about this one road in: on every other road both are optional, and a
           form definition is one shape for all of them. */
        alsoRefuses={(values) =>
          /* Trimmed here, because what arrives here is not. The form hands this
             function what is on the screen and hands `onSubmit` the trimmed copy
             (`FormRenderer`), so three spaces in Link read as proof and the
             sentence that explains what is missing never appeared: the member saw
             only the general complaint about an empty field, which is true and
             says nothing about this road in particular. Measured by a review on
             28.08.2026; the sending itself was refused either way, so what was
             lost was the explanation and not the guard. */
          fixingOne !== undefined &&
          String(values.link).trim() === '' &&
          String(values.photo).trim() === ''
            ? 'newResult.needsProof'
            : undefined
        }
        suggests={{ raceName: offered }}
        onSubmit={onSubmit}
      />
    </div>
  )
}
