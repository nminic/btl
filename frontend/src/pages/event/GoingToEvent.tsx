import { ProfileLink } from '../profile/ProfileLink'
import { useEffect, useRef, useState } from 'react'
import { Resource } from '../../components/Resource'
import { useToday } from '../../clock/useClock'
import { combinePair, useAttendance, useCompetitors } from '../../data/useResource'
import type { BtlEvent, Competitor } from '../../data/types'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { limitOf } from '../../forms/records'
import type { FormDef } from '../../forms/types'
import { useReadsComments } from './readsComments'
import { useSession } from '../../session/useSession'
import './GoingToEvent.css'

/**
 * Who is going to this race, and the way to write to any of them.
 *
 * A stated intention and nothing more (PDL P10, from the beginning): the portal
 * points at the organiser's own entry form and never pretends to be it. What
 * this is for is the other half of that decision, the one the inbox exists for:
 * two members going to the same race in another town share a car.
 *
 * **Only for members, both halves.** The button is theirs and so is the list
 * (owner, 11.08.2026): a visitor sees a race and its results, not who is going
 * to it. Names of people and a way to write to them are not a public directory.
 *
 * Who counts as a member is the same question the comments ask, and it is asked
 * in the same words (`useReadsComments`): a moderator and the superadmin have no
 * member number of their own, and a rule written here as „has a number" would
 * have hidden the list from them while the comments beside it stayed open. What
 * a number is needed for is saying that you are going, which is the half below.
 *
 * **Only ahead of the race.** Saying you are going to something that has already
 * been run is not an intention, it is a memory, and the portal has results for
 * that.
 */
export function GoingToEvent({ event }: { event: BtlEvent }) {
  const { t } = useI18n()
  const today = useToday()
  const { memberNumber } = useSession()
  const reads = useReadsComments()
  const state = combinePair(useAttendance(), useCompetitors())

  /* A screen and not a lock, and this file is the one that most needs saying so:
     it names which member is going to which race. The fetch above happens before
     this line, so a visitor's browser holds it too. That is what a mock layer
     is: one static file served to everybody. When the API arrives (plan F5) the
     endpoint that serves attendance must refuse an unauthenticated caller, the
     same way the one for comments must (EventComments.tsx). */
  if (!reads || event.date < today) {
    return null
  }

  return (
    <section className="going" aria-labelledby="going-title">
      <h2 className="profile__section" id="going-title">
        {t('event.going')}
      </h2>

      <Resource state={state} inline label={t('event.going')}>
        {([attendance, competitors]) => (
          <Going
            event={event}
            attendance={attendance}
            competitors={competitors}
            me={memberNumber}
          />
        )}
      </Resource>
    </section>
  )
}

function Going({
  event,
  attendance,
  competitors,
  me,
}: {
  event: BtlEvent
  attendance: { eventId: string; memberNumber: string }[]
  competitors: Competitor[]
  /** Who is reading, where that is somebody with a number of their own. A
   *  moderator has none, reads the list, and has nothing to say about going. */
  me: string | null
}) {
  const { locale, t } = useI18n()
  const { going, setGoing } = useSession()
  /* Who this visit is writing to, or nobody. The person and not their number:
     the envelope is pressed on a row that already holds them, so looking them up
     again afterwards would be a lookup that cannot fail and a branch nothing can
     reach. One at a time: the box is a conversation with one person about one
     race. */
  const [writingTo, setWritingTo] = useState<Competitor | null>(null)

  /* What the file says, and then what has been said during this visit. The
     switch is a value rather than an absence (session/context.ts), so a member
     who takes their name off is taken off a list the file still carries. */
  const said = going[event.id]
  const fromFile = attendance
    .filter((one) => one.eventId === event.id)
    .map((one) => one.memberNumber)
  const numbers = [
    ...fromFile.filter((one) => one !== me || said !== false),
    ...(said === true && me !== null && !fromFile.includes(me) ? [me] : []),
  ]
  /* Named, and in the order the league lists people.
   *
   * Everybody is drawn, including whoever has no record left and whoever is no
   * longer active: the switch and the list are one answer to one question, and
   * a switch saying „you are going" over a list saying „nobody is" is the
   * screen contradicting itself. What a missing record costs is the link and
   * the name, not the row: a profile that is not there is not a link (PDL P11),
   * so such a row is plain words. */
  const named = numbers
    .map((number) => ({
      number,
      who: competitors.find((one) => one.memberNumber === number && one.active),
    }))
    .sort((left, right) => {
      /* A row nobody can be named on goes under the named ones, and not over
         them. Sorted on the surname alone it sorted on an empty string, which
         precedes every letter, so a handful of „Član lige" stood at the head of
         the list above people with names. Alphabetical among those there is a
         name for, and the rest at the foot in the order the file has them. */
      return (
        Number(left.who === undefined) - Number(right.who === undefined) ||
        (left.who?.lastName ?? '').localeCompare(right.who?.lastName ?? '', locale)
      )
    })
  const iAmGoing = named.some((one) => one.number === me)

  return (
    <>
      {/* A switch, not a press: pressing it again takes the name off the list
          (owner, 11.08.2026). `aria-pressed` is what says which of the two it is
          in, because the words on it change and a reader who cannot see it
          hears only the words. */}
      {/* And only for somebody who can be on the list. A moderator reads it,
          because the same question decides that as decides the comments, but a
          moderator has no member number and so nothing to say about going. */}
      {me !== null && (
      <button
        type="button"
        className={iAmGoing ? 'button button--primary' : 'button button--secondary'}
        aria-pressed={iAmGoing}
        onClick={() => setGoing(event.id, !iAmGoing)}
      >
        {/* One name whichever way it is switched, because `aria-pressed` is
            already saying which: a label that changes as well is the state read
            out twice, once in words and once in the role. */}
        {t('event.goingOn')}
      </button>
      )}

      {named.length === 0 ? (
        <p className="profile__empty">{t('event.goingNobody')}</p>
      ) : (
        <ul className="going__list" aria-labelledby="going-title">
          {named.map(({ number, who }) => (
            <li key={number} className="going__one">
              {who === undefined ? (
                /* No record to lead to, so no link: the words stand alone. */
                <span>{t('event.someMember')}</span>
              ) : (
                <ProfileLink competitor={who}>
                  {who.firstName} {who.lastName}
                </ProfileLink>
              )}

              {/* Not to oneself, and not to somebody there is no record of: a
                  member writing to their own inbox about a race they are both
                  going to is the portal talking to itself.
               *
                  And not from somebody with no number of their own. A moderator
                  reads this list, because the queue sends them to an event to
                  look at it, but a note from the moderation to a member about
                  a car share is not what this is (PDL P22 has its own way for
                  the moderation to write). */}
              {number !== me && who !== undefined && me !== null && (
                <button
                  type="button"
                  className="going__write"
                  aria-label={t('event.writeTo', { name: `${who.firstName} ${who.lastName}` })}
                  onClick={() => setWritingTo(who)}
                >
                  {'✉'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {writingTo !== null && me !== null && (
        <WriteTo
          /* Keyed by whoever is being written to, so pressing another envelope
             is a new note rather than the last one's confirmation. */
          key={writingTo.memberNumber}
          event={event}
          them={writingTo}
          competitors={competitors}
          me={me}
          onDone={() => setWritingTo(null)}
        />
      )}
    </>
  )
}

/**
 * How long a note may be. Its own definition, because there is no form for it:
 * one box and one button is not a form, and a number typed into the markup is a
 * number nothing holds.
 */
const WRITE_TO: FormDef = {
  id: 'poruka-clanu',
  titleKey: 'event.writeTo',
  submitKey: 'event.writeSend',
  fields: [
    {
      name: 'words',
      type: 'textarea',
      labelKey: 'event.writeTo',
      required: true,
      maxLength: 600,
    },
  ],
}

/**
 * A note to one member about one race.
 *
 * It goes to the portal's own inbox and not to their email (owner, 11.08.2026).
 * The bell always, the mail only where the member switched it on, which is what
 * PDL P22 asks of everything sideways.
 */
function WriteTo({
  event,
  them,
  competitors,
  me,
  onDone,
}: {
  event: BtlEvent
  them: Competitor
  competitors: Competitor[]
  me: string
  onDone: () => void
}) {
  const { t } = useI18n()
  const today = useToday()
  const { notify } = useSession()
  const [words, setWords] = useState('')
  /** Nothing to send: worked out once, since the button, the reason beside it
   *  and the refusal on submit all have to agree about it. */
  const empty = words.trim() === ''
  const [sent, setSent] = useState(false)
  const said = useRef<HTMLParagraphElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    /* And the box takes the focus when it opens, because it is what the
       envelope opened. It is drawn under the whole list, so on an event with
       twenty going the press on the first row put the box nineteen envelopes
       further down the keyboard's path; the same three lines answer the same
       thing when it is sent. */
    box.current?.focus()
  }, [])

  useEffect(() => {
    /* The confirmation takes the focus the submit button was holding, and it is
       what the button was replaced by. Without it the focus falls to the page
       and a keyboard reader is put back at the top of the document; the same
       three lines answer the same thing where a record is saved
       (admin/EntityEditor.tsx). */
    if (sent) {
      said.current?.focus()
    }
  }, [sent])
  /* Out of everybody rather than out of the list: a member who has not said they
     are going may still write to somebody who has. */
  const mine = competitors.find((one) => one.memberNumber === me)

  if (sent) {
    return (
      <p className="going__sent" role="status" tabIndex={-1} ref={said}>
        {t('event.written', { name: `${them.firstName} ${them.lastName}` })}{' '}
        {/* And a way out of it. Without one the line stood under the list until
            somebody pressed a different envelope, and pressing the same one
            again did nothing at all. */}
        <button type="button" className="going__done" onClick={onDone}>
          {t('form.close')}
        </button>
      </p>
    )
  }

  return (
    <form
      className="going__write-form"
      /* The portal answers for its own rules, in its own words: left to the
         browser, an empty box here was refused by Chrome's own bubble saying
         „Please fill out this field", in English, on a Serbian page
         (forms/FormRenderer.tsx says the same of every form it draws). */
      noValidate
      onSubmit={(pressed) => {
        pressed.preventDefault()

        /* The other half of telling the button off rather than switching it
           off: a control that is reachable is a control that can be pressed, so
           the refusal has to live here too and not only in an attribute. Written
           means written, spaces taken off, exactly as the box for a reason on
           the verification queues decides it (admin/SendBack.tsx) and as the
           forms do (forms/validate.ts): three spaces are not a message. */
        if (empty) {
          return
        }

        notify({
          /* Who it is from, in words, because that is what an inbox shows. A
             member whose own record is gone writes as the league would: there is
             nothing else true to put there. */
          from: mine === undefined ? t('event.someMember') : `${mine.firstName} ${mine.lastName}`,
          to: them.memberNumber,
          subject: t('event.writeSubject', { event: event.name }),
          body: words,
          date: today,
        })
        /* And the box stays where it was, saying so. Closing it here took the
           confirmation down with it in the same breath, so the message went and
           nothing on the screen said it had. */
        setSent(true)
      }}
    >
      {/* Obligatory, and it says so the way every field on the portal says it
          since 12.08.2026: a star for the eye, `aria-required` for a reader, and
          one line saying what the star means (forms/AskedLabel.tsx). */}
      <RequiredNote />

      <div className="field">
        <AskedLabel className="field__label" id="going-write">
          {t('event.writeTo', { name: `${them.firstName} ${them.lastName}` })}
        </AskedLabel>
        <textarea
          id="going-write"
          className="field__control"
          ref={box}
          aria-required="true"
          /* From the definition and not typed here, which is the rule every
             other long box on the portal keeps (forms/definitions.test.ts): a
             number written twice is a number that stops agreeing with itself. */
          maxLength={limitOf(WRITE_TO, 'words')}
          value={words}
          onChange={(typed) => setWords(typed.target.value)}
        />
      </div>

      <p className="member__actions">
        {/* Held shut while there is nothing to send, which is what the browser's
            own `required` used to do before this form began answering for its own
            rules. Taken off without putting anything in its place, an empty
            message went out and the screen said it had been sent.
         *
            Written means written, spaces taken off, exactly as the box for a
            reason on the verification queues decides it (admin/SendBack.tsx) and
            as the forms do (forms/validate.ts): three spaces are not a message. */}
        {/* Not switched off, told off. `disabled` takes the control out of the
            tab order, so somebody moving by keyboard never reaches it and never
            reaches the reason either. This is the fourth time the portal answers
            this question and it now answers it the same way as the other three
            (RateEvent.tsx, PendingQueue.tsx, Pager.tsx). */}
        <button
          type="submit"
          className="button button--primary"
          aria-disabled={empty}
          aria-describedby={empty ? 'write-waits' : undefined}
        >
          {t('event.writeSend')}
        </button>
        <button type="button" className="button button--secondary" onClick={onDone}>
          {t('form.close')}
        </button>
      </p>

      {/* Why it will not go yet, said where it can be read rather than left to a
          button that is simply dead. Drawn only while it is true, the same as on
          the rating card next door: this whole form is opened by a press, so
          nothing rests on the region being announced as it arrives. */}
      {empty && (
        <p id="write-waits" className="rate__hint" role="status">
          {t('event.writeNeedsWords')}
        </p>
      )}
    </form>
  )
}
