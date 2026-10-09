import { useRef, useState } from 'react'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import { outsideHost, outsideLink } from '../../data/outsideLink'
import { raceKind } from '../../data/raceKind'
import { pointsOf } from '../../data/scoring'
import type { RaceKind, WaitingRun } from '../../data/types'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { fromBoxes, inBoxes, noTime } from '../../forms/clock'
import { storedNumber } from '../../forms/numberField'
import { validateField } from '../../forms/validate'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { figuresAsked, type Figure } from './amendFields'
import { useWaitingRuns, waitingIn } from './pending'
import { QueueMeta } from './QueueMeta'
import { QUEUE, refusalTo } from './queues'
import { Swept } from './Swept'
import { aRefusal, anApproval, anApprovalWith, decisionPath, type Answered } from './verificationWrites'
import { WhatTheServerSaid } from './WhatTheServerSaid'
import '../../styles/outsideLink.css'
import '../member/Member.css'
/* For `.pending__bar`, the row that carries the heading and the one decision
   for the whole queue. Every sheet is bundled into one and the class would work
   without the import; the import is what says where the class comes from, so
   deleting the sheet breaks the build rather than the screen (ADL A7). */
import './Verification.css'

/* Every result that has been sent in and not yet decided, as one table, READ FROM THE
 * SERVER AND DECIDED ON IT (R1 of the results flows).
 *
 * A table because the work is comparison: the same columns, in the same places,
 * down a list of thirty. Cards read well one at a time and were useless in bulk.
 *
 * A result enters the standings only once it is approved, so until then it does
 * not exist for anybody but its author (PDL P9).
 *
 * **Until R1 this screen read and wrote the browser's session**: a result waited there,
 * was approved there, and a race the calendar did not hold was made there. So a decision
 * taken in one browser was a decision nobody else ever heard of, and the standings never
 * moved. The route that does the work, `POST /api/verification/{id}/decision`, is what
 * every press here asks now, in the order the queue of cards already asks it in
 * (`PendingQueue.tsx`): the server decides, and only the answer that says it did is
 * written down in the session (`settle`), which is what takes the row off this table and
 * the count off the navigation at once.
 *
 * **What the server answers is what an approval would count** (`VerificationApi`): the race
 * as it is named and measured today, the day it was run beside the day it was sent, and
 * the four figures with those the race fixes taken off the race. So the moderator decides on
 * the numbers his approval writes.
 */

/** A row the route would not settle, and what it said about it. Carried with the row's
 *  identity because the sentence belongs on the row it is about. */
type ServerRefusal = { id: string; answer: Exclude<Answer, { got: 'done' }> }

/**
 * Whether this is a run on a race the calendar does not hold: a run, because it carries the
 * day it was run, and on no race of the calendar. A row naming no run carries neither and is
 * not one. Asked in one place, because the mark in the corner of the row and the sentence
 * that counts what a sweep stepped over are about the same rows.
 */
function onARaceNotInTheCalendar(one: WaitingRun): boolean {
  return one.raceId === null && one.raceDate !== null
}

/** The four figures a run is counted on, all of them there. */
type Counted = { distanceKm: number; ascentM: number; descentM: number; seconds: number }

/**
 * THE FIGURES A RUN WOULD BE COUNTED AT, or nothing where the row carries none.
 *
 * <p>Nothing on exactly one kind of row, and it is a state the schema permits rather than a
 * fault: V10 lets a results row name no submission („A results row without a submission is a
 * real thing"), the server then answers all four as nothing, and approving such a row is
 * refused with „Stavka ne nosi prijavljen rezultat." Nothing writes one today. Asked once,
 * here, so the table, the points and the panel cannot each decide it their own way.
 */
function countedOf(one: WaitingRun): Counted | null {
  if (one.distanceKm === null || one.ascentM === null || one.descentM === null || one.seconds === null) {
    return null
  }

  return { distanceKm: one.distanceKm, ascentM: one.ascentM, descentM: one.descentM, seconds: one.seconds }
}

/**
 * The boxes of the panel as they are written, and they are text because a box holds text.
 * All six are always held, and a race of each kind draws its own few of them
 * (`figuresAsked`), so a box the kind does not ask for is simply never drawn.
 */
type Written = Record<Figure, string>

/** The panel that sets the runner's figures before approving, open on one row. */
type Fixing = { id: string; kind: RaceKind; written: Written }

/** The boxes seeded with the figures the row shows, so the moderator corrects a number
 *  rather than typing every one again. The distance with the dot the server keeps, which
 *  a box reads exactly as it reads the comma (`forms/numberField.ts`). */
function writtenFrom(counted: Counted): Written {
  return {
    distanceKm: String(counted.distanceKm),
    ascentM: String(counted.ascentM),
    descentM: String(counted.descentM),
    ...inBoxes(counted.seconds),
  }
}

export function ReviewQueue() {
  const { locale, t } = useI18n()
  const { decisions, settle } = useSession()
  const state = useWaitingRuns()
  /* Which result the reason box is open on: the id the decision is written under, and the
     member the refusal will reach, both taken when the box is opened from the row. */
  const [open, setOpen] = useState<{ id: string; memberNumber: string } | null>(null)
  const [note, setNote] = useState('')
  /**
   * The panel that sets the runner's figures, and the boxes as they stand.
   *
   * <p>Its own state and not the one above, because the two answer different questions and
   * both may be reached from the same row: the reason box refuses, this one approves at
   * figures of the moderator's own. **What it holds lives here and nowhere else until it is
   * sent**, inside the approval itself (`anApprovalWith`): one request, so no other moderator
   * can meet a run half changed, and nothing is left to undo when the approval is refused.
   * The cost, accepted with the plan of R1: a correction typed here does not survive the page
   * being reloaded before it is approved.
   */
  const [fixing, setFixing] = useState<Fixing | null>(null)
  /** How many the last sweep settled, and null until there has been one. */
  const [swept, setSwept] = useState<number | null>(null)
  /** The one row the route last refused, and what it said. */
  const [said, setSaid] = useState<ServerRefusal | null>(null)
  /**
   * Whether a decision is out with the route, so a second press before the first has
   * answered cannot send a second one.
   *
   * <p>A ref and a state, which is the arrangement `PendingQueue.tsx` has and its reason: a
   * second click fired before the render the state would cause reads the ref, and the
   * buttons read the state to say they are inert while one is out.
   */
  const outstanding = useRef(false)
  const [deciding, setDeciding] = useState(false)
  /**
   * THE RUN WHOSE SINGLE DECISION IS OUT WITH THE ROUTE, or nothing where none is: which of the two
   * boxes is waiting for an answer, which `deciding` above cannot say.
   *
   * <p><b>„Ne", „Odustani" i Escape dok zahtev još putuje ka serveru su onemogućeni, uz vidljivo
   * stanje rada</b> (owner, 02.10.2026, choosing between three outcomes he was priced; PDL, „Odluke iz
   * ciscenja nalaza"), and the second item of the same day names the reason box among the screens it
   * holds for (anchor „Odbijanje zatvara pitanje kao i uspeh": „vraćanje sa razlogom"). A box put away
   * over a request that goes on is a box whose answer arrives to nothing: the reason typed in it is
   * gone, and a refusal that comes back is read against no words. So the box over the run of a
   * decision that is out tells „Odustani" off and says in words that it is sending (`SendBack.tsx`,
   * `working`, is the precedent, and so is the queue of cards), and the answer closes it
   * (`closeOver`), whichever answer it is.
   *
   * <p><b>The run and not the flag</b>, for the reason the queue of cards gives (`PendingQueue.tsx`,
   * `handingBack`): `deciding` is true for any decision on the tab, a sweep among them, and a box
   * opened over ANOTHER run has nothing of its own out. Told off for work that is not its own it would
   * say a request is out that is not, and its „Odustani" would refuse the moderator who opened it to
   * think.
   *
   * <p><b>What this does not cover, written down rather than left to be found.</b> The sweep: it asks the
   * route about one run after another and closes the boxes over the runs it settled when it is done
   * (`closeOver`), so a box over the run it is asking about is not told off meanwhile. And a box that
   * is REPLACED: the buttons that open a box are never told off (opening decides nothing), so a
   * moderator can open one over another run while a request is out, as he can on the queue of cards;
   * the request goes on, and its answer settles its own run.
   */
  const [outFor, setOutFor] = useState<string | null>(null)

  /** Both panels close over a row once its answer is in, whichever answer it was: the owner's
   *  choice of 02.10.2026 among the outcomes offered, in the record's wording (PDL „Odbijanje
   *  zatvara pitanje kao i uspeh"): „na svaki odgovor servera pitanje se zatvara, a razlog
   *  odbijanja stoji uz dugme". Only that row's: a box open on another row is the moderator's
   *  next piece of work. */
  const closeOver = (ids: ReadonlySet<string>): void => {
    setOpen((now) => (now !== null && ids.has(now.id) ? null : now))
    setFixing((now) => (now !== null && ids.has(now.id) ? null : now))
  }

  /**
   * ONE ROW TO THE ROUTE, and what is written down here only once it says it did it.
   *
   * <p>`settle` takes the row off this table and the number off the navigation at once,
   * through the same `decisions` every other queue is counted against (`queues.ts`,
   * `countFor`). The cached answer is dropped as well, so a screen mounted later reads the
   * server and not this visit's first answer (`PendingQueue.tsx` says why, and what it cost
   * when it was not). An approval drops the results too: it is the one decision on the
   * portal that changes the standings, and a table read before it would go on drawing them
   * as they were.
   *
   * <p>**No message is written to the member from here, unlike until R1.** The route writes
   * the line in his inbox itself on a refusal (`VerificationWriteApi.tell`) and posts the
   * letter on an approval, so a second line written in the browser would be the same message
   * in two homes.
   *
   * @return whether the route recorded it
   */
  const sendOne = async (one: WaitingRun, answered: Answered): Promise<boolean> => {
    const answer = await askTheServer(decisionPath(one.id), answered)

    if (answer.got !== 'done') {
      setSaid({ id: one.id, answer })

      return false
    }

    settle(one.id, {
      status: answered.approved ? 'approved' : 'rejected',
      note: answered.reason,
      basis: '',
      memberNumber: '',
    })

    return true
  }

  /** A single row's decision, guarded against a second press while one is out. */
  const decide = async (one: WaitingRun, answered: Answered): Promise<void> => {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setDeciding(true)
    setOutFor(one.id)

    try {
      if (await sendOne(one, answered)) {
        setSaid(null)
        clearResourceCache('verification')

        if (answered.approved) {
          clearResourceCache('results')
        }
      }

      closeOver(new Set([one.id]))
    } finally {
      outstanding.current = false
      setDeciding(false)
      setOutFor(null)
    }
  }

  /**
   * THE SWEEP: every run on a race the calendar holds, approved as it stands, one after
   * another.
   *
   * <p><b>A run on a race the calendar does not hold is stepped over</b> (owner, 31.08.2026,
   * choosing this over making them in a sweep), and so is a row that names no run. Neither can
   * be approved from here since R1: the server refuses both with a sentence of its own until
   * the decision over a race the calendar does not hold is built on the server (R3).
   *
   * <p><b>One after another and never at once</b>, for the reason the queue of cards gives:
   * the route takes one decision per row, and forty requests released together are forty
   * answers arriving in no order over one table.
   */
  const sweep = async (rows: WaitingRun[]): Promise<void> => {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setDeciding(true)

    try {
      const refusals: ServerRefusal[] = []
      const settled = new Set<string>()

      for (const one of rows) {
        const answer = await askTheServer(decisionPath(one.id), anApproval())

        if (answer.got !== 'done') {
          refusals.push({ id: one.id, answer })

          continue
        }

        settle(one.id, { status: 'approved', note: '', basis: '', memberNumber: '' })
        settled.add(one.id)
      }

      if (settled.size > 0) {
        clearResourceCache('verification')
        clearResourceCache('results')
      }

      /* The first refusal, on the row it is about, or nothing where every one went through. */
      setSaid(refusals[0] ?? null)
      closeOver(settled)
      setSwept(settled.size)
    } finally {
      outstanding.current = false
      setDeciding(false)
    }
  }

  /* Whether the decision that is out is about the run each box is open over, which is all that
     „working" means to the two of them (`outFor` says why it is the run and not `deciding`). */
  const reasonIsWorking = open !== null && open.id === outFor
  const panelIsWorking = fixing !== null && fixing.id === outFor

  return (
    <div className="member">
      <QueueMeta queue={QUEUE.results} />

      {/* As on the other queues: the name is in the navigation and in the tab, and what
          stood above the work is gone (owner, 30.07.2026). */}
      <h1 className="visually-hidden">{t('review.title')}</h1>

      <Resource state={state}>
        {(runs) => {
          const waiting = waitingIn(runs, decisions, QUEUE.results.id)
          /* What the sweep may approve: a run on a race the calendar holds. Asked once, so
             whether the sweep is offered, the number it asks about and the rows it walks
             are one list. */
          const sweepable = waiting.filter((one) => one.raceId !== null)
          const leftOver = waiting.filter(onARaceNotInTheCalendar).length
          const fixingRow = waiting.find((one) => one.id === fixing?.id)

          return (
            <>
              <div className="pending__bar">
                <h2 className="profile__section">
                  {t('review.waiting')} <span className="profile__count">{waiting.length}</span>
                </h2>

                {/* One decision for the whole queue (owner, 01.08.2026), offered only
                    where there is something for it to do: asked of everything waiting it
                    stood over a queue it would step over whole, and asked „Odobriti 0
                    stavki?" (review, 31.08.2026). It asks first, because an approval puts a
                    result into the standings and nothing undoes it. */}
                {sweepable.length > 0 && (
                  <button
                    type="button"
                    className="button button--secondary"
                    aria-disabled={deciding}
                    onClick={() => {
                      if (
                        deciding ||
                        !window.confirm(t('verification.approveAllAsk', { count: sweepable.length }))
                      ) {
                        return
                      }

                      void sweep(sweepable)
                    }}
                  >
                    {t('verification.approveAll')}
                  </button>
                )}

                <Swept count={swept} />

                {/* And how many the sweep stepped over, said where it says what it did:
                    without it the queue simply does not empty and nothing says why (owner,
                    31.08.2026). Only after a sweep, since before one there is nothing to
                    explain. */}
                {swept !== null && leftOver > 0 && (
                  <p className="profile__empty">{t('review.sweptLeft', { count: leftOver })}</p>
                )}
              </div>

              {waiting.length === 0 ? (
                <p className="profile__empty">{t('review.empty')}</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <caption className="visually-hidden">{t('review.waiting')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('newResult.date')}</th>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        {/* „Trka" and not „Događaj": what stands in this column is the race
                            (owner, 23.08.2026). */}
                        <th scope="col">{t('profile.columns.race')}</th>
                        {/* The day it was sent, in a column of its own and never in place of
                            the day it was run (owner, 18.09.2026: „Odnosno verifikator vidi kad
                            je rezultat poslat"): two days in one column would be read as one.
                            Fourth and not second, because the shared table reads its first
                            three columns from the left by position (`styles/table.css`), and
                            the race is words: placed second, this column pushed the race to
                            the fourth place and right-aligned it, measured at 360 and 1280. */}
                        <th scope="col" className="table__hide-phone">
                          {t('review.sentOn')}
                        </th>
                        <th scope="col" className="table__hide-phone">
                          {t('profile.columns.distance')}
                        </th>
                        <th scope="col" className="table__hide-phone">
                          {t('rankings.columns.ascent')}
                        </th>
                        <th scope="col" className="table__hide-phone">
                          {t('rankings.columns.descent')}
                        </th>
                        <th scope="col">{t('profile.columns.time')}</th>
                        <th scope="col" className="table__hide-phone">
                          {t('profile.columns.points')}
                        </th>
                        <th scope="col">{t('review.decision')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waiting.map((one) => {
                        const counted = countedOf(one)

                        return (
                          <tr key={one.id}>
                            <td>{one.raceDate === null ? '' : formatShortDate(one.raceDate, locale)}</td>
                            <td>{one.memberNumber}</td>
                            <td>
                              {/* That the calendar does not hold this race, said in the corner
                                  of the row (owner, 31.08.2026: „te trke treba da imaju posebnu
                                  naznaku NOVO negde u ćošku"). A run with a day and no race is
                                  what that is; a row naming no run has neither and is not one. */}
                              {onARaceNotInTheCalendar(one) && (
                                <span className="review__new">
                                  {t('review.newRace')}
                                  {/* And what it means, for whoever cannot see a corner. */}
                                  <span className="visually-hidden">{t('review.newRaceTitle')}</span>
                                </span>
                              )}
                              {/* A link only where the address is one this portal is willing to
                                  hand a browser (`data/outsideLink.ts` says why both sides ask),
                                  and the name alone otherwise, saying that something was sent
                                  which the portal will not open. The race and not the event it
                                  was run at (owner, 23.08.2026), as it is named today. */}
                              {outsideLink(one.link) === undefined ? (
                                <>
                                  {one.subject}
                                  {one.link !== '' && (
                                    <span className="outside-host">{t('review.unusableLink')}</span>
                                  )}
                                </>
                              ) : (
                                /* `noreferrer` because the host is one the member chose, and
                                   without it the address of this administrative screen travels
                                   there in the `Referer`; `noopener` is written out rather than
                                   left to a browser's default. */
                                <a href={outsideLink(one.link)} rel="noreferrer noopener" target="_blank">
                                  {one.subject}
                                  <span className="outside-host">{outsideHost(one.link)}</span>
                                </a>
                              )}
                              {/* That this corrects a result already counted, and nothing about
                                  what changed (owner, 27.08.2026: „samo labela, ne šta je
                                  ispravljano"). */}
                              {one.kind === 'correction' && (
                                <span className="tag tag--corrected">{t('admin.corrected')}</span>
                              )}
                              {/* What the member wrote in his own words: a start number, a watch
                                  that stopped. Its own line and never the link, which it once
                                  was, and became an address made of his sentence. */}
                              {one.body !== '' && <span className="review__said">{one.body}</span>}
                            </td>
                            <td className="table__hide-phone">{formatShortDate(one.date, locale)}</td>
                            <td className="table__hide-phone">
                              {counted === null ? '' : formatNumber(counted.distanceKm, locale, 2)}
                            </td>
                            <td className="table__hide-phone">
                              {counted === null ? '' : formatNumber(counted.ascentM, locale)}
                            </td>
                            <td className="table__hide-phone">
                              {counted === null ? '' : formatNumber(counted.descentM, locale)}
                            </td>
                            <td>{counted === null ? '' : formatDuration(counted.seconds)}</td>
                            {/* What the approval would award, worked out by the formula every
                                screen of this portal shows points by (`data/scoring.ts`) from
                                the figures beside it. The server works them out again when it
                                counts the run, and only that number enters the standings
                                (owner, 31.08.2026: „bodovi treba da se dodele tek NAKON
                                verifikacije"). */}
                            <td className="table__hide-phone">
                              {counted === null
                                ? ''
                                : formatPoints(
                                    pointsOf(counted.distanceKm, counted.ascentM, counted.descentM, counted.seconds),
                                    locale,
                                  )}
                            </td>
                            <td>
                              {/* The buttons in a box inside the cell, never on the cell itself:
                                  a `td` laid out as a flex container leaves the table and stops
                                  lining up with the row (Member.css). */}
                              <div className="review__decide">
                                <button
                                  type="button"
                                  className="button button--primary"
                                  aria-disabled={deciding}
                                  onClick={() => {
                                    void decide(one, anApproval())
                                  }}
                                >
                                  {t('review.approve')}
                                </button>
                                {/* Opening a box decides nothing, so it is never told off; what
                                    the box sends is, while a decision is out (`decide`). */}
                                <button
                                  type="button"
                                  className="button button--secondary"
                                  onClick={() => {
                                    setFixing(null)
                                    setOpen({ id: one.id, memberNumber: one.memberNumber })
                                    setNote('')
                                  }}
                                >
                                  {t('review.sendBack')}
                                </button>
                                {/* The figures may be set only on a race the calendar holds: there
                                    the race answers which of them it fixes, and the route counts
                                    the rest at the moderator's numbers. A race it does not hold
                                    cannot be approved from here until R3, and a row naming no run
                                    has no figures to set. */}
                                {one.raceId !== null && counted !== null && (
                                  <button
                                    type="button"
                                    className="button button--secondary"
                                    onClick={() => {
                                      setOpen(null)
                                      setFixing({ id: one.id, kind: raceKind(one.raceKind), written: writtenFrom(counted) })
                                    }}
                                  >
                                    {t('review.amend')}
                                  </button>
                                )}
                              </div>
                              {said?.id === one.id && <WhatTheServerSaid answer={said.answer} />}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {fixing !== null && fixingRow !== undefined && (
                <AmendPanel
                  fixing={fixing}
                  deciding={deciding}
                  working={panelIsWorking}
                  onChange={setFixing}
                  onApprove={(amended) => {
                    void decide(fixingRow, anApprovalWith(amended))
                  }}
                  onCancel={() => setFixing(null)}
                />
              )}

              {open !== null && (
                <div className="review__reason" role="group" aria-label={t('review.sendBack')}>
                  {/* Obligatory, and it says so both ways: the star for the eye and
                      `aria-required` for a reader (owner, 12.08.2026, „na svim formama za
                      unos i verifikaciju"). */}
                  <RequiredNote />

                  <div className="rankings__field rankings__field--wide">
                    <AskedLabel id="review-reason">{t('review.reason')}</AskedLabel>
                    <input
                      id="review-reason"
                      type="text"
                      value={note}
                      aria-required="true"
                      /* What the box promises is what this item will do, asked of the one
                         rule that decides it (queues.ts) rather than written out here. */
                      placeholder={t(
                        refusalTo(QUEUE.results, { kind: '', memberNumber: open.memberNumber }) === null
                          ? 'review.reasonKeptPlaceholder'
                          : 'review.reasonPlaceholder',
                      )}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>
                  <div className="member__links">
                    <button
                      type="button"
                      className="button button--primary"
                      /* Written means written, spaces taken off, exactly as the forms decide
                         it (src/forms/validate.ts). Told off rather than switched off:
                         `disabled` takes the button out of the tab order and the line below
                         that says why with it. */
                      aria-disabled={note.trim() === '' || deciding}
                      aria-describedby={note.trim() === '' ? 'review-reason-waits' : undefined}
                      onClick={() => {
                        const row = waiting.find((each) => each.id === open.id)

                        /* Reachable means pressable, so the refusal lives here too. The row is
                           asked for again because a sweep may have settled it while the box
                           stood open, and then there is nothing left to refuse. */
                        if (note.trim() === '' || row === undefined) {
                          return
                        }

                        void decide(row, aRefusal(note.trim()))
                      }}
                    >
                      {t('review.confirmSendBack')}
                    </button>
                    {/* Told off, not switched off, and refused in its own handler as well, exactly
                        as `SendBack.tsx` has it: while the refusal this box sent is out, putting the
                        box away would close it over a request that goes on and take the reason with
                        it (owner, 02.10.2026: „Ne", „Odustani" i Escape dok zahtev još putuje ka
                        serveru su onemogućeni). Nothing here handles Escape, so there is no key to
                        refuse (`DeleteRecord` says the same of itself). */}
                    <button
                      type="button"
                      className="button button--secondary"
                      aria-disabled={reasonIsWorking ? true : undefined}
                      onClick={() => {
                        if (reasonIsWorking) {
                          return
                        }

                        setOpen(null)
                      }}
                    >
                      {t('review.cancel')}
                    </button>
                  </div>

                  {/* SAID IN WORDS, ONLY WHILE IT IS TRUE (WCAG 2.2 AA, 4.1.3), in the portal's own
                      sentence for a request that is out (`results.sending`, as `SendBack.tsx` draws
                      it). It stands beside the line under it only if the moderator empties the field
                      while the request is out, which changes nothing about a request already sent:
                      the field is not locked, as it is not in `SendBack.tsx`. */}
                  {reasonIsWorking && (
                    <p className="rate__hint" role="status">
                      {t('results.sending')}
                    </p>
                  )}

                  {/* Why it will not go yet, said where it can be read rather than left to a
                      button that is simply dead. */}
                  {note.trim() === '' && (
                    <p id="review-reason-waits" className="rate__hint" role="status">
                      {t('review.reasonNeeded')}
                    </p>
                  )}
                </div>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}

/**
 * THE PANEL THAT APPROVES A RUN AT FIGURES OF THE MODERATOR'S OWN.
 *
 * <p><b>What it asks is what the member's own form asks on a race of this kind</b>
 * (`admin/amendFields.ts`): the time on a race of a length, the distance, the climb and the
 * drop on a race to a limit, all four on a free race. A figure the race fixes is never
 * offered, because it is corrected on the race, where the correction reaches everybody who
 * ran it. Each box is held to the rule that box is held to on that form, in the words that
 * form uses (`forms/validate.ts`), and the time to „not nought" (owner, 31.08.2026: „Ne sme da
 * se popuni 0:0:0!").
 *
 * <p><b>Nothing is said to the member per change</b>: the owner's decision of 30.08.2026 is one
 * standing sentence in the rulebook rather than a note beside each run.
 */
function AmendPanel({
  fixing,
  deciding,
  working,
  onChange,
  onApprove,
  onCancel,
}: {
  fixing: Fixing
  deciding: boolean
  /**
   * Whether the decision about the run this panel is open over is out with the route.
   *
   * <p><b>While it is, „Odustani" answers nothing</b> (owner, 02.10.2026: „Ne", „Odustani" i Escape
   * dok zahtev još putuje ka serveru su onemogućeni, uz vidljivo stanje rada): putting the panel away
   * would close it over an approval that goes on, with the figures the moderator typed gone while
   * the approval they belong to is still on its way. It says so with `aria-disabled`, is refused in its
   * handler as well, and the portal's own sentence for a request that is out is said under the
   * buttons. The caller closes the panel when the answer arrives, whichever answer it is. Not
   * `deciding`: that is true for any decision on the tab, and a panel open over another run has
   * nothing of its own out (`outFor` in `ReviewQueue` says why).
   */
  working: boolean
  onChange: (next: Fixing) => void
  onApprove: (amended: { distanceKm?: number; ascentM?: number; descentM?: number; seconds?: number }) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const asked = figuresAsked(fixing.kind)
  const has = (name: Figure): boolean => asked.some((one) => one.name === name)
  /* Box by box, in the order they are drawn, and kept per box: a form draws each message
     under its own field, so each control says of itself that it is wrong, and the line
     below names the box its sentence came from (review, 31.08.2026). */
  const errors = new Map(
    asked.flatMap(({ name, field }) => {
      const wrong = validateField(field, fixing.written[name])

      return wrong === null ? [] : [[name, { label: field.labelKey, said: wrong }] as const]
    }),
  )
  const wrong = [...errors.values()][0] ?? null
  /* The box before the sum, and that order is the point: a box holding a minus or a word
     makes the sum negative or not a number, which reads as „no time" and would name a
     problem nobody has while hiding the one they do. */
  const waits = wrong !== null || (has('seconds') && noTime(fixing.written))

  return (
    <div className="review__reason" role="group" aria-label={t('review.amendTitle')}>
      {/* What this panel is for, said before the boxes: the figures the race fixes are not
          the moderator's to set on one run. */}
      <p className="profile__empty">{t('review.amendNote')}</p>

      <RequiredNote />

      {asked.map(({ name, field }) => (
        <div className="rankings__field" key={name}>
          <AskedLabel id={`amend-${name}`}>{t(field.labelKey)}</AskedLabel>
          <input
            id={`amend-${name}`}
            type="text"
            inputMode={field.integer === true ? 'numeric' : 'decimal'}
            aria-required="true"
            aria-invalid={errors.has(name)}
            value={fixing.written[name]}
            onChange={(event) => onChange({ ...fixing, written: { ...fixing.written, [name]: event.target.value } })}
          />
        </div>
      ))}

      <div className="member__links">
        <button
          type="button"
          className="button button--primary"
          aria-disabled={waits || deciding}
          aria-describedby={waits ? 'amend-waits' : undefined}
          onClick={() => {
            /* Reachable means pressable, as everywhere else on this portal, so the refusal
               lives here as well as on the attribute above. A decision already out is held back
               by `decide`, as it is for every other button of this queue, and not here a
               second time. */
            if (waits) {
              return
            }

            /* Read the way a form leaves by (`forms/numberField.ts`, `storedNumber`): the one
               comma a box may hold is the separator of the decimals. The time is the sum of
               its three boxes (`forms/clock.ts`), because the route keeps seconds. Only what
               was asked travels, so the figures the race fixes are never sent at all. */
            const number = (name: Figure): number => Number(storedNumber(fixing.written[name].trim()))

            onApprove({
              ...(has('distanceKm') ? { distanceKm: number('distanceKm') } : {}),
              ...(has('ascentM') ? { ascentM: number('ascentM') } : {}),
              ...(has('descentM') ? { descentM: number('descentM') } : {}),
              ...(has('seconds') ? { seconds: fromBoxes(fixing.written) } : {}),
            })
          }}
        >
          {t('review.amendSave')}
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-disabled={working ? true : undefined}
          onClick={() => {
            /* PUT AWAY ONLY WHEN NOTHING IS OUT, for the reason `working` gives. */
            if (working) {
              return
            }

            onCancel()
          }}
        >
          {t('review.amendCancel')}
        </button>
      </div>

      {/* SAID IN WORDS, ONLY WHILE IT IS TRUE (WCAG 2.2 AA, 4.1.3), in the portal's own sentence for
          a request that is out (`results.sending`), under the buttons that cannot act. */}
      {working && (
        <p className="rate__hint" role="status">
          {t('results.sending')}
        </p>
      )}

      {/* And why it will not go, said rather than left to be guessed. */}
      {waits && (
        <p className="field__error" id="amend-waits">
          {wrong === null ? t('newResult.needsTime') : `${t(wrong.label)}: ${t(wrong.said.key, wrong.said.params)}`}
        </p>
      )}
    </div>
  )
}
