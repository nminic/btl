import { useState } from 'react'
import registracija from '../../forms/definitions/registracija.form.json'
import { limitOf } from '../../forms/records'
import type { FormDef } from '../../forms/types'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import type { Decision } from '../../session/context'
import { useSession } from '../../session/useSession'
import { usePending, waitingIn, settledWith } from './pending'
import type { PendingItem } from '../../data/types'
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

export function PendingQueue({ queue }: { queue: Queue }) {
  const { locale, t } = useI18n()
  const { decisions, edits, notify, settle } = useSession()
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
  const state = usePending()

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
        {(items) => {
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

                      for (const item of waiting) {
                        settle(item.id, {
                          status: 'approved',
                          note: queue.outcome === 'editAndPublish' ? textOf(item) : '',
                          basis: '',
                          memberNumber: '',
                        })
                      }

                      setSwept(waiting.length)
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
                        <h3 className="pending__subject">{one.subject}</h3>
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
                            onClick={() =>
                              settle(one.id, {
                                status: 'approved',
                                /* A published biography is written down as it went
                                   out, so the table of settled items can show what
                                   the member's profile now says rather than what
                                   they sent in. Nothing else writes anything on an
                                   approval, which explains itself. */
                                note: queue.outcome === 'editAndPublish' ? textOf(one) : '',
                                basis: '',
                                memberNumber: '',
                              })
                            }
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
                            <td>{item.subject}</td>
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
