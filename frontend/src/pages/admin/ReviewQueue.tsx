import { useState } from 'react'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../../i18n/format'
import { outsideHost, outsideLink } from '../../data/outsideLink'
import { useI18n } from '../../i18n/useI18n'
import { useToday } from '../../clock/useClock'
import { useSession } from '../../session/useSession'
import { QueueMeta } from './QueueMeta'
import { QUEUE, refusalTo } from './queues'
import { Swept } from './Swept'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { inBoxes, fromBoxes, noTime, type WrittenBoxes } from '../../forms/clock'
import { dogadjaj, unosRezultata } from '../../forms/definitions'
import { validateField } from '../../forms/validate'
import type { FieldDef } from '../../forms/types'
import { raceKind } from '../../data/raceKind'
import { RACE_KINDS, type RaceKind } from '../../data/types'
import '../../styles/outsideLink.css'
import '../member/Member.css'
/* For `.pending__bar`, the row that carries the heading and the one decision
   for the whole queue. Every sheet is bundled into one and the class would work
   without the import; the import is what says where the class comes from, so
   deleting the sheet breaks the build rather than the screen (ADL A7). */
import './Verification.css'

/* Every result that has been sent in and not yet decided, as one table.
 *
 * A table because the work is comparison: the same columns, in the same places,
 * down a list of thirty. Cards read well one at a time and were useless in bulk.
 *
 * A result enters the standings only once it is approved, so until then it does
 * not exist for anybody but its author (PDL P9).
 *
 * Two kinds of change are not the same thing, and the screen says so. Refusing
 * a result, or correcting the time, carries a reason, because both touch what
 * the member claims to have done. Correcting the distance, the name or the
 * climb does not: those are set from the official data, which is announced in
 * the terms rather than argued case by case.
 */
/** The fields this panel checks what is written into, each by the definition that
 *  owns it: the race, the three boxes of a time and the event. The kind is not
 *  among them, because a list of three offered values cannot hold a fourth.
 *  them: the same labels, the same bounds, the same rule about being filled in.
 *  Taken from the definition rather than restated, the way the queue of teams
 *  reads its own limit (`pages/admin/PendingQueue.tsx`). */
const ASKED = new Map<string, FieldDef>([
  ...unosRezultata.fields
    .filter((one) => ['raceName', 'hours', 'minutes', 'seconds'].includes(one.name))
    .map((one): [string, FieldDef] => [one.name, one]),
  /* And the event by its own definition, not by the race's. The two happen to
     agree today, so the difference is invisible until one of them moves: raising
     the event's own limit left this panel still refusing a name of 130 characters
     that the administration would take (measured in review, 31.08.2026). */
  ...dogadjaj.fields
    .filter((one) => one.name === 'name')
    .map((one): [string, FieldDef] => ['eventName', one]),
])

export function ReviewQueue() {
  const { locale, t } = useI18n()
  const { submissions, decide, notify, amend } = useSession()
  const today = useToday()
  /* Which result the reason box is open on: the id the decision is written
     under, and the member the refusal is written to. Both taken when the box is
     opened, from the row it was opened from, so the moment of sending has
     nothing left to look up and no case where the lookup fails. */
  const [open, setOpen] = useState<{ id: string; memberNumber: string } | null>(null)
  const [note, setNote] = useState('')
  /**
   * The submission being put right, with the boxes as they stand.
   *
   * Its own state and not the one above, because the two panels answer different
   * questions and both may be reached from the same row: the reason box refuses,
   * this one corrects before deciding. Held as text, since that is what a box
   * holds, and turned back into a number only when it is saved.
   */
  const [fixing, setFixing] = useState<
    { id: string; eventName: string; raceName: string; raceKind: RaceKind } & WrittenBoxes | null
  >(null)
  /** How many the last sweep settled, and null until there has been one. */
  const [swept, setSwept] = useState<number | null>(null)

  const waiting = submissions.filter((one) => one.status === 'pending')

  /* What this panel writes goes into the very fields the member's own form asks
     for, so what may stand in them is the same question, asked of the same place.
     Written by hand it was narrower than the form and let through what the form
     refuses: minus five hours (which the table then drew as 00:00), a thousand
     minutes, one and a half hours, `Infinity`, and a race with no name at all.
     Worse than wrong on this screen: a result refused after such a correction
     came back to the member with `-5` in a box they never touched, and their own
     form turned it down (measured in review, 31.08.2026). */
  const wrongBox = (name: string, written: string) => {
    const field = ASKED.get(name)

    /* A name this file asks for that the form does not define is a mistake in
       this file, and it refuses rather than letting the value through unchecked. */
    return field === undefined || validateField(field, written) !== null
  }

  return (
    <div className="member">
      <QueueMeta queue={QUEUE.results} />

      {/* As on the other seven queues: the name is in the navigation and in the
          tab, and what stood above the work is gone (owner, 30.07.2026). */}
      <h1 className="visually-hidden">{t('review.title')}</h1>

      <div className="pending__bar">
        <h2 className="profile__section">
          {t('review.waiting')} <span className="profile__count">{waiting.length}</span>
        </h2>

        {/* One decision for the whole queue, as on the six that share a screen
            (owner, 01.08.2026). This is the queue he described it for: thirty
            results in a week, most of them from members who have been sending
            the same kind of thing for years.

            It asks first, because there is nothing to undo. Approving is what
            puts a result into the standings, and a queue of thirty approved by
            a misplaced click is thirty results to find again by hand.

            Nothing is written down on an approval here, the same as pressing
            the button in every row: a reason belongs to a refusal. */}
        {waiting.length > 0 && (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              if (!window.confirm(t('verification.approveAllAsk', { count: waiting.length }))) {
                return
              }

              for (const one of waiting) {
                decide(one.id, 'approved', '')
              }

              /* The box stands below the table. Left open over a result that
                 the sweep has just approved, confirming it would refuse what
                 was approved a moment ago and say nothing about it. */
              setOpen(null)
              /* And the correction with it: the sweep decides every waiting item,
                 so whatever the panel was opened over is decided too. */
              setFixing(null)
              setSwept(waiting.length)
            }}
          >
            {t('verification.approveAll')}
          </button>
        )}

        <Swept count={swept} />
      </div>

      {waiting.length === 0 ? (
        <p className="profile__empty">{t('review.empty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <caption className="visually-hidden">{t('review.waiting')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('profile.columns.date')}</th>
                <th scope="col">{t('competitors.columns.member')}</th>
                {/* „Trka" and not „Događaj": what stands in this column is the name of
                      the race (owner, 23.08.2026), and a heading that says otherwise
                      is read out with every cell under it. */}
                  <th scope="col">{t('profile.columns.race')}</th>
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
              {waiting.map((one) => (
                <tr key={one.id}>
                  <td>{formatShortDate(one.date, locale)}</td>
                  <td>{one.memberNumber}</td>
                  <td>
                    {/* A link only where what is stored is an address this
                        portal is willing to hand a browser, which is asked here
                        and not taken on trust from the form (data/outsideLink.ts
                        says why both ask). Anything else is drawn as the name and
                        nothing more, the same as an entry that carries no address
                        at all.
                     *
                        Empty is what Član 37 allows: a member who attached a
                        picture instead of a link sends no address. Since
                        23.08.2026 both ways in ask for one, the form on the event
                        included. Words in an `href` would be an address made of
                        somebody's sentence, and that is what this screen drew
                        before the field existed. */}
                    {outsideLink(one.link) === undefined ? (
                      <>
                        {one.raceName}
                        {/* And that something was sent which the portal will not
                            open, where something was.
                         *
                            Without this the moderator cannot tell a member who
                            attached a picture and no address from one who sent an
                            address the portal refuses: both draw the name alone.
                            Measured by a review on 28.08.2026 with
                            `https://primer.rs:99999/rezultati`, which the form
                            takes and a browser will not open: the queue drew the
                            race name and nothing else, so the moderator was
                            deciding on evidence they could not see was there.
                         *
                            The address itself is not drawn. It is a string the
                            member wrote and this screen has already decided it
                            will not hand it to a browser; printing it beside the
                            name would put an unopenable address in front of a
                            moderator who might copy it out. What is said is that
                            one was sent. */}
                        {one.link !== '' && (
                          <span className="outside-host">{t('review.unusableLink')}</span>
                        )}
                      </>
                    ) : (
                      /* `noreferrer` because the host on the other end is one the
                         member chose, and without it the address of this
                         administrative screen travels there in the `Referer`.
                         `noopener` says the same thing about `window.opener`; it
                         is what browsers already do for `target="_blank"`, and it
                         is written out because a rule that depends on a default
                         is a rule nobody can read. */
                      <a href={outsideLink(one.link)} rel="noreferrer noopener" target="_blank">
                        {/* The race, not the event it was run at (owner,
                            23.08.2026). */}
                        {one.raceName}
                        {/* And where it leads, because the words of this link are a
                            name the member wrote. Inside the link so that it is read
                            with it rather than after it, and drawn from the address
                            through the browser's own parser rather than off the
                            text. */}
                        <span className="outside-host">{outsideHost(one.link)}</span>
                      </a>
                    )}
                    {/* And that the member has changed this since sending it,
                        which is the whole of what the queue is told.

                        Owner, 27.08.2026, asked whether a corrected result should
                        say so: „samo labela, ne šta je ispravljano." The mark and
                        nothing behind it is also all that can be said, since the
                        portal keeps no history of a result (P9).

                        It earns its place because a corrected result goes to the
                        back of the queue: what a moderator meets is an item they
                        may have read once already, now carrying different numbers
                        and, without this, nothing at all saying so. */}
                    {one.corrected && <span className="tag tag--corrected">{t('admin.corrected')}</span>}
                    {one.comment !== '' && <span className="review__said">{one.comment}</span>}
                    {/* And the proof, where there is any.
                     *
                        A member may attach a picture of the watch, and until now
                        this screen was the only place that would ever have shown
                        it and did not: the field was collected on both entry
                        paths, kept on the record, and read by nobody. The one
                        thing it is for is this decision, and ADL A12 has the file
                        deleted once the decision is made, so a picture nobody is
                        shown before then is a picture that is only ever deleted.
                     *
                        The name of the file, because in this prototype that is all
                        there is: no file is uploaded anywhere and the record keeps
                        what the field was called. When the store arrives it
                        becomes a link, in this same place. */}
                    {one.photo !== '' && (
                      <span className="review__said">{t('review.proof', { file: one.photo })}</span>
                    )}
                  </td>
                  <td className="table__hide-phone">{formatNumber(one.distanceKm, locale, 2)}</td>
                  <td className="table__hide-phone">{formatNumber(one.ascentM, locale)}</td>
                  <td className="table__hide-phone">{formatNumber(one.descentM, locale)}</td>
                  <td>{formatDuration(one.seconds)}</td>
                  <td className="table__hide-phone">{formatPoints(one.points, locale)}</td>
                  <td>
                    {/* The buttons in a box inside the cell, never on the cell
                        itself: a `td` laid out as a flex container leaves the
                        table and stops lining up with the row (Member.css). */}
                    <div className="review__decide">
                      <button
                        type="button"
                        className="button button--primary"
                        onClick={() => {
                          decide(one.id, 'approved', '')
                          /* Both panels stand below the table, so approving from
                             the row would leave one of them open over a result
                             that is already decided: confirming the refusal would
                             turn down what was just approved without saying so,
                             and saving the correction would write on a submission
                             nobody may rewrite any more. */
                          setOpen((current) => (current?.id === one.id ? null : current))
                          setFixing((current) => (current?.id === one.id ? null : current))
                        }}
                      >
                        {t('review.approve')}
                      </button>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => {
                          /* The other panel closes, because both stand below the
                             table and two open at once would leave the moderator
                             looking at a correction of one item over a refusal of
                             another. */
                          setFixing(null)
                          setOpen({ id: one.id, memberNumber: one.memberNumber })
                          setNote('')
                        }}
                      >
                        {t('review.sendBack')}
                      </button>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => {
                          setOpen(null)
                          setFixing({
                            id: one.id,
                            /* Seeded from the race where the submission carries no
                               event of its own, which is every submission a member
                               types: they are asked one name and the moderator is
                               offered it for both (owner, 31.08.2026). Once the
                               moderator has settled it, the submission keeps it and
                               this reads what they wrote rather than seeding again. */
                            eventName: one.eventName ?? one.raceName,
                            raceName: one.raceName,
                            /* Through the one home for that reading: the member
                               chose one of three, but a submission holds a word
                               and this control offers three (`data/raceKind.ts`). */
                            raceKind: raceKind(one.raceKind),
                            ...inBoxes(one.seconds),
                          })
                        }}
                      >
                        {t('review.amend')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fixing !== null && (() => {
        /* Asked of the same rule the member's own form is held to, field by
           field, rather than of a bound written out here. */
        const amendWaits =
          wrongBox('eventName', fixing.eventName) ||
          wrongBox('raceName', fixing.raceName) ||
          wrongBox('hours', fixing.hours) ||
          wrongBox('minutes', fixing.minutes) ||
          wrongBox('seconds', fixing.seconds) ||
          /* And not all three at nought, which no single box can refuse
             (`forms/clock.ts`). */
          noTime(fixing)

        /* Which of the three things is wrong, rather than one sentence for all of
           them. Written as one, it told a moderator who had left 0:0:0 standing
           that „the numbers must be within their bounds", and nought is within its
           bounds; and it never mentioned the event at all (measured in review,
           31.08.2026). WCAG 2.2 SC 3.3.1 asks for the error to be named, and the
           member's own form names this very one. */
        const amendSays =
          wrongBox('eventName', fixing.eventName) || wrongBox('raceName', fixing.raceName)
            ? 'review.amendNeedsName'
            : /* Bounds before the sum, because a box that is out of its own bounds
                 is a fault of that box: read the other way round, minus five hours
                 adds up to less than nought and would be reported as „all three at
                 nought", which is not what the moderator did. */
              wrongBox('hours', fixing.hours) ||
                wrongBox('minutes', fixing.minutes) ||
                wrongBox('seconds', fixing.seconds)
              ? 'review.amendWaits'
              : 'newResult.needsTime'

        return (
        <div className="review__reason" role="group" aria-label={t('review.amendTitle')}>
          {/* What this panel is for, said before the boxes rather than after: the
              kind the member chose is a hint (owner, 30.08.2026, „kao nagoveštaj
              tipa"), and the time on a timed race is the race's own limit, the
              same for everybody who finished, not a run. A moderator who does not
              know that writes the runner's time into a box that decides points
              for everyone. */}
          <p className="profile__empty">{t('review.amendNote')}</p>

          {/* Six fields carry a star, so the star is explained and each control
              says the same thing to a reader who cannot see it (owner, 12.08.2026,
              „na svim formama za unos i verifikaciju"). It is the very thing the
              refusal box below was measured missing: without it the button simply
              stayed dead and nothing said why. */}
          <RequiredNote />

          {/* The event above the race, in that order, because that is the order
              the moderator is asked to think in: what was run, and then which of
              its races this is. */}
          <div className="rankings__field rankings__field--wide">
            <AskedLabel id="amend-event">{t('review.amendEvent')}</AskedLabel>
            <input
              id="amend-event"
              type="text"
              aria-required="true"
              value={fixing.eventName}
              onChange={(event) => setFixing({ ...fixing, eventName: event.target.value })}
            />
          </div>

          <div className="rankings__field rankings__field--wide">
            <AskedLabel id="amend-name">{t('newResult.raceName')}</AskedLabel>
            <input
              id="amend-name"
              type="text"
              aria-required="true"
              value={fixing.raceName}
              onChange={(event) => setFixing({ ...fixing, raceName: event.target.value })}
            />
          </div>

          <div className="rankings__field">
            <AskedLabel id="amend-kind">{t('newResult.raceKind')}</AskedLabel>
            <select
              id="amend-kind"
              aria-required="true"
              value={fixing.raceKind}
              onChange={(event) => setFixing({ ...fixing, raceKind: raceKind(event.target.value) })}
            >
              {RACE_KINDS.map((one) => (
                <option key={one} value={one}>
                  {t(`race.kind.${one}`)}
                </option>
              ))}
            </select>
          </div>

          {/* The three boxes a time is asked in everywhere on this portal, split
              and added up by the one place that answers both ways
              (`forms/clock.ts`), so a limit written here is the same number the
              form on the other side writes. */}
          {(['hours', 'minutes', 'seconds'] as const).map((box) => (
            <div className="rankings__field" key={box}>
              <AskedLabel id={`amend-${box}`}>{t(`newResult.${box}`)}</AskedLabel>
              <input
                id={`amend-${box}`}
                type="text"
                inputMode="numeric"
                aria-required="true"
                value={fixing[box]}
                onChange={(event) => setFixing({ ...fixing, [box]: event.target.value })}
              />
            </div>
          ))}

          <div className="member__links">
            <button
              type="button"
              className="button button--primary"
              aria-disabled={amendWaits}
              aria-describedby={amendWaits ? 'amend-waits' : undefined}
              onClick={() => {
                /* Reachable means pressable, as everywhere else on this portal, so
                   the refusal lives here as well as on the attribute above. */
                if (amendWaits) {
                  return
                }

                amend(fixing.id, {
                  eventName: fixing.eventName.trim(),
                  raceName: fixing.raceName.trim(),
                  raceKind: fixing.raceKind,
                  /* Added up by the one place that answers both ways, so a limit
                     written here is the same number the form on the other side
                     writes, for every value that form would accept. */
                  seconds: fromBoxes(fixing),
                })
                setFixing(null)
              }}
            >
              {t('review.amendSave')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setFixing(null)}
            >
              {t('review.amendCancel')}
            </button>
          </div>

          {/* And why it will not go, said rather than left to be guessed. Told off
              rather than switched off, as everywhere else here: `disabled` takes
              the button out of the tab order and takes this line with it. */}
          {amendWaits && (
            <p className="field__error" id="amend-waits">
              {t(amendSays)}
            </p>
          )}
          </div>
        )
      })()}

      {open !== null && (
        <div className="review__reason" role="group" aria-label={t('review.sendBack')}>
          {/* Obligatory, and it says so both ways: the star for the eye and
              `aria-required` for a reader, which is the rule the owner asked for
              on 12.08.2026 („Ova pravila... treba da funkcioniše na svim formama
              za unos i verifikaciju"). This field is written by hand rather than
              drawn from a definition, so it takes the rule from the same place
              every other hand written field does (forms/AskedLabel.tsx). Without
              it, the button below simply stayed dead and nothing said why. */}
          <RequiredNote />

          <div className="rankings__field rankings__field--wide">
            <AskedLabel id="review-reason">{t('review.reason')}</AskedLabel>
            <input
              id="review-reason"
              type="text"
              value={note}
              aria-required="true"
              /* What the box promises is what this very item will do, asked of
                 the one rule that decides it (queues.ts) rather than written out
                 here. Written out, the two drifted apart twice: the box promised
                 a message while this screen never sent one, and after the sending
                 was wired in it went on saying the message would not go. */
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
              /* Written means written, spaces taken off, exactly as the forms
                 decide it (src/forms/validate.ts). Three spaces are not a
                 reason, and a plain comparison against the empty string let
                 them through.

                 Told off rather than switched off, as everywhere else on the
                 portal: `disabled` takes the button out of the tab order and
                 takes with it the very line this screen added to say why it will
                 not go. */
              aria-disabled={note.trim() === ''}
              aria-describedby={note.trim() === '' ? 'review-reason-waits' : undefined}
              onClick={() => {
                /* Reachable means pressable, so the refusal lives here too. */
                if (note.trim() === '') {
                  return
                }

                const reason = note.trim()

                decide(open.id, 'rejected', reason)

                /* And the member is told, which this screen did not do until
                   16.08.2026 while the box beside it promised they would be
                   (owner, 15.08.2026: „Poruka ide sa svih redova"). A review
                   measured it: `decide` was called and `notify` never was.
                 *
                   Read through the one place that knows whether a message goes
                   and under what heading (queues.ts), rather than written out
                   here, because a second copy of that rule is a second answer to
                   the same question. A result carries no sort, so the empty one
                   is handed in, which is what every queue but the racing profile
                   carries.
                 *
                   `canSendBack` first, and it is not a formality: an empty
                   recipient in this portal is the whole league and not nobody
                   (Message.to), so a submission without a member number would
                   send one person`s refusal to everybody. */
                const going = refusalTo(QUEUE.results, { kind: '', memberNumber: open.memberNumber })

                if (going !== null) {
                  notify({
                    from: t('app.name'),
                    to: going.to,
                    subject: t(going.heading),
                    body: reason,
                    date: today,
                  })
                }

                setOpen(null)
                setNote('')
              }}
            >
              {t('review.confirmSendBack')}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setOpen(null)}
            >
              {t('review.cancel')}
            </button>
          </div>

          {/* Why it will not go yet, said where it can be read rather than left
              to a button that is simply dead. */}
          {note.trim() === '' && (
            <p id="review-reason-waits" className="rate__hint" role="status">
              {t('review.reasonNeeded')}
            </p>
          )}
        </div>
      )}

    </div>
  )
}
