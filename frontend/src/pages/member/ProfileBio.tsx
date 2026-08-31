import { useEffect, useRef, useState } from 'react'
import { useToday } from '../../clock/useClock'
import { AskedLabel } from '../../forms/AskedLabel'
import { LongBox } from '../../forms/LongBox'
import { registracija } from '../../forms/definitions'
import { limitOf } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import { WHOLE } from '../../components/crop'
import { NO_RATING } from '../../data/types'
import type { Competitor } from '../../data/types'
import { useSession } from '../../session/useSession'

/**
 * Changing what a member wrote about themselves, after joining.
 *
 * Owner, 15.08.2026, asked what should happen to somebody whose biography was
 * refused: „Panel u Podešavanjima, kao za sliku." Until then the text was asked
 * for once, on the way in, and a refusal reached the member with a reason they
 * had nowhere to act on. The screen said so honestly and that was the whole of
 * the fix available at the time (PDL P22, PENDING R10).
 *
 * The same shape as the picture beside it, deliberately, because it is the same
 * errand: one thing about one profile goes for review on its own. Somebody
 * fixing a sentence should not have their town and their shirt size travel
 * through a queue with it, and the queue already tells the two sorts apart
 * (`kind` in data/types.ts).
 *
 * What stands on the profile is shown first. A box that opened empty would read
 * as „write one" to somebody who has written one already, and what they are
 * usually doing here is mending a sentence rather than starting again.
 */
export function ProfileBio({ me }: { me: Competitor }) {
  const { t } = useI18n()
  const { propose, proposals, decisions } = useSession()
  const today = useToday()
  const [written, setWritten] = useState(me.bio)
  const [justSent, setJustSent] = useState(false)
  const said = useRef<HTMLParagraphElement>(null)

  /* The one waiting text, and only the one sent during this visit.
   *
     The same limit as the picture panel and for the same reason: what was sent
     on an earlier visit is written in `verification.json`, the whole queue,
     which holds names and postal addresses of people who are not members yet.
     Reading it here downloads all of that into a member`s browser, and a
     standing guard refuses it by name (pages/publicData.test.tsx). With a
     database this is one question about one member; until then somebody who
     writes twice across two visits gives the moderator two cards, which is
     written down rather than left to be discovered (PDL P22).
   *
     Decisions are read all the same, so a text approved during this visit hands
     the box straight back rather than leaving somebody told to wait. */
  const waiting = proposals.find(
    (one) =>
      one.queue === 'profiles' &&
      one.kind === 'bio' &&
      one.memberNumber === me.memberNumber &&
      decisions[one.id] === undefined,
  )

  /* Said out loud, because the control just pressed is replaced by a sentence
     (WCAG 2.2 SC 4.1.3, and the order of focus in 2.4.3). */
  useEffect(() => {
    if (justSent) {
      said.current?.focus()
    }
  }, [justSent])

  const who = `${me.firstName} ${me.lastName}`
  /* Nothing to send where nothing was written, and nothing to send where the
     words are the ones already on the profile: a moderator reading a card that
     asks them to approve what they approved last week learns to skim. */
  const same = written.trim() === me.bio.trim()

  function send(): void {
    propose({
      queue: 'profiles',
      /* The sort that is refused with a plain reason rather than an instruction
         to work from (pages/admin/queues.ts). */
      kind: 'bio',
      date: today,
      memberNumber: me.memberNumber,
      who,
      subject: who,
      /* Empty, as every other item on this queue is: it carries a record's id
         where a decision is about a record, and this one is about a person. */
      subjectId: '',
      body: written.trim(),
      picture: '',
      crop: WHOLE,
      currentDate: '',
      proposedDate: '',
      rating: NO_RATING,
      email: '',
      city: '',
      country: '',
    })

    setJustSent(true)
  }

  return (
    <section className="member__panel" aria-labelledby="settings-bio">
      <h2 className="profile__section" id="settings-bio">
        {t('bio.title')}
      </h2>

      {waiting === undefined ? (
        <>
          <p className="member__note">{t(me.bio === '' ? 'bio.none' : 'bio.standing')}</p>

          <div className="rankings__field rankings__field--wide">
            <AskedLabel id="settings-bio-box" asked={false}>
              {t('profile.bio')}
            </AskedLabel>
            <LongBox
              id="settings-bio-box"
              value={written}
              maxLength={limitOf(registracija, 'bio')}
              leftId="settings-bio-left"
              /* The count, read on the way into the box rather than found by
                 hitting the end of it. `LongBox` draws it `aria-hidden` and says
                 so in its own comment: pointing at it is the caller's business,
                 and the caller that forgets it leaves a member who cannot see the
                 screen with a limit they meet only as a wall (WCAG 2.2 SC 3.3.2).
                 Written the same way as the comment box on an event, which is the
                 other hand-made `LongBox` on the portal (pages/event/RateEvent.tsx).

                 The rule that stood beside it went out on 31.08.2026 with the last
                 three of its kind, and its id went out of this list with it: a
                 description pointing at an element that is not there is read as
                 nothing at all, silently, and no test that reads text can see it. */
              aria-describedby="settings-bio-left"
              onChange={setWritten}
            />
          </div>

          <p className="member__actions">
            {/* Told off rather than switched off, as everywhere else on the
                portal: `disabled` takes the button out of the tab order and
                takes the reason it stands for with it. */}
            <button
              type="button"
              className="button button--primary"
              aria-disabled={same}
              aria-describedby={same ? 'bio-waits' : undefined}
              onClick={() => {
                if (same) {
                  return
                }

                send()
              }}
            >
              {t('bio.send')}
            </button>
          </p>

          {same && (
            <p id="bio-waits" className="rate__hint" role="status">
              {t(me.bio === '' ? 'bio.writeFirst' : 'bio.changeFirst')}
            </p>
          )}
        </>
      ) : (
        <>
          {/* Nothing to press while one is waiting: the member has already
              asked, and a second ask gives a moderator two texts of one person
              and no question to answer.
           *
              Focus is moved here and the reader is therefore told by landing on
              it; `role="status"` is the belt beside that brace, for the case
              where focus does not arrive because something took it first. It is
              deliberately not measured: a test that reads an attribute proves
              the attribute is written, not that anything is announced, and the
              thing worth measuring is where the focus goes, which
              `profileBio.test.tsx` does hold. */}
          <p className="member__note" ref={said} tabIndex={-1} role="status">
            {t('bio.waitingNote')}
          </p>

          {/* What was sent, so somebody who cannot remember what they wrote does
              not have to guess while it is out of their hands. */}
          <p className="pending__body">{waiting.body}</p>
        </>
      )}
    </section>
  )
}
