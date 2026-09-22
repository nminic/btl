import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { Stars } from '../../components/Stars'
import { RequiredNote } from '../../forms/AskedLabel'
import { NO_RATING, RATING_MARKS, type EventRating } from '../../data/types'
import { combineResources, useEvents, useRaces, useResults } from '../../data/useResource'
import { ran } from './ran'
import { prijava } from '../../forms/definitions'
import { LongBox } from '../../forms/LongBox'
import { limitOf } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import { useSend, useSent } from '../sent'
import { useMemberScreen } from '../member/memberScreen'
import { NotRunYet } from './NotRunYet'
import { askTheServer, type Answer } from '../account/askTheServer'
import { WHEN_RATING_AN_EVENT } from '../account/refusals'
import { ServerSaid } from '../account/ServerSaid'
import '../member/Member.css'

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
  const who = useMemberScreen()
  /* THREE RESOURCES AND NOT FOUR, since 22.09.2026: the competitor list was read only
     to put a display name on the local proposal this screen used to write. The name a
     moderator sees now comes off `verification.competitor_id`, read live by
     `VerificationApi` at the moment the queue is drawn - never a copy this screen
     carries in the request. One fewer resource this screen waits on. */
  const state = combineResources(useEvents(), useResults(), useRaces())
  const [rating, setRating] = useState<EventRating>(NO_RATING)
  const [comment, setComment] = useState('')
  /* Held by the address rather than by the screen, so that the way back from this
     confirmation is the event and not the form that has already been sent (PDL,
     05.09.2026). */
  const sent = useSent() !== undefined
  const confirm = useSend()
  /* What the server answered, where it has answered anything that is not „done". A
     rating that succeeded leaves this screen altogether (`confirm` below), so the
     only answer this ever holds is one the reader is owed a sentence about - the
     same shape `Registration.tsx` keeps for the identical reason. */
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [sending, setSending] = useState(false)
  /* A second press while the first is still out would send the same rating twice;
     `TeamWriteApi`'s own screen (`ProposeTeam.tsx`) and `Registration.tsx` both guard
     the identical race with a ref rather than the state beside it, since the ref is
     read and written in the same tick and a redraw cannot land between two presses
     that arrive before one. */
  const outstanding = useRef(false)

  if (who.memberNumber === null) {
    return who.instead
  }

  const { memberNumber } = who

  const mine = memberNumber

  if (sent) {
    return (
      <div className="member" role="status">
        <h1>{t('event.commentTitle')}</h1>
        <p>{t('event.commentSent')}</p>
      </div>
    )
  }

  return (
    <div className="member">
      <Resource state={state}>
        {([events, results, races]) => {
          const found = events.find((one) => one.slug === slug)

          if (found === undefined) {
            return <h1>{t('event.notFound')}</h1>
          }

          const event = found

          /* Checked here and not only where the button is. The address can be
             typed, and a rule kept by hiding a link is not kept. */
          if (event.date > today) {
            return <NotRunYet />
          }

          /* And a rating belongs to somebody who was there (owner, 11.08.2026).
             Checked here as well as where the button is, for the same reason
             the date is: the address can be typed, and a rule kept by hiding a
             link is not kept. */
          if (!ran(results, races, event.id, mine)) {
            return <NotRunYet why="notRanIt" />
          }

          /* Nothing to send until all three are given: the overall is their
             average, so a mark left out is published as a nought. */
          const waiting = RATING_MARKS.some((mark) => rating[mark] === 0)

          /**
           * Sends the rating, and decides what the reader sees by what came back.
           *
           * <p><b>THE CONFIRMATION IS DRAWN ONLY AFTER 201</b>, `Registration.tsx`'s own
           * shape: the rating and the comment go to the queue a moderator reads
           * (PDL P22), and until the server has said so there is nothing sent to be
           * confirmed.
           *
           * <p><b>Refused, nothing moves.</b> The three stars and the box stay exactly
           * as they were, and the sentence appears beneath the button - never the reason
           * the button is already disabled for (`waiting`), which is said in its own
           * place and needs no round trip to know.
           */
          async function submit(): Promise<void> {
            outstanding.current = true
            setSending(true)
            /* AND THE LAST REFUSAL GOES WHILE THIS ONE IS OUT, for the reason
               `Registration.tsx` gives it: a reader who presses again should not read
               the old sentence over a request that is still in flight. */
            setRefusal(null)

            const answer = await askTheServer('/api/comments', {
              eventId: event.id,
              organisation: rating.organisation,
              value: rating.value,
              ambience: rating.ambience,
              body: comment,
            })

            outstanding.current = false
            setSending(false)

            if (answer.got === 'done') {
              confirm(`/${locale}/kalendar/${slug}`, true)

              return
            }

            setRefusal(answer)
          }

          function send() {
            /* Says so rather than being switched off, so nothing stops the
               press but this: the rating is not complete and the reason is on
               the screen beside the button. A second press while the first is
               still out is refused the same silent way. */
            if (waiting || outstanding.current) {
              return
            }

            void submit()
          }

          return (
            <>
              <h1>{event.name}</h1>
              <p className="profile__meta">{t('event.commentIntro')}</p>

              {/* Not a `<form>` with a submit. The three ratings are radios and
                  a form of radios submits on Enter from anywhere inside it, so a
                  member pressing Enter after the third star would send a comment
                  they had not written yet. */}
              {/* One line for the three ratings below, which are the obligatory
                  part of this screen (forms/AskedLabel.tsx). */}
              <RequiredNote />

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
                  {/* And the comment beside them may be left empty, marked the
                      way every optional field on the portal is marked. */}
                  <label htmlFor="comment">
                    {t('event.commentText')}
                    <span className="field__optional"> ({t('form.optional')})</span>
                  </label>
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
                    maxLength={limitOf(prijava, 'comment')}
                    leftId="comment-left"
                    aria-describedby="comment-left"
                    onChange={setComment}
                  />
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

              {/* Said out loud rather than left to a button that looks unpressed,
                  the same reasoning `Registration.tsx` keeps beside its own
                  `role="status"` (WCAG 2.2, 4.1.3). */}
              {sending && <p role="status">{t('event.commentSending')}</p>}

              {refusal !== null && (
                <ServerSaid answer={refusal} refusals={WHEN_RATING_AN_EVENT} />
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
