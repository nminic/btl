import { useMemo } from 'react'
import { useSend, useSent } from '../sent'
import { useFilterParams } from '../../app/useFilterParams'
import { Link } from 'react-router'
import { FormRenderer } from '../../forms/FormRenderer'
import { unosRezultata } from '../../forms/definitions'

import type { FormValues } from '../../forms/types'
import { fieldDate, storedDate } from '../../forms/dateField'
import { categoryOf } from '../../data/raceCategory'
import { raceKind } from '../../data/raceKind'
import type { Result } from '../../data/types'
import { useEvents, useRaces, useResults } from '../../data/useResource'
import { useToday } from '../../clock/useClock'
import { fromBoxes, inBoxes, noTime } from '../../forms/clock'
import { racesToOffer } from './racesToOffer'
import { pointsOf } from '../../data/scoring'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import type { Submission } from '../../session/context'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
import './Member.css'

/* The same form without the two questions a counted result does not ask.
 *
 * Correcting a result that has already been counted does not touch the kind of
 * race (owner, 30.08.2026: „član može da traži izmenu nezaključanih polja; ako
 * hoće više od toga, mora da se obrati mailom"), and by then the result has a
 * race behind it, whose event answers for the place. Asking either would be
 * asking the member to restate something the portal already knows, and leaving
 * them empty and required would refuse the correction outright.
 *
 * Built once at module load rather than per render, the way the report form is
 * built per kind (`pages/event/reportForm.ts`): this is handed to `FormRenderer`
 * as a prop, and a fresh object every render is a changed prop every render. */
const ISPRAVKA_PREBROJANOG = {
  ...unosRezultata,
  fields: unosRezultata.fields.filter((one) => one.name !== 'raceKind' && one.name !== 'city'),
}

/**
 * A refused result written back into the fields it was entered in.
 *
 * The other way round from `fromBoxes` (`forms/clock.ts`): the form asks for hours, minutes and
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
    ...inBoxes(one.seconds),
    link: '',
    photo: '',
    comment: '',
  }
}

function filledFrom(one: Submission): FormValues {
  return {
    raceName: one.raceName,
    date: fieldDate(one.date),
    /* The kind and the place come back with everything else. Left out, they are
       empty and required when the form reopens, and the member cannot send the
       correction at all: measured 30.08.2026, the form answered „Prijava nije
       poslata. Popravi ova polja: Vrsta trke, Mesto" on a correction that changed
       nothing. This is the second of the three writers of a submission, and the
       one this change missed first. The third, `filledFromCounted`, deliberately
       does not carry them: that form does not ask either question. */
    raceKind: one.raceKind,
    city: one.city,
    country: one.country,
    distanceKm: String(one.distanceKm),
    ascentM: String(one.ascentM),
    descentM: String(one.descentM),
    ...inBoxes(one.seconds),
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

export function NewResult() {
  const { locale, t } = useI18n()
  const { memberNumber, submissions, submit, resubmit } = useSession()
  /**
   * What the last entry earned and whether it was a correction, once there has
   * been one.
   *
   * Both together, because the second cannot be worked out afterwards: sending a
   * correction puts the result back to waiting, so the refused result the
   * address named is no longer refused and the screen would say the ordinary
   * thing about it.
   */
  /* **Held by the address, not by the screen.** Drawn in place, the entry under the
     confirmation was this form, filled in and already sent, so the browser's own way back
     offered the member the chance to send the same result a second time. That is exactly
     the case the owner named on 05.09.2026: „Nazad sa potvrde poslatog rezultata treba da
     vodi na formu Moji rezultati, a ne na formu za slanje rezultata."

     Both figures travel, because the second is the one the comment above says cannot be
     worked out afterwards. Read without asserting a type over a value this screen did not
     make (ADL A14), the same way `pages/sent.ts` reads it. */
  const said = useSent()
  const earned = Reflect.get(Object(said), 'points')
  const done =
    typeof earned === 'number'
      ? { points: earned, again: Reflect.get(Object(said), 'again') === true }
      : null
  const confirm = useSend()
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
  /* And not one that already has a correction waiting on somebody. The list offers
     no way in then (`MyResults`), so the only way to try is to type the address,
     which is exactly why the form and not only the list has to say no: a second
     correction of one result puts two rows for one race in front of a moderator,
     and „Odobri sve" walks them newest first, so what ends up counted is the
     oldest. Measured by a review on 28.08.2026. */
  const waiting = submissions.some(
    (one) => one.memberNumber === memberNumber && one.status === 'pending' && one.corrects?.id === fixing,
  )
  const fixingOne = waiting
    ? undefined
    : counted.find((one) => one.id === fixing && one.memberNumber === memberNumber)
  /* Whichever of the two this is, when it is either: the race is read off the
     record on both roads in, and one name for that saves the next reader from
     having to notice that there are two. */
  const named = correcting ?? fixingOne
  /* Which kind of race a counted result was run at, and where, read off the race
     and its event rather than asked.
   *
     A correction of a counted result is not asked either question: the kind is
     not the member's to change (owner, 30.08.2026) and by then the result has a
     race behind it whose event answers for the place. But the submission it makes
     still carries both, because it is a submission like any other and the form
     that reopens it does ask. Sent empty, a correction of a correction came back
     to a form demanding a kind and a place the member was never shown. */
  const behind = useMemo(() => {
    if (fixingOne === undefined || races.status !== 'ready' || events.status !== 'ready') {
      return undefined
    }

    const race = races.data.find((one) => one.id === fixingOne.raceId)
    const event = race === undefined ? undefined : events.data.find((one) => one.id === race.eventId)

    return race === undefined || event === undefined
      ? undefined
      : /* Through the one home for that reading (`data/raceKind.ts`), because
           the file holds a word and not one of the three: read raw, a race whose
           kind nobody ever set would put that word into the record, while the
           very same race reported from the event page would put „length" there.
           One fact, one answer. */
        { kind: raceKind(race.kind), city: event.city, country: event.country }
  }, [fixingOne, races, events])

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
    const total = fromBoxes(values)
    const earned = pointsOf(distanceKm, ascentM, descentM, total)

    /* Which of the two answers this road gives, chosen by the road and not by
       what happens to be in a box. `behind` is undefined where the race a counted
       result belongs to has left the calendar, and that is a state the ordinary
       administration can reach: deleting an event takes its races along, and takes
       its results along **only where the address belongs to that event alone**
       (`admin/AdminEvents.tsx`). Two events on one slug is the window in which the
       races go and the results stay, and it is deliberate — deleting them then
       would take the other event's results with them.

       So the empty strings are what a member is shown in that window, not a floor
       under something that cannot happen. An earlier sentence here said the
       administration refuses to delete a race while results point at it; nothing
       in the portal does that, and the cascade above is the opposite of it
       (review, 31.08.2026). */
    const said =
      fixingOne === undefined
        ? {
            raceKind: String(values.raceKind),
            city: String(values.city),
            country: String(values.country),
            /* Written only where the member chose a race from the list, which is
               the one thing that puts it in the values (`racesToOffer.ts`). Typed
               freely, there is none, and that absence is what verification reads
               to know it has to make the race. */
            ...(values.raceId === undefined || values.raceId === ''
              ? {}
              : { raceId: String(values.raceId) }),
          }
        : {
            raceKind: behind?.kind ?? '',
            city: behind?.city ?? '',
            country: behind?.country ?? '',
            /* The race the counted result already names, kept rather than looked
               up again: a correction is of that result and of no other, and
               verification reads this to know there is nothing to make. */
            raceId: fixingOne.raceId,
          }

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
      /* What the member says the race was, and where, or what the race says when
         there is one. A hint until the administration settles it at verification
         (owner, 30.08.2026).
       *
         **Never read out of a value the form is not holding.** The form for
         correcting a counted result has neither box, so `values.raceKind` there
         is nothing at all, and `String(nothing)` is the word „undefined" written
         into the record and back into the next form somebody opens. This portal
         has paid for that once already, in `forms/FormRenderer.tsx`, which keeps
         a filled copy of its values for the same reason. So the two roads are
         separated here rather than joined by a fallback. */
      ...said,
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

    /* The counted record this correction will put in place of the one it
       replaces, rebuilt from what is being sent now.
     *
       **Both roads build it**, and that is the whole of a critical fault measured
       by a review on 28.08.2026. A correction of a counted result may itself be
       corrected before anybody decides it, and that second correction goes down the
       `resubmit` road, which keeps the submission's earlier fields. So the record
       waiting to be counted stayed the first version: the moderator read 7:14:46,
       pressed Odobri, and 9:14:46 went into the standing. That is exactly the fault
       `resubmit` exists to prevent, in its own words, „a moderator who has already
       read it would otherwise decide numbers they never saw".
     *
       Written once, above both roads, so neither can be the one that forgets. A
       submission that is not a correction of anything carries `undefined`, which
       also clears a stale one where a member is correcting an ordinary result. */
    const replacing = fixingOne ?? correcting?.corrects
    const corrects =
      replacing === undefined
        ? undefined
        : {
            ...replacing,
            date: sent.date,
            distanceKm: sent.distanceKm,
            ascentM: sent.ascentM,
            descentM: sent.descentM,
            seconds: sent.seconds,
            points: sent.points,
            category: sent.category,
          }

    /* The same result again where one is being corrected, and a new one
       otherwise. Sending the correction as a new result would leave the refused
       one standing beside it: two rows for one race, and the moderator reading
       the same morning twice (owner, 06.08.2026). */
    if (correcting !== undefined) {
      resubmit(correcting.id, { ...sent, corrects })
    } else if (fixingOne !== undefined) {
      /* A counted result being changed goes back into the queue as something
         waiting on somebody, and **stays in the standing until somebody agrees**.
       *
         Owner, 28.08.2026, choosing between four outcomes: the old result stays
         where it is while the correction waits, and changes when a moderator
         approves it. Until then this took the result out of the standing at once,
         so a refusal lost the points for good: measured that day, a profile fell
         from 180 races and 1.752,86 points to 179 and 1.744,60 with no way back,
         because an approved submission produced no result. That contradicted the
         portal's own rule that the standing is brought up to date **after**
         verification (owner, 27.08.2026: „odmah se ažurira poredak nakon
         verifikacije").
       *
         The cost the owner accepted, written down rather than left to be
         discovered: while the correction waits, the standing holds numbers the
         member has themselves said are wrong. That lasts as long as the queue
         does.
       *
         What travels with the submission is the whole corrected record, under the
         identity of the one it replaces: a `Submission` does not know the event's
         name or address and a `Result` needs both, and this is the one place where
         both are in hand. Approving it swaps that record (`SessionProvider`). */
      submit({ memberNumber: me, ...sent, corrects })
    } else {
      submit({ memberNumber: me, ...sent })
    }

    /* Stays on a confirmation rather than jumping to the list (PDL P9: "Član
       odmah po unosu vidi koliko je bodova dobio"). The points were already
       being worked out here and then thrown away, so the one thing the member
       came to find out was the one thing the screen did not say. */
    confirm(`/${locale}/moji-rezultati`, {
      points: earned,
      again: correcting !== undefined || fixingOne !== undefined,
    })
  }

  if (done !== null) {
    return (
      <div className="member" role="status">
        <h1>{t('newResult.doneTitle')}</h1>
        <p>{t('newResult.donePoints', { points: formatPoints(done.points, locale) })}</p>
        {/* And that the number is not the last word (PDL, 30.08.2026, point 8).
            The administration settles the kind and the time at verification, and
            on a timed race the time is the race's own limit, so a result sent as
            1:52:10 may be counted as 3:00:00 and be worth a third of what this
            line said. Until 31.08.2026 nothing on the way said so, and the member
            met the smaller number for the first time in their own list. */}
        <p>{t('newResult.pointsNotFinal')}</p>
        <p>{done.again ? t('newResult.againDone') : t('newResult.doneWaiting')}</p>
        <p className="member__actions">
          <Link className="button button--primary" to={`/${locale}/moji-rezultati`}>
            {t('newResult.toMine')}
          </Link>{' '}
          <Link className="button button--secondary" to={`/${locale}/rezultat/novi`}>
            {t('newResult.another')}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="member">
      <FormRenderer
        /* Above the fields and under the heading, so the heading is the first
           thing on the page. Drawn before the form, these notes stood ahead of
           it and the page began without a heading at all (owner, 01.09.2026;
           same shape as the proposal of a team). */
        above={
          correcting === undefined && fixingOne === undefined ? (
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
          )
        }
        /* And the short form is the short form on both roads back to it. A
           correction of a counted result is not asked its kind or its place, but
           the submission it makes is a submission like any other: the member can
           reopen it from the list of what they have sent, through `?ponovo=`, and
           that road drew the full form with both boxes open. One click and the
           kind the member was never asked for was theirs to set, on a correction
           of a result that is already counted (measured in review, 30.08.2026).
           What decides is what the submission is, not which address opened it. */
        form={correcting?.corrects === undefined && fixingOne === undefined ? unosRezultata : ISPRAVKA_PREBROJANOG}
        /* A fresh form starts on „Dužinska" (owner, 30.08.2026), and that is done
           here rather than in the definition because a field has no notion of a
           value it starts from: `emptyValues` gives every field the empty string
           and this prop is what the form already takes to start from something
           else. A kind left empty would be a required select nobody filled, and
           the member would be refused for not answering a question they were
           never asked. */
        initial={
          correcting !== undefined
            ? filledFrom(correcting)
            : fixingOne === undefined
              ? { raceKind: 'length' }
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
            : /* And a result run in no time at all, which no single box can refuse
                 because each of the three is right to take nought on its own: a
                 race of forty five minutes has nought hours (owner, 31.08.2026:
                 „Ne sme da se popuni 0:0:0!"). Asked of the one place that holds
                 that rule, so this form and the panel in the verification queue
                 refuse the same thing. */
              noTime(values)
              ? 'newResult.needsTime'
              : undefined
        }
        suggests={{ raceName: offered }}
        onSubmit={onSubmit}
      />
    </div>
  )
}
