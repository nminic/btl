import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { countryName } from '../../data/countryName'
import { combinePair, useCompetitors } from '../../data/useResource'
import type { MembershipBasis } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { handOutMemberNumber, handOutMemberNumbersFor } from './memberNumbers'
import { usePending, waitingIn, settledWith } from './pending'
import { QueueMeta } from './QueueMeta'
import { QUEUE } from './queues'
import { SendBack } from './SendBack'
import { Swept } from './Swept'
import '../member/Member.css'
import './Verification.css'

/** Whose membership the reason box is open on: the key the decision is
 *  remembered under, and the name to put on the box. */
type Refusing = { key: string; name: string }

/**
 * The bank statement, as the way a hundred payments are reconciled at once
 * (owner, 31.07.2026).
 *
 * Every slip carries a reference of the form 2027-37, so a statement can say
 * whose money each line is without anybody reading names. Turning the file into
 * decisions is the server's work and the server does not exist yet, so what this
 * does today is take the file and say so; the row by row confirmation below it
 * is what actually settles anything, and it is not going away when the parsing
 * arrives, because a payment that arrives without a reference will always need a
 * person.
 *
 * It refuses anything that is not a PDF by reading the first five bytes rather
 * than by believing what the operating system called the file. A statement saved
 * without a type is still a statement, and anything at all renamed to `.pdf` is
 * still not one; only the file itself knows.
 */
function Statement() {
  const { t } = useI18n()
  /* One region, always on the page, and only its text changes. A region that is
     added to the page together with its text is one that a screen reader often
     misses, because there was nothing there to be watching. */
  const [said, setSaid] = useState<{ key: string; name?: string } | null>(null)

  async function look(file: File | undefined) {
    if (file === undefined) {
      return
    }

    const opening = await file.slice(0, 5).text()

    setSaid(
      opening === '%PDF-'
        ? { key: 'review.statement.taken', name: file.name }
        : { key: 'review.statement.wrongKind' },
    )
  }

  return (
    <section className="statement" aria-labelledby="statement-heading">
      <h2 className="profile__section" id="statement-heading">
        {t('review.statement.title')}
      </h2>
      <p className="member__note">{t('review.statement.hint')}</p>

      <label className="statement__pick">
        <span className="button button--secondary">{t('review.statement.choose')}</span>
        <input
          type="file"
          accept="application/pdf"
          className="visually-hidden"
          onChange={(event) => void look(event.target.files?.[0])}
        />
      </label>

      <p
        className={
          said?.key === 'review.statement.wrongKind'
            ? 'member__note statement__refused'
            : 'member__note'
        }
        role="status"
      >
        {said === null ? '' : t(said.key, { name: said.name ?? '' })}
      </p>
    </section>
  )
}

/* Everyone who opened an account and is waiting to become a full member.
 *
 * Registration is approved by itself and then the fee is waited for; the member
 * becomes full the moment somebody records that it arrived (PDL P8). Until then
 * they are nowhere on the portal and can do nothing, so this screen is the whole
 * of their existence in the league.
 *
 * Which is why the rows are not members. A member number is handed out at the
 * moment the fee is recorded, first free in order (PDL P8, 30.07.2026), so
 * whoever is still waiting has no number, and without a number there is no row in
 * the member list and no profile to link to. They wait in the file of everything
 * else that wants a decision, and go by their name and their address until the
 * number exists.
 *
 * Activation has two grounds, not one. A paid fee is the usual one, and honorary
 * is the second: during the fortnight before registration opens the owner enters
 * the competitors of earlier seasons himself and does not charge them for 2027.
 * An honorary member is a full member, ranked like anybody else, and the ground
 * is only ever a line in the books. It is never shown publicly, anywhere, because
 * it is a fact about money rather than about running. The number, on the other
 * hand, is the first thing the administrator passes on, so it is on screen the
 * moment it is given.
 *
 * A table, because the work here is comparison down a list rather than reading
 * one thing.
 */
export function Payments() {
  const { t } = useI18n()
  const session = useSession()
  const { decisions, settle } = session
  const [open, setOpen] = useState<Refusing | null>(null)
  /** How many the last sweep activated, and null until there has been one. */
  const [swept, setSwept] = useState<number | null>(null)
  /* The member list is read for one reason only: a number can only be handed out
     against every number that is already gone. */
  const state = combinePair(usePending(), useCompetitors())

  const queue = QUEUE.payments

  return (
    <div className="member">
      <QueueMeta queue={queue} />

      {/* Everything that stood above the work is gone (owner, 30.07.2026): the
          name is in the navigation and in the tab, and the three sentences under
          it were read once and then in the way for good. The name stays in the
          markup for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t(queue.labelKey)}</h1>

      <Resource state={state}>
        {([items, competitors]) => {
          const waiting = waitingIn(items, decisions, queue.id)
          /* Each settled registration with the decision that settled it, so the
             row below shows what was decided instead of going back for it
             (queues.ts). */
          const settled = settledWith(items, decisions, queue.id)

          /**
           * Activation, and the reason box shut behind it.
           *
           * The number is asked for rather than worked out here, because this
           * screen is not the only one that gives one out and the two of them must
           * not be able to count differently (src/pages/admin/memberNumbers.ts).
           *
           * The box stands below the table rather than in the row, so without the
           * second line it survived the decision taken by the buttons beside it:
           * the row moved to the settled table, the box stayed open on the same
           * registration, and confirming it overwrote the activation with a
           * refusal. One decision is one record per registration, so the second
           * silently replaced the first and the ground of the membership went with
           * it.
           */
          const activate = (id: string, basis: MembershipBasis) => {
            settle(id, {
              status: 'approved',
              note: '',
              basis,
              memberNumber: handOutMemberNumber(competitors, session),
            })
            setOpen((current) => (current?.key === id ? null : current))
          }

          /**
           * The same activation for every registration waiting, on the ground of
           * a paid fee.
           *
           * It asks for every number in one go rather than calling `activate` in
           * a loop. A number is worked out against everything already spoken for,
           * and what is spoken for is read off the session as this render sees
           * it; the session does not change while a loop runs, so a loop would
           * hand the same number to all of them. The counting belongs to the one
           * module that is allowed to do it (memberNumbers.ts, PDL P8), which is
           * where it now is.
           */
          const activateAll = (ids: string[]) => {
            for (const { id, memberNumber } of handOutMemberNumbersFor(
              competitors,
              session,
              ids,
            )) {
              settle(id, { status: 'approved', note: '', basis: 'payment', memberNumber })
            }

            /* Every one of them has been decided, so nothing the box could be
               open on is still waiting. Confirming it after the sweep would
               overwrite an activation with a refusal (see `activate`). */
            setOpen(null)
          }

          return (
            <>
              <Statement />

              <div className="pending__bar">
                <h2 className="profile__section">
                  {t('review.waiting')} <span className="profile__count">{waiting.length}</span>
                </h2>

                {/* One decision for the whole queue, as everywhere else (owner,
                    01.08.2026), and on this queue that decision has a ground.
                    Only the fee: honorary membership is entered person by person
                    during the fortnight before registration opens, against a
                    list the owner is reading, so there is nothing to sweep.

                    The words say which ground it is, because the two buttons in
                    the row do and a third that said only "all" would be the one
                    control on the screen that hides what it writes down. */}
                {waiting.length > 0 && (
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => {
                      if (!window.confirm(t('verification.activateAllAsk', { count: waiting.length }))) {
                        return
                      }

                      activateAll(waiting.map((one) => one.id))
                      setSwept(waiting.length)
                    }}
                  >
                    {t('verification.activateAllPayment')}
                  </button>
                )}

                <Swept count={swept} />
              </div>

              {waiting.length === 0 ? (
                <p className="profile__empty">{t('verification.empty')}</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <caption className="visually-hidden">{t(queue.labelKey)}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        <th scope="col">{t('competitors.columns.city')}</th>
                        <th scope="col">{t('review.decision')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waiting.map((one) => (
                        <tr key={one.id}>
                          <td>
                            {one.who}
                            {/* The address under the name, because until the fee
                                is recorded it is what the two of them have to go
                                by (PDL P8). */}
                            <span className="pending__country">{one.email}</span>
                          </td>
                          <td>
                            {one.city}
                            <span className="pending__country">{countryName(one.country)}</span>
                          </td>
                          <td>
                            <div className="review__decide">
                              <button
                                type="button"
                                className="button button--primary"
                                onClick={() => activate(one.id, 'payment')}
                              >
                                {t('verification.activatePayment')}
                              </button>
                              <button
                                type="button"
                                className="button button--secondary"
                                onClick={() => activate(one.id, 'honorary')}
                              >
                                {t('verification.activateHonorary')}
                              </button>
                              <button
                                type="button"
                                className="button button--secondary"
                                onClick={() => setOpen({ key: one.id, name: one.who })}
                              >
                                {t('review.sendBack')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Named, because the box is under the table and not in the row:
                  on a list of twenty there is otherwise nothing on screen that
                  says whose membership is being refused. */}
              {open !== null && (
                <SendBack
                  subject={open.name}
                  onConfirm={(reason) => {
                    /* Nothing is handed out on a refusal. The registration is
                       still waiting for a fee, and a number given to it here
                       would be a number nobody could ever use. */
                    settle(open.key, {
                      status: 'rejected',
                      note: reason,
                      basis: '',
                      memberNumber: '',
                    })
                    setOpen(null)
                  }}
                  onCancel={() => setOpen(null)}
                />
              )}

              {settled.length > 0 && (
                <>
                  <h2 className="profile__section">{t('review.decided')}</h2>
                  <div className="table-scroll">
                    <table className="table">
                      <caption className="visually-hidden">{t('review.decided')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('competitors.columns.member')}</th>
                          {/* The number the activation handed out. It is the first
                              thing the administrator passes on to the member, so
                              it is a column and not a detail. */}
                          <th scope="col">{t('admin.field.memberNumber')}</th>
                          <th scope="col">{t('admin.state')}</th>
                          <th scope="col">{t('admin.basis')}</th>
                          <th scope="col">{t('review.explanation')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settled.map(({ item, decision }) => (
                          <tr key={item.id}>
                            <td>
                              {item.who}
                              <span className="pending__country">{item.email}</span>
                            </td>
                            <td>
                              {decision.memberNumber === '' ? (
                                ''
                              ) : (
                                <span className="table__member-number">
                                  {decision.memberNumber}
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`tag tag--${decision.status}`}>
                                {t(`status.${decision.status}`)}
                              </span>
                            </td>
                            <td>
                              {decision.basis === '' ? (
                                ''
                              ) : (
                                <span className={`tag tag--${decision.basis}`}>
                                  {t(`admin.basisValue.${decision.basis}`)}
                                </span>
                              )}
                            </td>
                            <td>{decision.note}</td>
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
