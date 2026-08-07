import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { Stars } from '../../components/Stars'
import { NO_RATING, type EventRating } from '../../data/types'
import { combinePair, useCompetitors, useEvents } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { SignedOut } from '../member/SignedOut'
import '../member/Member.css'

/** The three marks, in the order they are asked for and read back. */
const MARKS = ['organisation', 'value', 'ambience'] as const

/**
 * What a member thought of an event, given on a screen of its own.
 *
 * A screen and not a window over the event, though a window was what was asked
 * for and built first (owner, 06.08.2026). The button beside this one, the one
 * that reports a result, is a link to its own address and says why: a link has a
 * middle click, an address in the status bar and is announced as a way to
 * another screen. Two buttons doing the same kind of work should not be two
 * different kinds of thing.
 *
 * An address also gives the notice that goes out after a race somewhere to send
 * anybody: "ocenite Beogradski maraton" has to lead to a page, and a window that
 * only exists once somebody has pressed a button on another screen is not one.
 *
 * Nothing here is published on the spot. The rating and the comment go to the
 * queue a moderator reads (PDL P22), which is the same route a comment has taken
 * since the queues were written.
 */
export function RateEvent() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const today = useToday()
  const { memberNumber, propose } = useSession()
  const state = combinePair(useEvents(), useCompetitors())
  const [rating, setRating] = useState<EventRating>(NO_RATING)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)

  if (memberNumber === null) {
    return <SignedOut />
  }

  const mine = memberNumber

  if (sent) {
    return (
      <div className="member" role="status">
        <h1>{t('event.commentTitle')}</h1>
        <p>{t('event.commentSent')}</p>
        <p className="member__actions">
          <Link className="button button--primary" to={`/${locale}/kalendar/${slug}`}>
            {t('report.backToEvent')}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="member">
      <Resource state={state}>
        {([events, competitors]) => {
          const found = events.find((one) => one.slug === slug)

          if (found === undefined) {
            return <h1>{t('event.notFound')}</h1>
          }

          const event = found
          const me = competitors.find((one) => one.memberNumber === mine)
          const who = me === undefined ? '' : `${me.firstName} ${me.lastName}`

          function send() {
            propose({
              queue: 'comments',
              date: today,
              memberNumber: mine,
              who,
              subject: event.name,
              /* By the id as well, because approving it publishes a comment about
                 this edition and not about whatever else carries the name. */
              subjectId: event.id,
              body: comment,
              currentDate: '',
              proposedDate: '',
              email: '',
              city: '',
              country: '',
              rating,
            })
            setSent(true)
          }

          return (
            <>
              <h1>{event.name}</h1>
              <p className="profile__meta">{t('event.commentIntro')}</p>

              {/* Not a `<form>` with a submit. The three ratings are radios and
                  a form of radios submits on Enter from anywhere inside it, so a
                  member pressing Enter after the third star would send a comment
                  they had not written yet. */}
              <div className="rate">
                {MARKS.map((mark) => (
                  <Stars
                    key={mark}
                    name={mark}
                    label={t(`event.rating.${mark}`)}
                    value={rating[mark]}
                    onChange={(value) => setRating({ ...rating, [mark]: value })}
                  />
                ))}

                <div className="rate__comment">
                  {/* The hint outside the label and tied to the field by id. In
                      the label it became part of the field's name, so the
                      comment box was called "Komentar Neobavezno. Šta bi drugi
                      član voleo da zna...", which is what a screen reader would
                      have read out before every keystroke. */}
                  <label htmlFor="comment">{t('event.commentText')}</label>
                  <textarea
                    id="comment"
                    rows={5}
                    aria-describedby="comment-hint"
                    value={comment}
                    onChange={(one) => setComment(one.target.value)}
                  />
                  <p id="comment-hint" className="rate__hint">
                    {t('event.commentHint')}
                  </p>
                </div>
              </div>

              <p className="member__actions">
                {/* All three, and not one of them. The overall is their average
                    (PDL P6), so a rating with one mark given divides by three
                    anyway: five for the organisation alone published as 1,7 and
                    the same card called the other two "Bez ocene", which is the
                    record saying "nobody rated this" and averaging it as nought
                    in one breath. The comment is what may be left out. */}
                <button
                  type="button"
                  className="button button--primary"
                  disabled={MARKS.some((mark) => rating[mark] === 0)}
                  onClick={send}
                >
                  {t('event.commentSend')}
                </button>{' '}
                <Link className="button button--secondary" to={`/${locale}/kalendar/${slug}`}>
                  {t('event.commentCancel')}
                </Link>
              </p>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
