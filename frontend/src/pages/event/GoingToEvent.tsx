import { ProfileLink } from '../profile/ProfileLink'
import { useEffect, useRef, useState } from 'react'
import { Resource } from '../../components/Resource'
import { useToday } from '../../clock/useClock'
import { clearResourceCache } from '../../data/client'
import { useAttendance, useCompetitors } from '../../data/useResource'
import type { Attending, BtlEvent, Competitor } from '../../data/types'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { limitOf } from '../../forms/records'
import type { FormDef } from '../../forms/types'
import { isMember, type Role } from '../../roles/context'
import {
  isActiveMember,
  isActiveMemberOrAdministration,
} from '../../roles/activeMemberOrAdministration'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { WHEN_SAYING_YOU_ARE_GOING, WHEN_WRITING_TO_A_MEMBER } from '../account/refusals'
import { ServerSaid } from '../account/ServerSaid'
import './GoingToEvent.css'

/**
 * Who is going to this race, and the way to write to any of them.
 *
 * A stated intention and nothing more (PDL P10, from the beginning): the portal
 * points at the organiser's own entry form and never pretends to be it. What
 * this is for is the other half of that decision, the one the inbox exists for:
 * two members going to the same race in another town share a car.
 *
 * **For active members and the administration, since 03.10.2026.** The button and
 * the list were the members' from 11.08.2026, and the owner narrowed both that
 * day, choosing between offered outcomes; PDL records the choice as „Najavu
 * dolaska daju i spisak najavljenih vide aktivni članovi (važeća članarina), a
 * spisak vidi i administracija". So a visitor sees nothing here, and neither does anybody
 * signed in whose fee is not standing; a moderator and the superadmin read the
 * list; and the switch is a member's in good standing, a moderator's included
 * where he races. Asked of `roles/activeMemberOrAdministration.ts`, the one home
 * of that question on the screen. The comments under the event ask it too
 * (`useReadsComments`): this said they kept the older rule, anybody signed in, which
 * the owner had left as it was, until his choice of the same day that gave them the
 * same reader (PDL P6, 03.10.2026, „Komentare vide aktivni članovi i administracija,
 * isto kao najava dolaska").
 *
 * **THE SERVER KEEPS IT, AND THE SCREEN DRAWS ONLY WHAT THE SERVER SAYS.** Until
 * 03.10.2026 the switch wrote into this visit's session and nowhere else, and the
 * owner, testing: „Prijavim se da idem na ovaj događaj i kad osvežim stranu moja
 * prijava nestane. Mora da se zapamti!" A press now goes to
 * `PUT` or `DELETE /api/attendance/{id}`, and what the switch and the list show
 * is read back from `GET /api/attendance` once the server has said yes - never
 * the press itself, so a write the server refused or did not keep cannot be drawn
 * as one that happened.
 *
 * **Only ahead of the race.** Saying you are going to something that has already
 * been run is not an intention, it is a memory, and the portal has results for
 * that. The day this page asks by is the browser's day in UTC and the server's is
 * Belgrade's, so for an hour or two after midnight the switch is still drawn on
 * the event of the day before and a press is refused in words
 * (`WHEN_SAYING_YOU_ARE_GOING`); the clock is shared by every screen, so that
 * boundary is named here rather than moved.
 */
export function GoingToEvent({ event }: { event: BtlEvent }) {
  const today = useToday()
  const { role } = useRole()
  const { memberNumber } = useSession()

  /* Nobody signed in, and a race that has been run: nothing at all, and nothing is
     asked of the server either. A visitor used to fetch the list he was never shown,
     which the server answers 401; now nothing is asked that nobody draws. */
  if (!isMember(role) || event.date < today) {
    return null
  }

  return <ForAReader event={event} role={role} me={memberNumber} />
}

/**
 * Somebody signed in, before it is known whether he reads the list.
 *
 * The administration reads it whatever its own fee; a member reads it when his
 * fee is standing, which the screen learns from the list of members the server
 * serves (`isActiveMember`). That list is what names everybody below anyway, so
 * the question costs no request of its own, and the list of who is going is not
 * asked for until the answer is yes.
 */
function ForAReader({ event, role, me }: { event: BtlEvent; role: Role; me: string | null }) {
  const { t } = useI18n()
  const competitors = useCompetitors()

  return (
    <Resource state={competitors} inline label={t('event.going')}>
      {(served) =>
        isActiveMemberOrAdministration(role, me, served) ? (
          <TheList event={event} competitors={served} me={me} mayGo={isActiveMember(me, served)} />
        ) : null
      }
    </Resource>
  )
}

/**
 * The section itself, for somebody who reads it.
 *
 * It asks for the list, and asks again whenever a press has been answered yes:
 * the cache is dropped and the revision bumped in one breath, because either
 * alone is a half - dropped without the bump nothing re-reads, bumped without the
 * drop the read is handed the very answer that was true before the press
 * (`theInboxHasChanged` gives the same reason for the inbox).
 */
function TheList({
  event,
  competitors,
  me,
  mayGo,
}: {
  event: BtlEvent
  competitors: Competitor[]
  me: string | null
  mayGo: boolean
}) {
  const { t } = useI18n()
  const [revision, setRevision] = useState(0)
  const attendance = useAttendance(revision)

  return (
    <section className="going" aria-labelledby="going-title">
      <h2 className="profile__section" id="going-title">
        {t('event.going')}
      </h2>

      <Resource state={attendance} inline label={t('event.going')}>
        {(answered) => (
          <Going
            event={event}
            attendance={answered}
            competitors={competitors}
            me={me}
            mayGo={mayGo}
            onChanged={() => {
              clearResourceCache('attendance')
              setRevision((was) => was + 1)
            }}
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
  mayGo,
  onChanged,
}: {
  event: BtlEvent
  attendance: Attending[]
  competitors: Competitor[]
  /** Who is reading, where that is somebody with a number of their own. A
   *  moderator who races for nobody has none, reads the list, and has nothing to
   *  say about going. */
  me: string | null
  /** Whether the reader is a member whose fee is standing, and so may say he is
   *  going: the administration reads the list without being one. */
  mayGo: boolean
  /** Said once the server has answered a press with yes, so the list is asked
   *  for again. */
  onChanged: () => void
}) {
  const { locale, t } = useI18n()
  /* Who this visit is writing to, or nobody. The person and not their number:
     the envelope is pressed on a row that already holds them, so looking them up
     again afterwards would be a lookup that cannot fail and a branch nothing can
     reach. One at a time: the box is a conversation with one person about one
     race. */
  const [writingTo, setWritingTo] = useState<Competitor | null>(null)
  /** While a press is out, which is what the line under the switch says. */
  const [saying, setSaying] = useState(false)
  /** What the server answered a press, where it answered anything but yes. */
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  /** A second press while the first is still out is not sent: the two would cross on
   *  the way, and the verb of the second would be chosen from an answer the first is
   *  about to make untrue. Held in a ref and not in the state beside it, for the reason
   *  `WriteTo` below gives: a ref is read and written in the same tick, and a redraw
   *  cannot land between two presses that arrive before one answer does. */
  const outstanding = useRef(false)

  /* What the server says, and nothing else: who is going to THIS event. */
  const numbers = attendance
    .filter((one) => one.eventId === event.id)
    .map((one) => one.memberNumber)
  /* Named, and in the order the league lists people.
   *
   * Everybody is drawn, including whoever has no record left and whoever is no
   * longer active: the switch and the list are one answer to one question, and
   * a switch saying „you are going" over a list saying „nobody is" is the
   * screen contradicting itself. What a missing record costs is the link and
   * the name, not the row: a profile that is not there is not a link (PDL P11),
   * so such a row is plain words.
   *
   * **The two are one lookup since 21.09.2026:** whoever is no longer active has
   * no record in the answer either (owner, 13.09.2026), so `find` returning
   * nothing covers both and the second condition had nothing left to read. */
  const named = numbers
    .map((number) => ({
      number,
      who: competitors.find((one) => one.memberNumber === number),
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
  const iAmGoing = numbers.some((one) => one === me)

  /**
   * Says it to the server, and lets the list say what came of it.
   *
   * <p><b>The verb is the served list's</b>: on it, the press takes the name off;
   * off it, the press puts it on. Chosen at the press and never from a count of
   * presses kept here, so a member who was already going when the page opened
   * takes his name off with his first press.
   *
   * <p><b>Nothing on the screen moves until the server has answered</b>, and then
   * only through the list read again (`onChanged`). Refused, the switch stays as
   * it was and the reason stands under it.
   */
  async function say(): Promise<void> {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setSaying(true)
    /* And the last refusal goes while this one is out, the reason `WriteTo` gives:
       a reader who presses again should not be reading the old sentence over a
       request that is still in flight. */
    setRefusal(null)

    const answer = await askTheServer(
      `/api/attendance/${String(event.id)}`,
      {},
      iAmGoing ? 'DELETE' : 'PUT',
    )

    outstanding.current = false
    setSaying(false)

    if (answer.got === 'done') {
      onChanged()

      return
    }

    setRefusal(answer)
  }

  return (
    <>
      {/* A switch, not a press: pressing it again takes the name off the list
          (owner, 11.08.2026). `aria-pressed` is what says which of the two it is
          in, because the words on it change and a reader who cannot see it
          hears only the words. */}
      {/* And only for a member whose fee is standing. The administration reads the
          list, because the owner gave the list to it, but saying you are going is a
          member's (03.10.2026), so a moderator who races for nobody has no switch. */}
      {mayGo && (
      <button
        type="button"
        className={iAmGoing ? 'button button--primary' : 'button button--secondary'}
        aria-pressed={iAmGoing}
        onClick={() => {
          void say()
        }}
      >
        {/* One name whichever way it is switched, because `aria-pressed` is
            already saying which: a label that changes as well is the state read
            out twice, once in words and once in the role. */}
        {t('event.goingOn')}
      </button>
      )}

      {/* Said out loud while it is out, the same words and the same reasoning as the
          note's own line below (WCAG 2.2, 4.1.3). */}
      {saying && <p role="status">{t('event.commentSending')}</p>}

      {/* And what the server said, where it said anything but yes, under the switch
          it is about. */}
      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_SAYING_YOU_ARE_GOING} />}

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

      {/* AND NOTHING HERE ASKS AGAIN WHO IS WRITING, since 28.09.2026. The note used
          to carry a name this screen worked out, so `WriteTo` was handed `me` and the
          whole competitor list to look it up in; the server reads the sender off his
          own row now (`InboxWriteApi.nameTheLeagueKnowsHimBy`), so both are gone.

          **`me !== null` STAYS ON THIS LINE, though.** Dropping it here was a HIGH
          finding (review, 28.09.2026), and the claim that carried it - „a branch
          nothing reaches" - was measured and was wrong: `writingTo` is state that
          belongs to `Going`, and signing out does not take `Going` down with it.
          Signing out and back in both happen IN PLACE, no navigation and no reload
          (`data/client.ts`, `AccountMenu.tsx`), so `Going` keeps running with the same
          `writingTo` it already had and only `me` drops to null. Without the guard the
          form a member opened stayed on screen after they signed out of that same
          visit, under the full name of whoever's envelope they had pressed - to
          somebody no longer signed in at all. Proven by a case that opens the form and
          then signs out from a live session.

          **Since 03.10.2026 the section is drawn only for an active member or the
          administration (`ForAReader`)**, so a member whose number drops to null is no
          longer a reader and `Going` goes with him. The guard stays for a reader who is
          still drawn the section with no number of his own, and that reader is the
          administration. */}
      {writingTo !== null && me !== null && (
        <WriteTo
          /* Keyed by whoever is being written to, so pressing another envelope
             is a new note rather than the last one's confirmation. */
          key={writingTo.memberNumber}
          event={event}
          them={writingTo}
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
 * The bell always and no mail at all, which is what PDL P22 asks of everything
 * sideways since 29.09.2026 („Mejla nema uopste, pa nema ni prekidaca").
 *
 * **AND SINCE 28.09.2026 IT GOES TO THE SERVER, which is the whole of this
 * increment.** Until that day it called `notify`, which writes into
 * `session/SessionProvider.tsx` and nowhere else, and the screen then said „Poruka je
 * poslata". Measured rather than assumed: `POST /api/inbox` had been standing since PR
 * 307 with NO caller anywhere in `frontend/src`, so the note reached nobody and went
 * with the next refresh.
 *
 * **What was NOT true about it, and is worth writing down because it decides what a
 * case can measure.** It did not land in the writer's own inbox either:
 * `SessionProvider`'s `inbox` keeps only `to === '' || to === memberNumber`, and this
 * screen always addressed somebody else. So „the writer's inbox holds nothing of it"
 * was green before this change and is green after it, FOR TWO DIFFERENT REASONS - the
 * filter hid it, and now there is nothing to hide. A case resting on that alone would
 * measure neither, which is why the case that holds this reads WHAT WAS SENT.
 *
 * **And nothing is cleared afterwards, which is a measurement rather than an
 * oversight.** `InboxApi.messagesFor` serves `where m.to_id = :me or m.to_id is null`,
 * so a member's own inbox never carries what he wrote to somebody else: the one
 * resource this write could make stale is the ADDRESSEE'S, and that is not this
 * visit's to re-read. Dropping `inbox` here would be a fetch that asks for the same
 * answer twice, which is the shape `RateEvent.tsx` avoids for the same reason.
 */
function WriteTo({
  event,
  them,
  onDone,
}: {
  event: BtlEvent
  them: Competitor
  onDone: () => void
}) {
  const { t } = useI18n()
  const [words, setWords] = useState('')
  /** Nothing to send: worked out once, since the button, the reason beside it
   *  and the refusal on submit all have to agree about it. */
  const empty = words.trim() === ''
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  /** What the server answered, where it answered anything that is not „done". A note
   *  that went leaves this form for the confirmation below, so the only answer this
   *  ever holds is one the reader is owed a sentence about - `RateEvent.tsx`'s own
   *  shape, on the same screen, for the identical reason. */
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  /** A second press while the first is still out would write the same note twice, and
   *  a message cannot be taken back (PDL, 06.09.2026: „brisanje poruke iz tudjeg
   *  sanduceta je brisanje istorije"). Held in a ref and not in the state beside it,
   *  because a ref is read and written in the same tick and a redraw cannot land
   *  between two presses that arrive before one answer does - which is how
   *  `RateEvent.tsx` and `Registration.tsx` both guard the identical race. */
  const outstanding = useRef(false)
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

  /**
   * Sends the note, and decides what the reader sees by what came back.
   *
   * <p><b>THE CONFIRMATION IS DRAWN ONLY AFTER 201</b>, which is `RateEvent.tsx`'s own
   * shape: until the server has said the row is standing there is nothing sent to be
   * confirmed, and the sentence this screen draws names the member it reached.
   *
   * <p><b>Refused, nothing moves.</b> The box keeps every word of it and the sentence
   * appears beneath the button, so a note refused is a note that can be sent again
   * rather than one that has to be written again.
   *
   * <p><b>WHAT IS SENT IS THREE FIELDS AND THE SERVER OWNS THE REST.</b>
   * `InboxWriteApi.Written` takes `to`, `subject` and `body` and says why there is no
   * more: „There is no `from`, no `date` and no `read`: each of the three is the
   * server's or the database's, and a field for one of them would be a value the
   * caller gets to choose." The name the addressee reads is
   * `competitor.first_name || ' ' || last_name` read off the sender's own row, and the
   * moment is V13's `now()`. So this screen no longer works out who is writing at all.
   */
  async function submit(): Promise<void> {
    outstanding.current = true
    setSending(true)
    /* And the last refusal goes while this one is out, the reason `Registration.tsx`
       gives it: a reader who presses again should not be reading the old sentence over
       a request that is still in flight. */
    setRefusal(null)

    const answer = await askTheServer('/api/inbox', {
      to: them.memberNumber,
      subject: t('event.writeSubject', { event: event.name }),
      body: words,
    })

    outstanding.current = false
    setSending(false)

    if (answer.got === 'done') {
      setSent(true)

      return
    }

    setRefusal(answer)
  }

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
        /* A second press while the first is still out is refused the same silent
           way, and for a heavier reason than an empty box: the row it would write
           cannot be taken back. */
        if (empty || outstanding.current) {
          return
        }

        /* And the box stays where it was until the server answers. Closing it here
           took the confirmation down with it in the same breath, so the message went
           and nothing on the screen said it had; `submit` is what decides between the
           confirmation and a sentence saying why not. */
        void submit()
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

      {/* Said out loud rather than left to a button that looks unpressed, the same
          reasoning `Registration.tsx` and `RateEvent.tsx` keep beside their own
          `role="status"` (WCAG 2.2, 4.1.3).

          THE WORDS ARE THE RATING CARD'S OWN AND THAT IS DELIBERATE: „Šalje se" is one
          sentence about one thing, and a second key holding the same three letters
          would be a second place to change it. The portal already shares a sentence
          across two acts where the acts agree about what it says
          (`WHEN_LEAVING_A_TEAM`, `account/refusals.ts`). */}
      {sending && <p role="status">{t('event.commentSending')}</p>}

      {/* And what the server said, where it said anything but yes. Beneath the button
          and never in place of the box: the words the reader typed are still his. */}
      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_WRITING_TO_A_MEMBER} />}
    </form>
  )
}
