import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { Stars } from '../../components/Stars'
import { NO_RATING, RATING_MARKS, type EventRating } from '../../data/types'
import { combinePair, useCompetitors, useEvents } from '../../data/useResource'
import prijava from '../../forms/definitions/prijava-sa-trke.form.json'
import { LongBox } from '../../forms/LongBox'
import { limitOf } from '../../forms/records'
import type { FormDef } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { SignedOut } from '../member/SignedOut'
import { NotRunYet } from './NotRunYet'
import '../member/Member.css'

/** The three marks, in the order they are asked for and read back. */
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
/**
 * The screen, keyed by the event it is about.
 *
 * The router keeps one element across a change of the address's own parts, so
 * without this the marks, the words and "it has been sent" would all survive a
 * step from one event's rating to another's: the second screen would open
 * carrying the first one's answers, and one press would file them under the
 * second event. No path through the portal goes from one of these to another
 * without an event page in between, which unmounts this; that is a fact about
 * today's links, not about the screen.
 */
export function RateEvent() {
  const { slug } = useParams()

  return <RateOne key={slug} />
}

function RateOne() {
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

          /* Checked here and not only where the button is. The address can be
             typed, and a rule kept by hiding a link is not kept. */
          if (event.date > today) {
            return <NotRunYet slug={event.slug} />
          }

          const me = competitors.find((one) => one.memberNumber === mine)
          const who = me === undefined ? '' : `${me.firstName} ${me.lastName}`
          /* Nothing to send until all three are given: the overall is their
             average, so a mark left out is published as a nought. */
          const waiting = RATING_MARKS.some((mark) => rating[mark] === 0)

          function send() {
            /* Says so rather than being switched off, so nothing stops the
               press but this: the rating is not complete and the reason is on
               the screen beside the button. */
            if (waiting) {
              return
            }

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
                {RATING_MARKS.map((mark) => (
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
                  {/* The same box the form next door draws for the same field
                      of the same definition (records.ts, `limitOf`): the limit
                      is refused at the door, and the writer is told how much
                      room there is, what a paste has just lost and when the box
                      will take no more. Carrying only the number, which is what
                      this did at first, cuts three hundred characters off a
                      pasted race report in silence. */}
                  <LongBox
                    id="comment"
                    value={comment}
                    maxLength={limitOf(prijava as FormDef, 'comment')}
                    leftId="comment-left"
                    aria-describedby="comment-hint comment-left"
                    onChange={setComment}
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
                {/* Not switched off, told off: `disabled` takes a control out
                    of the tab order, so the reason it points at is one nobody
                    tabbing can ever reach. The portal has answered this twice
                    already and the same way (PendingQueue.tsx, Pager.tsx). */}
                <button
                  type="button"
                  className="button button--primary"
                  aria-disabled={waiting}
                  aria-describedby={waiting ? 'send-waits' : undefined}
                  onClick={send}
                >
                  {t('event.commentSend')}
                </button>{' '}
                <Link className="button button--secondary" to={`/${locale}/kalendar/${slug}`}>
                  {t('event.commentCancel')}
                </Link>
              </p>

              {/* Why it will not go yet, said where it can be read rather than
                  left to a button that is simply dead.

                  Drawn only while it is true, which is not what the queue next
                  door does with its own refusal: there the live region is always
                  in the page and empty, because a region that arrives carrying
                  its words is one nobody is told about (PendingQueue.tsx). Here
                  it does arrive carrying them, because this whole part waits for
                  the event to load, so nothing rests on it being announced: the
                  button points at it with `aria-describedby`, and the button is
                  reachable, which is the half that was missing. */}
              {waiting && (
                <p id="send-waits" className="rate__hint" role="status">
                  {t('event.commentNeedsMarks')}
                </p>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
