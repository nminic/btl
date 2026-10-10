import { useMemo, useRef, useState } from 'react'
import { useSend, useSent } from '../sent'
import { useFilterParams } from '../../app/useFilterParams'
import { Link } from 'react-router'
import { FormRenderer } from '../../forms/FormRenderer'
import { unosRezultata } from '../../forms/definitions'

import type { FormValues } from '../../forms/types'
import { fieldDate } from '../../forms/dateField'
import { raceKind } from '../../data/raceKind'
import type { RaceKind, Result, SentRun } from '../../data/types'
import {
  combinePair,
  useEvents,
  useMyResultSubmissions,
  useRaces,
  useResults,
  type ResourceState,
} from '../../data/useResource'
import { Resource } from '../../components/Resource'
import { useToday } from '../../clock/useClock'
import { fromBoxes, inBoxes, noTime } from '../../forms/clock'
import { racesToOffer } from './racesToOffer'
import { figuresAsked } from '../admin/amendFields'
import { useI18n } from '../../i18n/useI18n'
import { useMemberScreen } from './memberScreen'
import type { Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { aCorrectionWaitsOn } from './correctionWaits'
import {
  saysTheResultIsGone,
  theCorrectionWasSentIn,
  theRunWasSentIn,
  WHEN_A_RESULT_IS_WRITTEN,
} from './resultWrites'
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

/** What the form waits for on a road that names nothing: nothing, so the one place that draws
 *  waiting draws the form at once. */
const NOTHING_TO_WAIT_FOR: ResourceState<unknown> = { status: 'ready', data: null }

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

/**
 * A run a moderator sent back, written back into the fields it was entered in.
 *
 * The other way round from `fromBoxes` (`forms/clock.ts`): the form asks for hours, minutes and
 * seconds and the record keeps one number, and a member correcting a link is not to be made to
 * type the whole race again (owner, 06.08.2026).
 *
 * <p><b>Read off the server's own answer since R2 of the results flows</b>
 * (`GET /api/me/result-submissions`), and not off a copy this browser kept when it was sent: a
 * copy kept here was gone the moment the page was reloaded, and a run sent back never reached it
 * at all once the moderator's queue had moved onto the server. The figures are what an approval
 * would count today (`SentRun`), so on a race of the calendar the ones the race fixes are the
 * race's own, which is also what they will be locked to below.
 */
function filledFrom(one: SentRun): FormValues {
  return {
    raceName: one.raceName,
    date: fieldDate(one.raceDate),
    /* The kind and the place come back with everything else. Left out, they are
       empty and required when the form reopens, and the member cannot send the
       correction at all: measured 30.08.2026, the form answered „Prijava nije
       poslata. Popravi ova polja: Vrsta trke, Mesto" on a correction that changed
       nothing. The route serves both on every run, the race's kind and its event's
       town where the race is in the calendar (`MyResultSubmissionsApi`).
       `filledFromCounted` deliberately does not carry them: that form does not ask
       either question. */
    raceKind: one.raceKind,
    city: one.city,
    country: one.country,
    distanceKm: String(one.distanceKm),
    ascentM: String(one.ascentM),
    descentM: String(one.descentM),
    ...inBoxes(one.seconds),
    link: one.link,
    /* No picture: the route answers none, because a picture is deleted once it has been
       decided (ADL A12), and none can be sent to the server yet (`tellTheServer` below says
       why). */
    photo: '',
    /* And what they said about the race. PDL P9 binds it to the picture as a pair, „dva
       neobavezna polja, ista na oba puta prijave: slika i komentar", and a run sent back is
       the one where those words matter most: the refusal is usually about the link, and the
       comment is what explains it. Left out, the member would reopen the form, find his
       sentence gone, and send the run again without it. */
    comment: one.comment,
  }
}

/**
 * A run a moderator sent back WITH the reason he gave, which is the only kind `?ponovo=` opens.
 *
 * <p>Waiting runs are not opened here, by the owner's choice of 10.10.2026 among the outcomes
 * offered, in the record's wording: „„Izmeni" i „Obriši" na prijavi koja čeka se skrivaju do
 * zasebnog posla". A run sent back carries its reason by the route's own answer (a refusal
 * names one), and asking for it here is what lets the note below say it without a fallback.
 */
type SentBack = SentRun & { state: 'rejected'; reason: string }

function isSentBack(one: SentRun): one is SentBack {
  return one.state === 'rejected' && one.reason !== null
}

/**
 * THE BOXES A RACE OF THE CALENDAR ANSWERS FOR ON A RUN SENT AGAIN, which the form locks there
 * exactly as it locks them when the same race is chosen from the list (`racesToOffer.ts`).
 *
 * <p><b>Read off the one place that says what each kind leaves to the runner</b>
 * (`admin/amendFields.ts`, `figuresAsked`, which takes the member's own form): what a race of
 * this kind asks is the runner's, and every figure a free race asks that this kind does not is
 * the race's. A free race asks all of them, by the owner's decision of 29.08.2026 that on a free
 * race the member gives all four, so nothing is locked there.
 *
 * <p><b>Why locked at all</b>, which is derived and was said to the coordinator before it was
 * written (10.10.2026): `POST /api/results` with a `raceId` takes the figures the race fixes off
 * the race and ignores what came with the request (`WhatARaceCarries.figuresOf`), so a box left
 * open here would take a number the server then throws away while telling the member it went in.
 * ADL A32's rule for every lock: it says what the reader may not change.
 */
function heldByTheRace(kind: RaceKind): string[] {
  const asked = new Set(figuresAsked(kind).map((one) => one.name))

  return figuresAsked('free')
    .map((one) => one.name)
    .filter((name) => !asked.has(name))
}

export function NewResult() {
  const who = useMemberScreen()

  if (who.memberNumber === null) {
    return who.instead
  }

  /* A screen of its own below, because the runs sent back are asked for BY WHOM
     (`useMyResultSubmissions` takes the member), and a hook cannot wait for the check above. */
  return <TheForm me={who.memberNumber} />
}

function TheForm({ me }: { me: string }) {
  const { locale, t } = useI18n()
  /**
   * THAT there has been an entry, and whether it was a correction or a run sent again, once
   * there has been one.
   *
   * The second cannot be worked out afterwards: a run sent again is a new row on the list
   * beside the one that was sent back, so the screen would say the ordinary thing about it. So
   * it travels.
   *
   * **What no longer travels is the number of points.** It did until 28.09.2026,
   * and only because the confirmation printed it; the owner ended that („Ne vidim
   * razlog da se ispisuju bilo kome prilikom unosa parametara prijave rezultata"),
   * so what is left is the presence of an entry, read the way `RateEvent.tsx` and
   * `ReportResult.tsx` read theirs.
   */
  /* **Held by the address, not by the screen.** Drawn in place, the entry under the
     confirmation was this form, filled in and already sent, so the browser's own way back
     offered the member the chance to send the same result a second time. That is exactly
     the case the owner named on 05.09.2026: „Nazad sa potvrde poslatog rezultata treba da
     vodi na formu Moji rezultati, a ne na formu za slanje rezultata."

     Read without asserting a type over a value this screen did not make (ADL A14), the
     same way `pages/sent.ts` reads it. */
  const confirmed = useSent()
  const done =
    confirmed === undefined ? null : { again: Reflect.get(Object(confirmed), 'again') === true }
  const confirm = useSend()
  /* What the server answered, where it answered anything but „done". A result that went
     through leaves this screen for the confirmation, so the only answer this ever holds is
     one the reader is owed a sentence about (`RateEvent.tsx`'s own shape). */
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [sending, setSending] = useState(false)
  /* A second press while the first is still out would file the same run twice, and a member
     may have only one result on one race (PDL, 09.09.2026). A ref rather than the state
     beside it: a ref is read and written in the same tick, so a redraw cannot land between
     two presses that arrive before one answer does. */
  const outstanding = useRef(false)
  /* HOW MANY TIMES A REFUSAL HAS SAID THAT WHAT THIS FORM WAS OPENED ON IS NOT THERE, which is
     what makes the two lists it reads ask again (`HowToRead.revision`). Bumped on the one answer
     that says so, an empty 404 from `PUT /api/results/{id}` (`resultWrites.ts`,
     `saysTheResultIsGone`), after that module has dropped both caches: the counted result the
     form corrects, or the one a run sent back was a correction of, has been taken back in another
     tab or by another hand. */
  const [revision, setRevision] = useState(0)
  /**
   * The run this is sent again, or the counted result this corrects, where the address names
   * one.
   *
   * Carried in the address because a screen cannot be told anything else, the same way the
   * administration opens an event by address. Both lists are the asker's own and nobody
   * else's - the server answers only his runs, and a counted result is read against the member
   * signed in - so a number typed into the address bar opens nobody else's.
   */
  const [params] = useFilterParams()
  const today = useToday()
  const events = useEvents()
  const results = useResults(revision)
  const races = useRaces()
  const sent = useMyResultSubmissions(me, revision)
  /* Built once for the data rather than on every letter typed: the list is the
     whole calendar read through one date, and it does not change while somebody
     is typing into the box above it. Empty until both files are here, which is
     what the form shows for the first moment it is on screen, and empty for good
     when one of them could not be read: that case is SAID (`offering` below) and
     not left to look like a calendar with no race in it. */
  const offered = useMemo(
    () =>
      events.status === 'ready' && races.status === 'ready'
        ? racesToOffer(events.data, races.data, today, locale)
        : [],
    [events, races, today, locale],
  )
  /* **THE TWO FILES THE LIST IS MADE FROM, AS ONE READ.** A race is offered only with its event
     (`racesToOffer`), so the list is as unreadable as the worse of the two, and one failure
     asks again for every file that failed (`combinePair`, `theFailure`): a press that asked
     for the races alone would leave the events saying they could not be read beside a list
     that had just come. Only its failure is used here; what it reads when it is ready is
     `offered`'s business. */
  const offering = combinePair(events, races)
  const again = params.get('ponovo')
  /* The other way in: a result that has already been counted, which a member may
     change by sending it back through the queue with new proof (owner,
     27.08.2026). A different word in the address because it is a different thing:
     `ponovo` names a run a moderator sent back, this names a result that has been
     counted. */
  const fixing = params.get('ispravka')
  /* The asker's runs that nobody has counted, once they are here. The form is not drawn on
     either road that names one until they are (`Resource` below), so nothing here decides
     anything off a list that has not arrived. */
  const mine = sent.status === 'ready' ? sent.data : undefined
  /* A run that was sent back, and only that: a run still waiting is not changed from here
     (`SentBack` above says whose choice that is). And not a correction of a result that has
     another correction WAITING: that road is shut like the others (`aCorrectionWaitsOn`), so an
     address that names such a run opens the form for a new one, exactly as it does for a run
     that is not on the list at all. Measured by the review of PR 521 on 10.10.2026: this road
     asked nothing, the list offered it from the row of a correction sent back, and it sent. */
  const correcting = mine
    ?.filter(isSentBack)
    .find((one) => String(one.id) === again && !aCorrectionWaitsOn(mine, one.amendsResultId))
  /* And the counted one this is a correction of, read against the member signed in: an
     identity out of the address opens nobody else's result. Read through the overlay, so a
     result taken back a moment ago is not offered for changing. */
  const counted = results.status === 'ready' ? results.data : []
  /* And not one that already has a correction WAITING on somebody, which is the question
     `aCorrectionWaitsOn` answers for every way in. The list offers no way in then, on either of
     its two links (`MyResults`), so the only way to try is to type the address, which is exactly
     why the form and not only the list has to say no. A correction that was sent back is in
     nobody's queue and does not stand in the way of this road; it has a road of its own, above,
     and that one asks the same question. */
  const waiting = aCorrectionWaitsOn(mine, fixing === null ? null : Number(fixing))
  const fixingOne = waiting
    ? undefined
    : counted.find((one) => String(one.id) === fixing && one.memberNumber === me)
  /* Whichever of the two this is, when it is either: the race is read off the
     record on both roads in, and one name for that saves the next reader from
     having to notice that there are two. */
  const named = correcting ?? fixingOne
  /* Whether this form corrects a result that is already COUNTED, on either road in: the counted
     result itself (`?ispravka=`), or a correction of it that a moderator sent back and the member
     sends again (`?ponovo=`). One fact that decides three things - which form is drawn, which of
     its boxes are held, and which route takes it - and written once so the three cannot drift
     apart. */
  const corrects = fixingOne?.id ?? correcting?.amendsResultId ?? null
  const correctsACountedResult = corrects !== null

  /* What this form has to wait for before it can be drawn, which is only what the road in names:
     the counted results and the runs sent (a correction must know whether one already waits),
     the runs sent alone, or nothing. */
  const waitFor: ResourceState<unknown> =
    fixing !== null ? combinePair(results, sent) : again !== null ? sent : NOTHING_TO_WAIT_FOR

  /**
   * WHICH ROUTE TAKES IT, decided by the road in and never by what is in a box.
   *
   * <ul>
   * <li><b>A correction of a counted result</b>, on either road, is the numbers and the proof
   * and nothing else: „Menja se sve osim trke" (owner, 27.08.2026). It goes to the address of
   * the RESULT, which is what `?ispravka=` carries and what a correction sent back names as
   * `amendsResultId`, and what `ResultWriteApi.his` reads `result` by.
   * <li><b>A run sent back that corrected nothing</b> is a run, sent again through the route
   * every run takes (the owner's choice of 10.10.2026, in the record's wording: „sada ponovno
   * slanje odbijene prijave preko postojećih ruta"). Its race is the one the run named, read off
   * the run and not off a box: a race in the calendar goes by its id and nothing else about it,
   * and a race the calendar does not hold goes by the name the run carried.
   * <li><b>A new run</b> goes by whether the member picked a race out of the list, which is the
   * one thing that puts an id in the values (`racesToOffer.ts`).
   * </ul>
   *
   * <p><b>Built by road rather than by sending one record everywhere, and that is the whole of a
   * refusal measured on 28.09.2026</b>: `ResultWriteApi.fromTheCalendar` answers
   * `theRaceIsNamedTwice` when a kind, a town or a country arrives beside a `raceId`, so a body
   * that carried them on every road would have been turned away on every race of the calendar.
   */
  function whereItGoes(values: FormValues): Promise<Answer> {
    const figures = {
      distanceKm: Number(values.distanceKm),
      ascentM: Number(values.ascentM),
      descentM: Number(values.descentM),
      seconds: fromBoxes(values),
    }
    const proof = { link: String(values.link), comment: String(values.comment) }

    if (corrects !== null) {
      return theCorrectionWasSentIn(corrects, { ...figures, ...proof })
    }

    /* The race a run keeps is the one the record already names, and not what the box holds.
       The box is locked (`fixed` below), so the two agree; read off the record anyway, because a
       lock is a courtesy to whoever is filling the form in and the rule „sve osim trke" (owner,
       27.08.2026) has to hold whatever reaches this function. Measured by a review on 28.08.2026,
       when one road read the box: the locked field changed by other means sent „Sasvim druga
       trka" into the queue in place of the race the member actually ran. */
    const raceId =
      correcting === undefined
        ? values.raceId === undefined || values.raceId === ''
          ? null
          : Number(values.raceId)
        : correcting.raceId

    return theRunWasSentIn(
      raceId === null
        ? {
            raceName: named?.raceName ?? String(values.raceName),
            /* `day` and not `date`, which is what the record on the server calls it. As it is
               handed: the form has already put the day in the shape a record keeps it in
               (`forms/records.ts`, `storedDates`), and converted here as well it would be
               converted twice. */
            day: String(values.date),
            raceKind: String(values.raceKind),
            /* The town by name and country, never a `placeId`: `PlaceField` writes those two
               and has no GeoNames mark to give, which is `Registration.tsx`'s own decision
               against the same rule. */
            city: String(values.city),
            country: String(values.country),
            ...figures,
            ...proof,
          }
        : { raceId, ...figures, ...proof },
    )
  }

  /**
   * SENDS IT, AND DECIDES WHAT THE READER SEES BY WHAT CAME BACK.
   *
   * <p><b>THE CONFIRMATION IS DRAWN ONLY AFTER THE SERVER AGREED.</b> Until 28.09.2026
   * this screen wrote into the browser's own overlay and confirmed on the spot, so a
   * member was told his result was in the queue when nothing had left the machine.
   *
   * <p><b>Refused, nothing moves.</b> Every box keeps what was typed into it, so somebody
   * whose link was turned away corrects that one field rather than entering the whole
   * race again. <b>Unless the refusal says the counted result is not there</b>
   * (`saysTheResultIsGone`): then both lists are read again, because what the form was opened
   * on is gone, and a correction of it with it (`result_submission_amends_fk` cascades).
   *
   * <p><b>Nothing is written into the browser after it went through</b>, which is new with R2
   * of the results flows: until then the run was written into the session's own list, because
   * no route served a member his own runs. `GET /api/me/result-submissions` does now, and
   * `resultWrites.ts` drops it after every write the server agreed to, so „Moji rezultati" reads
   * the row the server holds.
   *
   * <p><b>WHAT IS NOT SENT, and it is written down rather than left to be found:</b> the
   * picture. The form carries a `photo` field, and `ResultWriteApi.Ran` has no field for one -
   * measured 28.09.2026, the route builds its proof as `new Report(link, false, comment)`, so no
   * picture can reach it whatever this screen sends. `FormRenderer` only ever holds the file's
   * NAME (`e.target.files?.[0]?.name`), so no bytes have ever existed for a result either.
   * Owner, 28.09.2026: the upload is to be built, in October, and is carried as technical debt
   * until then (`PDL.md`, „Slika kao dokaz uz rezultat: upload se gradi, ali u oktobru"). The
   * decision of 22.08.2026 that a picture replaces a link is NOT overturned by this; it is
   * waiting for the upload, and no result can be entered before 2027 in any case.
   */
  async function tellTheServer(values: FormValues): Promise<void> {
    outstanding.current = true
    setSending(true)
    /* And the last refusal goes while this one is out, so a reader who presses again is
       not left reading the old sentence over a request still in flight. */
    setRefusal(null)

    const answer = await whereItGoes(values)

    outstanding.current = false
    setSending(false)

    if (answer.got !== 'done') {
      setRefusal(answer)

      if (saysTheResultIsGone(answer)) {
        setRevision((were) => were + 1)
      }

      return
    }

    /* Where the member is taken once it has really gone, and it carries the one thing the
       comment on `done` above says cannot be worked out afterwards. Not what the run is worth:
       nothing prints that any more (owner, 28.09.2026). */
    confirm(`/${locale}/moji-rezultati`, { again: named !== undefined })
  }

  function onSubmit(values: FormValues) {
    /* Silently, the same way the rating next door refuses a second press: the first is
       still out and the reader has already been told so. */
    if (outstanding.current) {
      return
    }

    void tellTheServer(values)
  }

  if (done !== null) {
    return (
      <div className="member" role="status">
        <h1>{t('newResult.doneTitle')}</h1>
        {/* What happens next, and not what the run is worth. This said the number
            the browser had worked out, and then took it back in the next breath,
            „Račun nije konačan" - because the administration settles the kind and
            the time at verification, and on a timed race the time is the race's own
            limit, so a result sent as 1:52:10 could be counted as 3:00:00 and be
            worth a third of what the line said.

            Owner, 28.09.2026, asked about the timed race alone and answering over
            both kinds: „bodovi ni na dužinskoj ni na vremenskoj trci ne ulaze u
            obračun pre verifikacije. Ne vidim razlog da se ispisuju bilo kome
            prilikom unosa parametara prijave rezultata. Ako ga zanima koliko će
            bodova dobiti, neka se igra kalkulatorom na naslovnoj strani portala."
            The caveat went with the number, there being nothing left for it to
            stand beside. */}
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
      {/* NOT DRAWN UNTIL IT IS KNOWN WHAT THE ADDRESS NAMES, on the two roads that name something.
          `FormRenderer` takes what its fields start with once, when it is mounted, and which run or
          counted result the address names is known only when the server answers. From the list
          that answer is already in hand; opened by the address, the form mounted first, as the
          form for a NEW result, and stayed empty, so a press complained about every box the record
          already held (measured 28.09.2026, PENDING stavka 332). It waits the way `EditTeam.tsx`
          waits for its team, through the one place loading and failure look the same everywhere. A
          new result has nothing to be filled from, and the file of counted results is the largest
          the portal serves, so that road does not wait at all. */}
      <Resource state={waitFor}>
        {() => (
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
                   others do not: the OLD result stays in the standing until somebody
                   agrees, and a refusal changes nothing (owner, 28.08.2026, PDL „Stari
                   rezultat ostaje u poretku dok ispravka čeka": it „menja se tek kad je
                   moderator odobri"), and the change will not be taken without new proof. */
                <p className="member__note">{t('newResult.fixingCounted')}</p>
              ) : (
                /* Why the form is full, and of what. A member who pressed „Pošalji
                   ponovo" is looking at their own words back, and the reason they are
                   looking at them is the sentence the moderator wrote. */
                <p className="member__note">{t('newResult.again', { reason: correcting.reason })}</p>
              )
            }
            /* And the short form is the short form on both roads back to it. A
               correction of a counted result is not asked its kind or its place, whether
               it is opened from the counted result or sent again after a moderator sent it
               back. One click on the second road drew the full form until 30.08.2026, and the
               kind the member was never asked for was theirs to set (measured in review that
               day). What decides is what the run is, not which address opened it. */
            form={correctsACountedResult ? ISPRAVKA_PREBROJANOG : unosRezultata}
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
               trke"). Sent again, a run keeps the race it named, and a race chosen wrongly
               is deleted and entered anew, which is what the list beside this offers.

               **And the day, on a correction of a COUNTED result, which is the
               coordinator's reasoning of 02.10.2026 and not the owner's word.** The route that
               takes it (`PUT /api/results/{id}`, `ResultWriteApi.Correction`) reads the three
               measures, the time, a link and a comment and has no day in it, so a day changed
               here was dropped in silence while the member was told the change went in. A box the
               server will not take must not look like one it will. The owner's decision names the
               six fields a correction changes (PDL 04.09.2026) and the day is not among them.

               **And on a run of the calendar sent again, the day and every figure the race
               fixes**, derived on 10.10.2026 for the same reason (`heldByTheRace`): the race
               answers for them on the server. A run the calendar does not hold keeps its day
               and its figures open, because there the member answers for all of it. */
            fixed={
              correctsACountedResult
                ? ['raceName', 'date']
                : correcting === undefined
                  ? undefined
                  : correcting.raceId === null
                    ? ['raceName']
                    : ['raceName', 'date', ...heldByTheRace(raceKind(correcting.raceKind))]
            }
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
            /* THE LIST OF RACES, OR THE WAY IT FAILED TO COME. A list that could not be read says so,
               beside the box it is typed against, with the button that asks again (decision of
               03.10.2026, chosen between the outcomes offered, in the words of the PDL's record of it
               and not the owner's: „Kad spisak trka na formi za rezultat ne može da se učita, uz
               polje stoji da ne može, uz „Pokušaj ponovo"."). The box stays a box that takes a name
               typed into it, and the result then goes as a race the calendar does not hold; what a
               reader must not be left with is an empty list that looks like a calendar without the
               race he is typing.

               **The words are the portal's one sentence for a read that failed and the name of the
               list it is about, and nothing new**: `data.error` is what `Resource` says for every
               screen and every part that goes through it, and `event.races` is what the page of an
               event names its races by when they could not be read (`pages/EventDetail.tsx`). That
               is the coordinator's reading of "stoji da ne može": the record fixes that it stands
               beside the field and has the button, not its words. A sentence of its own would be
               one key in each dictionary.

               **Only where the name can be typed into.** The same form is opened to send a run
               again and to correct a counted one, and both hold the name (`fixed` above), so the
               renderer says nothing there: a list is of no use to a box nothing is typed into. */
            suggests={{
              raceName:
                offering.status === 'error'
                  ? { said: t('data.error'), named: t('event.races'), read: offering }
                  : offered,
            }}
            onSubmit={onSubmit}
          />
        )}
      </Resource>

      {/* Said out loud rather than left to a button that looks unpressed, the same
          reasoning `RateEvent.tsx` keeps beside its own `role="status"`
          (WCAG 2.2, 4.1.3). */}
      {sending && <p role="status">{t('results.sending')}</p>}

      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_A_RESULT_IS_WRITTEN} />}
    </div>
  )
}
