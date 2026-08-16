import { useState } from 'react'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { QueueMeta } from './QueueMeta'
import { QUEUE } from './queues'
import { Swept } from './Swept'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
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
export function ReviewQueue() {
  const { locale, t } = useI18n()
  const { submissions, decide } = useSession()
  const [open, setOpen] = useState<string | null>(null)
  const [note, setNote] = useState('')
  /** How many the last sweep settled, and null until there has been one. */
  const [swept, setSwept] = useState<number | null>(null)

  const waiting = submissions.filter((one) => one.status === 'pending')

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
                    {/* A link only where there is an address to link to. Where
                        the entry came from the event's own page there is none:
                        that form asks for words, and words in an `href` are an
                        address made of somebody's sentence. */}
                    {one.link === '' ? (
                      one.eventName
                    ) : (
                      <a href={one.link} rel="noreferrer noopener" target="_blank">
                        {one.eventName}
                      </a>
                    )}
                    {one.comment !== '' && (
                      <span className="review__said">{one.comment}</span>
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
              placeholder={t('review.reasonKeptPlaceholder')}
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
