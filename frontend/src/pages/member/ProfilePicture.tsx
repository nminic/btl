import { useEffect, useRef, useState } from 'react'
import { useToday } from '../../clock/useClock'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { NO_RATING } from '../../data/types'
import type { Competitor } from '../../data/types'
import { useSession } from '../../session/useSession'

/**
 * Changing the picture on a profile, after joining.
 *
 * Owner, 12.08.2026: „Članovi treba da imaju mogućnost da promene ili obrišu
 * fotografiju naknadno tokom korišćenja sajta. Tad se samo fotografija šalje na
 * odobrenje Adminu ili moderatoru sa adekvatnim pravima."
 *
 * Only the picture goes, and that is why this lives here rather than behind an
 * edit of the profile: somebody who wants a better photograph should not have
 * their biography, their town and their shirt size sent back through a queue
 * with it. The racing profile queue already holds the two apart (`kind` in
 * data/types.ts), because a picture is decided differently from a text: it is
 * accepted, or handed back with an instruction saying what to change.
 *
 * **What the prototype cannot do yet, written here rather than implied.** No
 * member record carries a picture: `Competitor` has no such field and nothing
 * uploads one, which is exactly why a circle on this portal holds initials
 * (components/Portrait.tsx). So this screen sends a picture for review and says
 * where it has got to, and taking one down arrives with the pictures themselves,
 * in F5. The first version of this file offered „Ukloni sliku" and set a flag
 * inside itself: nobody saw the picture go, nothing remembered it past the
 * screen, and the panel could say „Nemaš sliku" and „čeka odobrenje" in the same
 * breath. A control that does nothing is worse than one that is not there.
 */
export function ProfilePicture({ me }: { me: Competitor }) {
  const { t } = useI18n()
  const { propose, proposals, decisions } = useSession()
  const today = useToday()
  const [chosen, setChosen] = useState('')
  const [round, setRound] = useState(0)
  const [justSent, setJustSent] = useState(false)
  const said = useRef<HTMLParagraphElement>(null)

  /* The one waiting picture, and only the one sent during this visit.
   *
     A review asked why an earlier visit is not counted, and the answer is that
     the only place it is written is `verification.json`, the whole queue: names
     and postal addresses of people who are not members yet, and the words of
     comments nobody has approved. Reading it here downloads all of that into a
     member`s browser, which a standing guard refuses by name
     (pages/publicData.test.tsx). Privacy beats the nicety: with a database this
     is one question about one member, and until then a member who sends a second
     picture across two visits gives the moderator two cards. Written down rather
     than left to be discovered (PENDING, and PDL P22).
   *
     Decisions are read all the same, so approving a picture during this visit
     hands the control straight back rather than leaving somebody told to wait
     with no way out. */
  const waiting = proposals.some(
    (one) =>
      one.queue === 'profiles' &&
      one.kind === 'photo' &&
      one.memberNumber === me.memberNumber &&
      decisions[one.id] === undefined,
  )

  /* Said out loud, because the control just pressed is replaced by a sentence:
     without this the focus falls to the body and a screen reader is told nothing
     at all (WCAG 2.2 SC 4.1.3, and the order of focus in 2.4.3). */
  useEffect(() => {
    if (justSent) {
      said.current?.focus()
    }
  }, [justSent])

  const who = `${me.firstName} ${me.lastName}`

  function send(): void {
    propose({
      queue: 'profiles',
      /* The one queue that holds two sorts, and this is the sort handed back
         with an instruction rather than published. */
      kind: 'photo',
      date: today,
      memberNumber: me.memberNumber,
      who,
      subject: who,
      /* Empty, as every other item on this queue is: it carries a record's id
         where a decision is about a record, and this one is about a person
         (data/types.ts). */
      subjectId: '',
      /* The name of the file and nothing else, which is what the seeded items on
         this queue carry too: a moderator must not be able to tell what came
         from a member from what came from the file (pages/admin/pending.ts). */
      body: chosen,
      currentDate: '',
      proposedDate: '',
      rating: NO_RATING,
      email: '',
      city: '',
      country: '',
    })

    setChosen('')
    setRound((was) => was + 1)
    setJustSent(true)
  }

  return (
    <section className="member__panel" aria-labelledby="settings-picture">
      <h2 className="profile__section" id="settings-picture">
        {t('picture.title')}
      </h2>

      {waiting ? (
            /* Nothing to press while one is waiting: the member has already
               asked, and a second ask gives a moderator two faces and no
               question to answer. */
            <p className="member__note" ref={said} tabIndex={-1} role="status">
              {t('picture.waitingNote')}
            </p>
          ) : (
            <>
              {/* What is true of this portal, rather than a guess at what the
                  member has: there are no photographs on it yet, and the circle
                  beside every name holds initials. */}
              <p className="member__note">{t('picture.none')}</p>

              <RequiredNote />

              <div className="rankings__field rankings__field--wide">
                <AskedLabel id="picture-file">{t('picture.choose')}</AskedLabel>
                <input
                  id="picture-file"
                  key={round}
                  type="file"
                  accept="image/*"
                  aria-required="true"
                  onChange={(event) => {
                    /* Read off the value rather than off `files`. The file list
                       is nullable by type and never null in a browser, and its
                       first entry is empty only when the field was cleared: two
                       fallbacks for one case, neither of which anything walks.
                       The value is a path, and empty when nothing is chosen. */
                    setChosen(event.target.value.replace(/^.*[\\/]/, ''))
                  }}
                />
                <p className="member__note">{t('picture.rule')}</p>
              </div>

              <p className="member__actions">
                {/* Told off rather than switched off, as everywhere else on the
                    portal: `disabled` takes the button out of the tab order and
                    takes the reason it stands for with it. */}
                <button
                  type="button"
                  className="button button--primary"
                  aria-disabled={chosen === ''}
                  aria-describedby={chosen === '' ? 'picture-waits' : undefined}
                  onClick={() => {
                    if (chosen === '') {
                      return
                    }

                    send()
                  }}
                >
                  {t('picture.send')}
                </button>
              </p>

              {chosen === '' && (
                <p id="picture-waits" className="rate__hint" role="status">
                  {t('picture.chooseFirst')}
                </p>
              )}
        </>
      )}
    </section>
  )
}
