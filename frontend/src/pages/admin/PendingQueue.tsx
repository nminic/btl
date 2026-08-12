import { useState } from 'react'
import registracija from '../../forms/definitions/registracija.form.json'
import { limitOf } from '../../forms/records'
import type { FormDef } from '../../forms/types'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { combinePair, dataOr, failed, useEvents, useRaces, useTeams } from '../../data/useResource'
import { Stars } from '../../components/Stars'
import { commentFrom } from '../../data/comment'
import { RATING_MARKS } from '../../data/types'
import type { EventRating } from '../../data/types'
import { formatNumber, formatShortDate } from '../../i18n/format'
import { overall, rated } from '../event/overall'
import countries from '../../data/countries.json'
import tim from '../../forms/definitions/admin-tim.form.json'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { moveEvent } from './moveEvent'
import { usePending, waitingIn } from './pending'
import type { PendingItem, Team } from '../../data/types'
import { EVENTS, idFor, RACES, recordsOf, TEAMS } from './entityForms'
import { addressesIn, addressOf, proposed, refusal, teamFrom } from './teamProposal'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useOverlay } from './overlay'
import { QueueMeta } from './QueueMeta'
import { canSendBack, outcomeFor, type Queue } from './queues'
import { SendBack } from './SendBack'
import { Swept } from './Swept'
import '../member/Member.css'
import './Verification.css'

/* One screen for five queues: proposed leagues, new teams, racing profiles,
 * comments, and reported changes of date.
 *
 * One screen rather than five because the work is the same work every time. The
 * moderator reads a piece of text somebody wrote, and then decides what becomes
 * of it. What differs is the word for the text, whether there are two dates to
 * compare, and what the decision other than "yes" is, and none of those is a
 * screen.
 *
 * That last one is the only difference the moderator can feel, and there are four
 * of them (queues.ts, PDL P22). Two queues go their own way: a comment is
 * deleted on the spot, a biography is edited and published and never goes back,
 * and a picture goes back with an instruction that reaches the member's inbox.
 * Which of the four a queue is comes off the queue itself, so it is one fact in
 * one place rather than the name of a queue tested here.
 *
 * Cards rather than a table, unlike the queue of results. There the work is
 * comparison down a column of thirty; here it is reading one thing at a time, and
 * a biography of three and a half thousand characters has no column it fits in.
 */

/** Whether a queue has a second decision that hands the work back to its
 *  author. Five of the seven, plus the pictures, which hand back an instruction
 *  (queues.ts). */
function handsBack(queue: Queue, item: PendingItem): boolean {
  const outcome = outcomeFor(queue, item)

  return outcome === 'sendBack' || outcome === 'instruct'
}

/**
 * The text of one waiting item, changed in place before it goes out.
 *
 * The biographies only. A biography never goes back to the competitor for
 * approval: the moderator adjusts it as they see fit and publishes what they
 * left (PDL P22), so the text has to be editable on the screen where it is read
 * rather than somewhere else. The shape is the one the portal already uses for
 * the long text administration rewrites in place, the rules and prizes of a
 * competition (src/pages/LeagueDetail.tsx): read it, press the button, write, and
 * leaving the box saves it.
 */
function EditableBody({ id, label, value }: { id: string; label: string; value: string }) {
  const { t } = useI18n()
  const { edits, edit } = useSession()
  const [editing, setEditing] = useState(false)
  const current = edits[id]?.body ?? value

  if (editing) {
    return (
      <textarea
        className="field__control pending__editor"
        autoFocus
        aria-label={label}
        defaultValue={current}
        /* The same cap the member wrote it under. Without it a moderator could
           leave a biography longer than the form that produced it would ever
           accept, and the number lives in the definition rather than here so
           the two ends cannot drift (src/forms/records.ts). */
        maxLength={limitOf(registracija as FormDef, 'bio')}
        onBlur={(event) => {
          edit(id, 'body', event.target.value)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <>
      <p className="pending__body">{current}</p>
      <button type="button" className="button button--secondary" onClick={() => setEditing(true)}>
        {t('admin.change')}
      </button>
    </>
  )
}

/**
 * The reason approving would do nothing, where there is one.
 *
 * Its own component because it is a line with a rule of its own: it stands in
 * the document whether or not there is a reason, since a live region that
 * arrives with its words is one nobody is told about (Verification.css keeps it
 * out of the row while it is empty).
 *
 * Announced rather than merely drawn, and named by the button it explains. A
 * moderator correcting a name watches the reason appear and disappear as they
 * type; one reading the screen through a reader got neither that nor an answer
 * when they pressed. `role="status"` says it as it changes, and the button
 * points at it, so the reason is read out on the way to pressing rather than
 * after nothing happens (WCAG 2.2 SC 3.3.1 and 4.1.3).
 */
function Refused({ why, id }: { why: string | null; id: string }) {
  const { t } = useI18n()

  return (
    <p className="pending__blocked" id={id} role="status">
      {why === null ? '' : t(why)}
    </p>
  )
}

/** The three marks a comment carries, as they are read everywhere else: not a
 *  control, and each one says its number in words for anybody who cannot see the
 *  stars (components/Stars.tsx). */
function RatingGiven({ rating }: { rating: EventRating }) {
  const { locale, t } = useI18n()

  return (
    <dl className="pending__marks">
      {RATING_MARKS.map((mark) => (
        <div key={mark}>
          <dt>{t(`event.rating.${mark}`)}</dt>
          <dd>
            <Stars label={t(`event.rating.${mark}`)} value={rating[mark]} />
          </dd>
        </div>
      ))}
      <div>
        <dt>{t('event.rating.overall')}</dt>
        {/* The same words the event page uses for a rating nobody gave
            (EventComments.tsx). Two screens showing one record must not answer
            "Bez ocene" and "0,0" to the same question. */}
        <dd className="pending__overall">
          {rated(rating) ? formatNumber(overall(rating), locale, 1) : t('event.rating.unrated')}
        </dd>
      </div>
    </dl>
  )
}

/**
 * The three things a team is made of, changeable before it is made.
 *
 * The owner asked for it in the same breath as the approval itself: whoever
 * decides "may or may not change the team's data, and if they accept it" the
 * member is told (PDL P13, 03.08.2026). A name, a town and a country arrive as
 * the member typed them and the team carries them from then on, so the moment to
 * put a lower-case name right is before the record exists rather than after.
 *
 * Written into the same overlay of edits the biography uses, keyed by the item,
 * so approving reads whatever is on screen rather than what arrived.
 */
function TeamFields({ item }: { item: PendingItem }) {
  const { t } = useI18n()
  const { edits, edit } = useSession()

  const value = (field: 'name' | 'city' | 'country') =>
    String(edits[item.id]?.[field] ?? proposed(item)[field])

  return (
    /* All three are obligatory in the definition a proposed team is saved
       against (`admin-tim.form.json`), so all three say so the way every field on
       the portal says it (forms/AskedLabel.tsx). The ids carry the row, because
       a queue draws these three once per proposal and an id written twice names
       the wrong box. */
    <div className="pending__fields">
      <div className="rankings__field">
        <AskedLabel id={`team-name-${item.id}`}>{t('admin.field.teamName')}</AskedLabel>
        <input
          id={`team-name-${item.id}`}
          type="text"
          value={value('name')}
          aria-required="true"
          maxLength={limitOf(tim as FormDef, 'name')}
          onChange={(event) => edit(item.id, 'name', event.target.value)}
        />
      </div>

      <div className="rankings__field">
        <AskedLabel id={`team-city-${item.id}`}>{t('admin.field.city')}</AskedLabel>
        <input
          id={`team-city-${item.id}`}
          type="text"
          value={value('city')}
          aria-required="true"
          maxLength={limitOf(tim as FormDef, 'city')}
          onChange={(event) => edit(item.id, 'city', event.target.value)}
        />
      </div>

      <div className="rankings__field">
        <AskedLabel id={`team-country-${item.id}`}>{t('admin.field.country')}</AskedLabel>
        <select
          id={`team-country-${item.id}`}
          value={value('country')}
          aria-required="true"
          onChange={(event) => edit(item.id, 'country', event.target.value)}
        >
          <option value="">{t('form.choose')}</option>
          {/* The region first and named, like every other choice of country on
              the portal (FormRenderer): nine members in ten pick one of these,
              and a flat list of two hundred and fifty is a list nobody reads. */}
          <optgroup label={t('form.region')}>
            {countries.region.map((one) => (
              <option key={one.code} value={one.code}>
                {one.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('form.restOfWorld')}>
            {countries.rest.map((one) => (
              <option key={one.code} value={one.code}>
                {one.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  )
}

export function PendingQueue({ queue }: { queue: Queue }) {
  const { locale, t } = useI18n()
  const { create, creations, decisions, editRecord, edits, notify, publish, settle } = useSession()
  const overlay = useOverlay()
  /* The message carries the day the portal is being read as, so a walk through
     a simulated October is dated in October and not in the day it was walked. */
  const today = useToday()
  const waitingId = `waiting-${queue.id}`
  /** Which card has its reason field open. One at a time, as in the results. */
  const [open, setOpen] = useState<string | null>(null)
  /**
   * The card whose reason box has just been closed, so its buttons take the
   * focus back as they return.
   *
   * The box replaces the buttons of its own card, so both directions lose the
   * focus to the document: opening it takes the button that had it off the page,
   * and closing it takes the box. The focus then sits nowhere and the next Tab
   * starts the page from the top, past everything. Opening is answered inside the
   * box itself, which takes the focus as it appears (SendBack); this is the way
   * back. A panel in the header has the same problem and the same answer
   * (src/app/Dropdown.tsx).
   */
  const [closed, setClosed] = useState<string | null>(null)
  /** How many the last sweep settled, and null until there has been one. */
  const [swept, setSwept] = useState<number | null>(null)
  /** Which card is open, on the width where they are folded. One at a time: two
   *  open cards on a telephone are the scrolling this was meant to end. */
  const [shown, setShown] = useState<string | null>(null)
  /* The teams as well, for one rule: a name already in the league cannot be
     taken by a proposal (PDL P13). Read through what this visit has entered, so
     two proposals of the same name in one sitting cannot both go through. */
  const state = combinePair(usePending(), useTeams())
  /* The races, because accepting a reported change of date moves the event and
     everything that runs at it (moveEvent). Read for what they are worth: no
     card here draws a race, and a queue that would not open because the races
     have not arrived is a queue held up by a file it does not show
     (resourceScope.test). Where they are missing nothing is moved, and the day
     of the event alone would be the half-move this is here to prevent. So the
     decision waits for them, and only the decision: the screen draws, the cards
     are read, and the buttons say what they are waiting for
     (`whyNoDecision`). */
  const racesState = useRaces()
  /* Through the overlay, like every other screen that reads records: a race
     whose day an administrator corrected during this visit is moved from the day
     it now has, and a race entered during it is moved at all. */
  const allRaces = recordsOf(RACES, dataOr(racesState, []), overlay)
  const eventsState = useEvents()
  const allEvents = recordsOf(EVENTS, dataOr(eventsState, []), overlay)

  /** The event a reported change is about, as the list has it now: the decision
   *  waits for the events, so by the time one is taken this is there. */
  const eventOf = (one: PendingItem) => allEvents.find((each) => each.id === one.subjectId)
  /**
   * Why no decision can be taken on this queue just now, or nothing.
   *
   * Only the reported changes of date, and over both the races and the events:
   * accepting one moves the event and everything run at it by the same number of
   * days (moveEvent). Without the races the event moves alone. Without the
   * events the day it is moved from is the day the report claims, and a second
   * report about the same event then moves the races again from a day that is no
   * longer the event's: two reports of one change, and the races a week past the
   * event they are run at. Nothing brings either back.
   *
   * Three states and not two, because `dataOr` answers the same for a file on
   * its way and one that failed. Told to wait for something that will never
   * come, a moderator who holds the right is refused it for good and reads a
   * sentence that is not true (AdminEvents does the same thing for the same
   * reason).
   */
  const whyNoDecision =
    queue.id !== 'schedule' ||
    (racesState.status === 'ready' && eventsState.status === 'ready')
      ? null
      : failed(racesState, eventsState)
        ? t('verification.racesFailed')
        : t('verification.waitingForRaces')
  const racesUnknown = whyNoDecision !== null

  /* Both dates of a reported change, so the difference is the thing on screen
     and not something the reader works out. Empty on the other four queues. */
  const datesOf = (one: PendingItem) =>
    [
      { key: 'verification.currentDate', value: one.currentDate },
      { key: 'verification.proposedDate', value: one.proposedDate },
    ].filter((fact) => fact.value !== '')

  /* What is on screen right now, which on the biographies is not what came in:
     the moderator has been editing it, and what is published is what they left. */
  const textOf = (one: PendingItem) => edits[one.id]?.body ?? one.body

  /**
   * Approving, one item or forty, with everything the next one has to know.
   *
   * Written as a walk rather than as a call per item, and that is the whole
   * point of it. What a team may be called and what identity it gets are both
   * read out of the session, and the session does not change while a loop runs:
   * called forty times in one click, every team was handed the same identity,
   * and two proposals renamed to the same thing both went through. Both are
   * faults this portal has met before, on the member numbers, and the answer is
   * the same one (memberNumbers.ts): carry what has been given out along with
   * the walk.
   *
   * What it returns is what was actually settled, which is not always what it
   * was asked to settle: a proposal whose name is taken is left standing, so the
   * line under the button has to say the smaller number or it says one the queue
   * disagrees with.
   */
  const approveAll = (items: PendingItem[], teams: Team[]): number => {
    /* Everything already spoken for, growing as the walk hands more out. */
    const identities = (creations[TEAMS.id] ?? []).map((row) => row.id)
    const addresses = addressesIn(teams)
    let done = 0

    for (const one of items) {
      const made = queue.id === 'teams' ? teamFrom(one, edits) : null

      if (made !== null && refusal(made, addresses, one) !== null) {
        continue
      }

      settle(one.id, {
        status: 'approved',
        /* A published biography is written down as it went out: what the
           member's profile now says, rather than what they sent in. Nothing
           reads it on a screen since the tables of settled items were taken away
           (owner, 06.08.2026); it is kept because it is what the database will
           be given when there is one, and because a decision that records
           nothing about what it published cannot be answered for. */
        note: outcomeFor(queue, one) === 'editAndPublish' ? textOf(one) : '',
        basis: '',
        memberNumber: '',
      })

      done += 1

      /* What an approval on this queue actually does: the comment goes onto the
         event. Written down at the moment it is let out, because the event page
         is public and must never read this queue to find out (session/context,
         `published`). */
      if (queue.id === 'comments') {
        publish(commentFrom(one))
      }

      /* And what an approval on the queue of dates does: the event moves. Until
         06.08.2026 it did nothing at all beyond taking the card off the screen,
         so a moderator who agreed that a race had been put off left the calendar
         saying the old day, and the next visitor read the wrong date from a
         report the league had already accepted (owner).

         Written into the same overlay the administration writes an edited event
         into, and against the id the report carries rather than the name: two
         events across two seasons carry one name (PDL P6). */
      /* From the day the event is on now and not from the day the report says it
         was on: a report written a fortnight ago may name a day the event has
         since been moved off, and the races follow the event rather than the
         report. Where the event is not in the list at all there is nothing to
         move: a report about an event somebody has deleted. */
      const about = queue.id === 'schedule' && one.proposedDate !== '' ? eventOf(one) : undefined

      if (about !== undefined) {
        moveEvent(about.id, about.date, one.proposedDate, allRaces, editRecord)
      }

      if (made === null) {
        continue
      }

      const id = idFor(TEAMS, {}, identities, [])

      identities.push(id)
      addresses.push(addressOf(made.name))

      create(TEAMS.id, id, { ...made, organizerMemberNumber: one.memberNumber })

      notify({
        from: t('app.name'),
        to: one.memberNumber,
        subject: t('verification.teamAccepted', { name: made.name }),
        body: t('verification.teamAcceptedBody', { name: made.name }),
        date: today,
      })
    }

    return done
  }

  /** What the text on the card is called: the comment, the reason given, the
   *  biography, or the file name of a picture. Off the sort of thing rather than
   *  off the queue where one queue holds two sorts (queues.ts, `outcomeFor`). */
  const bodyLabelFor = (one: PendingItem) =>
    t(queue.id === 'profiles' ? `verification.body.${one.kind}` : `verification.body.${queue.id}`)

  return (
    <div className="member">
      <QueueMeta queue={queue} />

      {/* The name of the queue is in the navigation beside this, marked as the
          screen in view, and in the browser tab. On the screen it was a heading
          and a sentence above the work, pushing the first card down, and the
          moderator arrived here having just read both (owner, 30.07.2026). It
          stays in the markup because a page has to have a name for anyone who
          cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t(queue.labelKey)}</h1>

      <Resource state={state}>
        {([items, listed]) => {
          const teams = recordsOf(TEAMS, listed, overlay)
          /* The addresses once for the screen rather than once per card, and the
             reason for one card off them. */
          const addresses = addressesIn(teams)
          const refusedFor = (one: PendingItem) =>
            queue.id === 'teams' ? refusal(teamFrom(one, edits), addresses, one) : null
          const waiting = waitingIn(items, decisions, queue.id)

          /* Whether a star is on this screen at all, which is what decides the
             one line that says what a star means (forms/AskedLabel.tsx). Asked
             of the two things that draw one and of nothing else:

             - the three fields a proposed team is corrected in, which are drawn
               once per proposal, so an emptied queue has none;
             - the reason a proposal is sent back, which carries a star unless
               the outcome is a deletion, where a note may be left blank. That is
               the whole of the comments queue, and a legend over it said the
               opposite of the truth about the only field on the screen.

             Guessed at instead, from the name of the queue and from whether a
             box was open, it was drawn over a queue with nothing left in it and
             over a field that may be left empty, and taken away while three
             stars stayed. */
          const openItem = items.find((one) => one.id === open)
          const starsHere =
            (queue.id === 'teams' && waiting.length > 0) ||
            (openItem !== undefined && outcomeFor(queue, openItem) !== 'delete')

          return (
            <>
              {starsHere && (
                <div className="pending__legend">
                  <RequiredNote />
                </div>
              )}

              <div className="pending__bar">
                <h2 className="profile__section" id={waitingId}>
                  {t('review.waiting')} <span className="profile__count">{waiting.length}</span>
                </h2>

                {/* One decision for the whole queue (owner, 01.08.2026). It asks
                    first, because there is nothing to undo: approving is what
                    puts a thing on the portal, and a queue of forty approved by
                    a misplaced click is forty things to find again by hand.

                    On the queue of teams it asks how many are waiting and
                    promises no number, because a proposal the sweep cannot take
                    is left standing: promising two and settling one is the same
                    lie in the question that the line under the button was
                    written to avoid. On the other five nothing is ever left
                    standing, so there the question says the number, and a
                    hedge on all five would be a hedge that means nothing. */}
                {waiting.length > 0 && (
                  <button
                    type="button"
                    className="button button--secondary"
                    /* Held back for the same reason one card is: the sweep is
                       the same decision taken forty times, and taken without the
                       races it is forty half-moves. */
                    aria-disabled={racesUnknown}
                    aria-describedby={racesUnknown ? `${waitingId}-blocked` : undefined}
                    onClick={() => {
                      if (racesUnknown) {
                        return
                      }

                      const ask =
                        queue.id === 'teams'
                          ? 'verification.approveAllAskTeams'
                          : 'verification.approveAllAsk'

                      if (!window.confirm(t(ask, { count: waiting.length }))) {
                        return
                      }

                      /* What it settled, not what it was asked to settle. A
                         proposal whose name is already in the league is left
                         standing, so the count has to be the ones that went
                         through or the line under the button would say a number
                         the queue disagrees with. */
                      setSwept(approveAll(waiting, teams))
                      /* And whatever card had its reason open goes with them:
                         the sweep may settle the very card that box belongs to,
                         and a box open over a card that is no longer there is a
                         reason waiting to be written about nothing. */
                      setOpen(null)


                    }}
                  >
                    {t('verification.approveAll')}
                  </button>
                )}

                {/* Said once for the whole queue rather than on every card: the
                    same sentence under forty cards is the noise a screen reader
                    reads forty times. */}
                {whyNoDecision !== null && (
                  <p className="pending__blocked" id={`${waitingId}-blocked`}>
                    {whyNoDecision}
                  </p>
                )}

                <Swept count={swept} />
              </div>

              {waiting.length === 0 ? (
                <p className="profile__empty">{t('verification.empty')}</p>
              ) : (
                /* Named after the heading above it. The screen now carries the
                   navigation of the whole section as well (SectionNav), so a
                   list with no name is one of two lists on the screen and
                   neither says which. */
                <ul className="submissions" aria-labelledby={waitingId}>
                  {waiting.map((one) => {
                    /* Worked out once for the card, rather than by the button,
                       by what the button points at, and by the line itself. */
                    const why = refusedFor(one)

                    return (
                      <li key={one.id} className="submissions__item">
                        <div className="submissions__head">
                          {/* What it will be called if it is taken, not what it
                              arrived as. A moderator who has just corrected a name
                              in the field below should not read the old one at the
                              top of the same card. */}
                          <h3 className="pending__subject">
                            {queue.id === 'teams' ? teamFrom(one, edits).name : one.subject}
                          </h3>
                          <span className="submissions__meta">
                            {formatShortDate(one.date, locale)}
                          </span>

                          {/* On a telephone a card is a screenful, so five of
                              them mean scrolling through four to reach the
                              third: the card opens on a press and the rest are
                              a list of names (owner, 06.08.2026). From 820px up
                              this control is not drawn and every card is open,
                              exactly as the sectors of the navigation work
                              (SectionNav). */}
                          <button
                            type="button"
                            className="pending__toggle"
                            aria-expanded={shown === one.id}
                            aria-controls={`${one.id}-card`}
                            /* Named after the card it opens: five buttons called
                               "Prikaži" are five controls a screen reader cannot
                               tell apart, which is the rule the rest of the
                               portal keeps. */
                            aria-label={t(
                              shown === one.id
                                ? 'verification.foldCardNamed'
                                : 'verification.openCardNamed',
                              { name: one.subject },
                            )}
                            onClick={() => setShown(shown === one.id ? null : one.id)}
                          >
                            {t(shown === one.id ? 'verification.foldCard' : 'verification.openCard')}
                          </button>
                        </div>

                        <div
                          id={`${one.id}-card`}
                          className={
                            shown === one.id
                              ? 'pending__card pending__card--open'
                              : 'pending__card'
                          }
                        >
                        <p className="submissions__meta">
                          {/* A change of date may be reported by somebody with no
                              account at all (PDL P10), so the sender is a name and
                              a number, or nobody. */}
                          {one.who === ''
                            ? t('verification.sentByAnonymous')
                            : t('verification.sentBy', {
                                who: one.who,
                                memberNumber: one.memberNumber,
                              })}
                        </p>

                        {/* The three things the team will be made of, before it
                            is made (owner, 03.08.2026). Only here: the other five
                            queues decide about something that already exists. */}
                        {queue.id === 'teams' && <TeamFields item={one} />}

                        {/* What the member thought of it, which is the half of a
                            comment the moderator was deciding about without
                            seeing (owner, 06.08.2026). Only here: a rating is
                            about an event and the other six queues are not. */}
                        {queue.id === 'comments' && <RatingGiven rating={one.rating} />}

                        <dl className="pending__facts">
                          {datesOf(one).map((fact) => (
                            <div key={fact.key}>
                              <dt>{t(fact.key)}</dt>
                              <dd>{formatShortDate(fact.value, locale)}</dd>
                            </div>
                          ))}
                          <div className="pending__text">
                            <dt>{bodyLabelFor(one)}</dt>
                            {outcomeFor(queue, one) === 'editAndPublish' ? (
                              <dd className="pending__edit">
                                <EditableBody id={one.id} label={bodyLabelFor(one)} value={one.body} />
                              </dd>
                            ) : (
                              <dd className="pending__body">{one.body}</dd>
                            )}
                          </div>
                        </dl>

                        {open === one.id ? (
                          <SendBack
                            /* Same box, same words, on every queue that hands work
                               back. What the pictures ask for is a reason precise
                               enough to work from, because that reason is what the
                               member reads and changes the picture by.

                               And the comments, which are not handed back at all:
                               there the box asks for a note nobody has to write,
                               a trace for whoever reads the queue next rather
                               than a reason given to anybody (owner,
                               06.08.2026). */
                            placeholderKey={
                              outcomeFor(queue, one) === 'delete'
                                ? 'verification.deleteNotePlaceholder'
                                : outcomeFor(queue, one) === 'instruct'
                                  ? 'review.instructionPlaceholder'
                                  : 'review.reasonPlaceholder'
                            }
                            optional={outcomeFor(queue, one) === 'delete'}
                            aboutKey={
                              outcomeFor(queue, one) === 'delete'
                                ? 'verification.deleteBox'
                                : 'review.sendBackNamed'
                            }
                            /* Named after what it decides, which is what the box
                               is for: without it the group around the words for
                               deleting a comment was called "Odbij", the one
                               word this queue must not use (queues.ts). */
                            subject={one.subject}
                            labelKey={
                              outcomeFor(queue, one) === 'delete'
                                ? 'verification.deleteNote'
                                : 'review.reason'
                            }
                            /* The queue draws that line for the whole screen,
                               counting this box among the reasons to draw it, so
                               the box does not draw a second one. */
                            explain={false}
                            confirmKey={
                              outcomeFor(queue, one) === 'delete'
                                ? 'verification.confirmDelete'
                                : 'review.confirmSendBack'
                            }
                            onConfirm={(reason) => {
                              settle(one.id, {
                                status: 'rejected',
                                note: reason,
                                basis: '',
                                memberNumber: '',
                              })

                              /* A reason the member never reads is a reason to
                                 nobody, and this is the one queue where the member
                                 is expected to act on it. The portal already has an
                                 inbox, so it goes there in the words the moderator
                                 wrote (PDL P22, P28a). */
                              if (outcomeFor(queue, one) === 'instruct') {
                                notify({
                                  from: t('app.name'),
                                  to: one.memberNumber,
                                  subject: t('verification.photoReturned'),
                                  body: reason,
                                  date: today,
                                })
                              }

                              setOpen(null)
                            }}
                            onCancel={() => {
                              setOpen(null)
                              setClosed(one.id)
                            }}
                          />
                        ) : (
                          <div className="member__links">
                            <button
                              type="button"
                              className="button button--primary"
                              /* Not switched off: a control that leaves the row
                                 takes the keyboard with it, and this one is meant
                                 to be reachable so its reason can be read. It says
                                 it cannot act and points at why. */
                              aria-disabled={why !== null || racesUnknown}
                              aria-describedby={
                                why !== null
                                  ? `${one.id}-blocked`
                                  : racesUnknown
                                    ? `${waitingId}-blocked`
                                    : undefined
                              }
                              onClick={() => {
                                /* Accepting a change of date moves the races
                                   with the event, so until they are here there
                                   is nothing to move them by: the event alone
                                   would be the half-move this decision is meant
                                   to make whole (moveEvent). */
                                if (!racesUnknown) {
                                  approveAll([one], teams)
                                }
                              }}
                            >
                              {outcomeFor(queue, one) === 'editAndPublish'
                                ? t('verification.publish')
                                : t('review.approve')}
                            </button>

                            {/* Deleting opens the same box the refusals open,
                                and asks for a note that may be left empty
                                (owner, 06.08.2026). Nothing is sent to the
                                member either way. The note is not read on any
                                screen since the tables of settled items were
                                taken away (owner, 06.08.2026); it is written
                                down because it is what the database will be
                                given when there is one, and because a deletion
                                that records nothing about itself cannot be
                                answered for. */}
                            {outcomeFor(queue, one) === 'delete' && (
                              <button
                                type="button"
                                className="button button--secondary"
                                /* The visible word is inside the name it is
                                   read by, which is what speech input works
                                   from (WCAG 2.2 SC 2.5.3): "Obriši: X" and not
                                   "Brisanje komentara: X", which does not
                                   contain the word on the button. Every other
                                   named control on the portal is written this
                                   way. */
                                aria-label={t('verification.deleteNamed', { name: one.subject })}
                                onClick={() => setOpen(one.id)}
                              >
                                {t('verification.delete')}
                              </button>
                            )}

                            {/* The focus comes back to this button with it, on the
                                render that brings it back and on no other: nothing
                                is autofocused when the page first draws. A
                                biography has no button here at all, because it
                                never goes back. */}
                            {handsBack(queue, one) && canSendBack(queue, one) && (
                              <button
                                type="button"
                                className="button button--secondary"
                                autoFocus={one.id === closed}
                                onClick={() => setOpen(one.id)}
                              >
                                {t('review.sendBack')}
                              </button>
                            )}

                            {/* Why approving would do nothing, said on the card
                                rather than left to a press that changes nothing.
                                The moderator has the fields above to put it right,
                                or the way back to hand it to whoever sent it. */}
                            {queue.id === 'teams' && (
                              <Refused why={why} id={`${one.id}-blocked`} />
                            )}

                            {/* And where it cannot go back, the button is gone and
                                the reason is on screen in its place. A control
                                that quietly does nothing teaches a moderator that
                                the screen is broken; this one says which fact is
                                missing and that it is not his to fix. */}
                            {handsBack(queue, one) && !canSendBack(queue, one) && (
                              <p className="pending__blocked">{t('verification.noRecipient')}</p>
                            )}
                          </div>
                        )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}

            </>
          )
        }}
      </Resource>
    </div>
  )
}
