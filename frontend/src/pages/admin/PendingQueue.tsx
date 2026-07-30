import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { settledIn, usePending, waitingIn, type PendingItem } from './pending'
import { QueueMeta } from './QueueMeta'
import type { Queue } from './queues'
import { SendBack } from './SendBack'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'
import './Verification.css'

/* One screen for six queues: proposed leagues, new teams, biographies, profile
 * pictures, comments, and reported changes of date.
 *
 * One screen rather than six because the work is the same work every time. The
 * moderator reads a piece of text somebody wrote, and either lets it out onto the
 * portal or sends it back saying why. What differs is the word for the text and
 * whether there are two dates to compare, and neither of those is a screen.
 *
 * Cards rather than a table, unlike the queue of results. There the work is
 * comparison down a column of thirty; here it is reading one thing at a time, and
 * a biography of three and a half thousand characters has no column it fits in.
 */
export function PendingQueue({ queue }: { queue: Queue }) {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const { decisions, settle } = useSession()
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
  const state = usePending()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  /* Both dates of a reported change, so the difference is the thing on screen
     and not something the reader works out. Empty on the other five queues. */
  const datesOf = (one: PendingItem) =>
    [
      { key: 'verification.currentDate', value: one.currentDate },
      { key: 'verification.proposedDate', value: one.proposedDate },
    ].filter((fact) => fact.value !== '')

  return (
    <div className="member">
      <QueueMeta queue={queue} />

      <h1>{t(queue.labelKey)}</h1>
      <p className="member__note">{t(queue.sourceKey)}</p>

      <Resource state={state}>
        {(items) => {
          const waiting = waitingIn(items, decisions, queue.id)
          const settled = settledIn(items, decisions, queue.id)

          return (
            <>
              <h2 className="profile__section">
                {t('review.waiting')} <span className="profile__count">{waiting.length}</span>
              </h2>

              {waiting.length === 0 ? (
                <p className="profile__empty">{t('verification.empty')}</p>
              ) : (
                <ul className="submissions">
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
                          <dt>{t(`verification.body.${queue.id}`)}</dt>
                          <dd className="pending__body">{one.body}</dd>
                        </div>
                      </dl>

                      {open === one.id ? (
                        <SendBack
                          onConfirm={(reason) => {
                            settle(one.id, { status: 'rejected', note: reason, basis: '' })
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
                              settle(one.id, { status: 'approved', note: '', basis: '' })
                            }
                          >
                            {t('review.approve')}
                          </button>
                          {/* The focus comes back to this button with it, on the
                              render that brings it back and on no other: nothing
                              is autofocused when the page first draws. */}
                          <button
                            type="button"
                            className="button button--secondary"
                            autoFocus={one.id === closed}
                            onClick={() => setOpen(one.id)}
                          >
                            {t('review.sendBack')}
                          </button>
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
                          <th scope="col">{t('review.explanation')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settled.map((one) => (
                          <tr key={one.id}>
                            <td>{one.subject}</td>
                            <td>
                              <span className={`tag tag--${decisions[one.id].status}`}>
                                {t(`status.${decisions[one.id].status}`)}
                              </span>
                            </td>
                            <td>{decisions[one.id].note}</td>
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
