import { useState } from 'react'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { QueueMeta } from './QueueMeta'
import { QUEUE } from './queues'
import '../member/Member.css'

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
export function ReviewQueue() {
  const { locale, t } = useI18n()
  const { submissions, decide } = useSession()
  const [open, setOpen] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const waiting = submissions.filter((one) => one.status === 'pending')
  const decided = submissions.filter((one) => one.status !== 'pending')

  return (
    <div className="member">
      <QueueMeta queue={QUEUE.results} />

      <h1>{t('review.title')}</h1>
      <p className="member__note">{t('review.note')}</p>
      <p className="member__note">{t('review.correctionNote')}</p>

      <h2 className="profile__section">
        {t('review.waiting')} <span className="profile__count">{waiting.length}</span>
      </h2>

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
                <th scope="col">{t('profile.columns.event')}</th>
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
                    <a href={one.link} rel="noreferrer noopener" target="_blank">
                      {one.eventName}
                    </a>
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
                          /* The reason box stands below the table, so approving
                             from the row would leave it open over a result that
                             is already decided, and confirming it would refuse
                             what was just approved without saying so. */
                          setOpen((current) => (current === one.id ? null : current))
                        }}
                      >
                        {t('review.approve')}
                      </button>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => {
                          setOpen(one.id)
                          setNote('')
                        }}
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

      {open !== null && (
        <div className="review__reason" role="group" aria-label={t('review.sendBack')}>
          <label className="rankings__field rankings__field--wide">
            <span>{t('review.reason')}</span>
            <input
              type="text"
              value={note}
              placeholder={t('review.reasonPlaceholder')}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="member__links">
            <button
              type="button"
              className="button button--primary"
              /* Written means written, spaces taken off, exactly as the forms
                 decide it (src/forms/validate.ts). Three spaces are not a
                 reason, and a plain comparison against the empty string let
                 them through. */
              disabled={note.trim() === ''}
              onClick={() => {
                decide(open, 'rejected', note.trim())
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
        </div>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="profile__section">{t('review.decided')}</h2>
          <div className="table-scroll">
            <table className="table">
              <caption className="visually-hidden">{t('review.decided')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('profile.columns.event')}</th>
                  <th scope="col">{t('competitors.columns.member')}</th>
                  <th scope="col">{t('admin.state')}</th>
                  <th scope="col">{t('review.explanation')}</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((one) => (
                  <tr key={one.id}>
                    <td>{one.eventName}</td>
                    <td>{one.memberNumber}</td>
                    <td>
                      <span className={`tag tag--${one.status}`}>{t(`status.${one.status}`)}</span>
                    </td>
                    <td>{one.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
