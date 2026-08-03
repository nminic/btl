import { useState } from 'react'
import registracija from '../../forms/definitions/registracija.form.json'
import { limitOf } from '../../forms/records'
import type { FormDef } from '../../forms/types'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { combinePair, useTeams } from '../../data/useResource'
import { formatShortDate } from '../../i18n/format'
import countries from '../../data/countries.json'
import tim from '../../forms/definitions/admin-tim.form.json'
import { useI18n } from '../../i18n/useI18n'
import type { Decision } from '../../session/context'
import { useSession } from '../../session/useSession'
import { usePending, waitingIn, settledWith } from './pending'
import type { PendingItem, Team } from '../../data/types'
import { idFor, recordsOf, TEAMS } from './entityForms'
import { addressesIn, addressOf, proposed, refusal, teamFrom } from './teamProposal'
import { useOverlay } from './overlay'
import { QueueMeta } from './QueueMeta'
import { canSendBack, type Queue, type QueueOutcome } from './queues'
import { SendBack } from './SendBack'
import { Swept } from './Swept'
import '../member/Member.css'
import './Verification.css'

/* One screen for six queues: proposed leagues, new teams, biographies, profile
 * pictures, comments, and reported changes of date.
 *
 * One screen rather than six because the work is the same work every time. The
 * moderator reads a piece of text somebody wrote, and then decides what becomes
 * of it. What differs is the word for the text, whether there are two dates to
 * compare, and what the decision other than "yes" is, and none of those is a
 * screen.
 *
 * That last one is the only difference the moderator can feel, and there are four
 * of them (queues.ts, PDL P22). Three queues go their own way: a comment is
 * deleted on the spot, a biography is edited and published and never goes back,
 * and a picture goes back with an instruction that reaches the member's inbox.
 * Which of the four a queue is comes off the queue itself, so it is one fact in
 * one place rather than the name of a queue tested here.
 *
 * Cards rather than a table, unlike the queue of results. There the work is
 * comparison down a column of thirty; here it is reading one thing at a time, and
 * a biography of three and a half thousand characters has no column it fits in.
 */

/**
 * What the last column of the table of settled items holds, which is not the
 * same thing on every queue.
 *
 * Comments are the one that has no such column: nothing is ever written down
 * about one, neither when it is let out nor when it is deleted, so a column
 * there would be a heading over a run of empty cells.
 */
/** Whether a queue has a second decision that hands the work back to its
 *  author. Five of the eight, plus the pictures, which hand back an instruction
 *  (queues.ts). */
function handsBack(queue: Queue): boolean {
  return queue.outcome === 'sendBack' || queue.outcome === 'instruct'
}

const SETTLED_COLUMN: Record<QueueOutcome, string | undefined> = {
  sendBack: 'review.explanation',
  /* The pictures write down a reason like the rest, and it is called what it is
     called everywhere else. It is only expected to be precise enough for the
     member to work from, which is a fact about what is written and not about
     where it is shown. */
  instruct: 'review.explanation',
  editAndPublish: 'verification.publishedText',
  delete: undefined,
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

/** The reason approving would do nothing, where there is one. Its own component
 *  so the reason is worked out once and read once, rather than twice by a
 *  condition and the thing it guards. */
function Refused({ why }: { why: string | null }) {
  const { t } = useI18n()

  return why === null ? null : <p className="pending__blocked">{t(why)}</p>
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
    <div className="pending__fields">
      <label className="rankings__field">
        <span>{t('admin.field.teamName')}</span>
        <input
          type="text"
          value={value('name')}
          maxLength={limitOf(tim as FormDef, 'name')}
          onChange={(event) => edit(item.id, 'name', event.target.value)}
        />
      </label>

      <label className="rankings__field">
        <span>{t('admin.field.city')}</span>
        <input
          type="text"
          value={value('city')}
          maxLength={limitOf(tim as FormDef, 'city')}
          onChange={(event) => edit(item.id, 'city', event.target.value)}
        />
      </label>

      <label className="rankings__field">
        <span>{t('admin.field.country')}</span>
        <select value={value('country')} onChange={(event) => edit(item.id, 'country', event.target.value)}>
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
      </label>
    </div>
  )
}

export function PendingQueue({ queue }: { queue: Queue }) {
  const { locale, t } = useI18n()
  const { create, creations, decisions, edits, notify, settle } = useSession()
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
  /* The teams as well, for one rule: a name already in the league cannot be
     taken by a proposal (PDL P13). Read through what this visit has entered, so
     two proposals of the same name in one sitting cannot both go through. */
  const state = combinePair(usePending(), useTeams())

  /* Both dates of a reported change, so the difference is the thing on screen
     and not something the reader works out. Empty on the other five queues. */
  const datesOf = (one: PendingItem) =>
    [
      { key: 'verification.currentDate', value: one.currentDate },
      { key: 'verification.proposedDate', value: one.proposedDate },
    ].filter((fact) => fact.value !== '')

  /* What is on screen right now, which on the biographies is not what came in:
     the moderator has been editing it, and what is published is what they left. */
  const textOf = (one: PendingItem) => edits[one.id]?.body ?? one.body

  /* What the decision is called once it has been taken. "Vraćeno" is the word
     where a refusal hands work back. A deleted comment is "Obrisano" and not
     "Odbijeno", because a refused comment sounds like one that is being kept
     somewhere and could be brought back, and none is (PDL P22). A biography is
     never refused at all, so its one outcome is "Objavljeno". */
  const stateKey = (status: Decision['status']) => {
    if (queue.outcome === 'editAndPublish') {
      return 'verification.published'
    }

    if (queue.outcome === 'delete' && status === 'rejected') {
      return 'verification.deleted'
    }

    return `status.${status}`
  }

  /**
   * What approving one item does, beyond writing down the decision.
   *
   * On the queue of new teams it does two more things (PDL P13, 03.08.2026):
   * the team is made, with the member who proposed it as its organiser, and that
   * member is told. Until the approval a proposal is a row in a queue; after it,
   * it is a record like any other, and the member has the rights over it that
   * P21 calls being a team's organiser.
   *
   * The message goes to the inbox and not to an alert on a screen nobody is
   * looking at: the decision may come days later, and a decision that reaches
   * nobody is the fault this closes.
   *
   * Here rather than at the button, because the sweep approves the same way and
   * a queue where "approve all" did less than pressing approve forty times would
   * be a trap.
   */
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
        /* A published biography is written down as it went out, so the table of
           settled items can show what the member's profile now says rather than
           what they sent in. Nothing else writes anything on an approval, which
           explains itself. */
        note: queue.outcome === 'editAndPublish' ? textOf(one) : '',
        basis: '',
        memberNumber: '',
      })

      done += 1

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

  const settledColumn = SETTLED_COLUMN[queue.outcome]
  /** What the text on the card is called: the biography, the comment, the reason
   *  given, or the file name of a picture. */
  const bodyLabel = t(`verification.body.${queue.id}`)

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
          const waiting = waitingIn(items, decisions, queue.id)
          /* Each settled item with the decision that settled it, so the row
             below shows what was decided instead of going back for it
             (queues.ts). */
          const settled = settledWith(items, decisions, queue.id)

          return (
            <>
              <div className="pending__bar">
                <h2 className="profile__section" id={waitingId}>
                  {t('review.waiting')} <span className="profile__count">{waiting.length}</span>
                </h2>

                {/* One decision for the whole queue (owner, 01.08.2026). It asks
                    first, because there is nothing to undo: approving is what
                    puts a thing on the portal, and a queue of forty approved by
                    a misplaced click is forty things to find again by hand. */}
                {waiting.length > 0 && (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      if (!window.confirm(t('verification.approveAllAsk', { count: waiting.length }))) {
                        return
                      }

                      /* What it settled, not what it was asked to settle. A
                         proposal whose name is already in the league is left
                         standing, so the count has to be the ones that went
                         through or the line under the button would say a number
                         the queue disagrees with. */
                      setSwept(approveAll(waiting, teams))
                    }}
                  >
                    {t('verification.approveAll')}
                  </button>
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
                  {waiting.map((one) => (
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
                      </div>

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

                      <dl className="pending__facts">
                        {datesOf(one).map((fact) => (
                          <div key={fact.key}>
                            <dt>{t(fact.key)}</dt>
                            <dd>{formatShortDate(fact.value, locale)}</dd>
                          </div>
                        ))}
                        <div className="pending__text">
                          <dt>{bodyLabel}</dt>
                          {queue.outcome === 'editAndPublish' ? (
                            <dd className="pending__edit">
                              <EditableBody id={one.id} label={bodyLabel} value={one.body} />
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
                             member reads and changes the picture by. */
                          placeholderKey={
                            queue.outcome === 'instruct'
                              ? 'review.instructionPlaceholder'
                              : 'review.reasonPlaceholder'
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
                            if (queue.outcome === 'instruct') {
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
                            onClick={() => approveAll([one], teams)}
                          >
                            {queue.outcome === 'editAndPublish'
                              ? t('verification.publish')
                              : t('review.approve')}
                          </button>

                          {/* One click and the comment is gone, the same as
                              accepting it. There is no box to open, so there is
                              no focus to hand back either. */}
                          {queue.outcome === 'delete' && (
                            <button
                              type="button"
                              className="button button--secondary"
                              onClick={() =>
                                settle(one.id, {
                                  status: 'rejected',
                                  note: '',
                                  basis: '',
                                  memberNumber: '',
                                })
                              }
                            >
                              {t('verification.delete')}
                            </button>
                          )}

                          {/* The focus comes back to this button with it, on the
                              render that brings it back and on no other: nothing
                              is autofocused when the page first draws. A
                              biography has no button here at all, because it
                              never goes back. */}
                          {handsBack(queue) && canSendBack(queue, one) && (
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
                          <Refused
                            why={
                              queue.id === 'teams'
                                ? refusal(teamFrom(one, edits), addressesIn(teams), one)
                                : null
                            }
                          />

                          {/* And where it cannot go back, the button is gone and
                              the reason is on screen in its place. A control
                              that quietly does nothing teaches a moderator that
                              the screen is broken; this one says which fact is
                              missing and that it is not his to fix. */}
                          {handsBack(queue) && !canSendBack(queue, one) && (
                            <p className="pending__blocked">{t('verification.noRecipient')}</p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {settled.length > 0 && (
                <>
                  <h2 className="profile__section">{t('review.decided')}</h2>
                  <div className="table-scroll">
                    <table className="table">
                      <caption className="visually-hidden">{t('review.decided')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('verification.subject')}</th>
                          <th scope="col">{t('admin.state')}</th>
                          {settledColumn !== undefined && (
                            <th scope="col">{t(settledColumn)}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {settled.map(({ item, decision }) => (
                          <tr key={item.id}>
                            {/* What it was called when it was decided. A name
                                corrected on the card is the name the team now
                                carries, so the row that records the decision
                                must not go on showing the one that arrived. */}
                            <td>
                              {queue.id === 'teams' ? teamFrom(item, edits).name : item.subject}
                            </td>
                            <td>
                              <span className={`tag tag--${decision.status}`}>
                                {t(stateKey(decision.status))}
                              </span>
                            </td>
                            {settledColumn !== undefined && <td>{decision.note}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
