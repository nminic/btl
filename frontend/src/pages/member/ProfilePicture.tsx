import { useEffect, useRef, useState } from 'react'
import { useToday } from '../../clock/useClock'
import { RequiredNote } from '../../forms/AskedLabel'
import { CropChooser } from '../../components/CropChooser'
import type { Chosen } from '../../components/CropChooser'
import { CropWindow } from '../../components/CropWindow'
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
 * The square is chosen here too, before anything is sent (owner, 12.08.2026),
 * and what was cut away stays visible under it: „da se nazire ispod u njegovim
 * podešavanjima i ono što se neće videti". So a member who sent the wrong half
 * of a photograph can see that they did, and so can the moderator looking at
 * the very same drawing (components/CropWindow.tsx).
 *
 * **What the prototype cannot do yet, written here rather than implied.** No
 * member record carries a picture: `Competitor` has no such field, which is
 * exactly why a circle on this portal holds initials
 * (components/Portrait.tsx). So this screen sends a picture for review and says
 * where it has got to, and taking one down arrives with the pictures
 * themselves, in F5. The first version of this file offered „Ukloni sliku" and
 * set a flag inside itself: nobody saw the picture go, nothing remembered it
 * past the screen, and the panel could say „Nemaš sliku" and „čeka odobrenje"
 * in the same breath. A control that does nothing is worse than one that is not
 * there.
 */
export function ProfilePicture({ me }: { me: Competitor }) {
  const { t } = useI18n()
  const { propose, proposals, decisions } = useSession()
  const today = useToday()
  const [chosen, setChosen] = useState<Chosen | null>(null)
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
     is one question about one member, and until then a member who sends a
     second picture across two visits gives the moderator two cards. Written
     down rather than left to be discovered (PENDING, and PDL P22).
   *
     Decisions are read all the same, so approving a picture during this visit
     hands the control straight back rather than leaving somebody told to wait
     with no way out. */
  const waiting = proposals.find(
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

  function send(picture: Chosen): void {
    propose({
      queue: 'profiles',
      /* The one queue that holds two sorts. Both go back to the member when
         they are refused (PDL P22, 06.08.2026); what differs is what the
         moderator writes, since a picture is changed by an instruction precise
         enough to work from and a text is written again. This comment said
         „rather than published" until 15.08.2026, which was the withdrawn rule
         and outlived it by nine days. */
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
      body: picture.name,
      picture: picture.picture,
      crop: picture.crop,
      currentDate: '',
      proposedDate: '',
      rating: NO_RATING,
      email: '',
      city: '',
      country: '',
    })

    setChosen(null)
    setJustSent(true)
  }

  return (
    <section className="member__panel" aria-labelledby="settings-picture">
      <h2 className="profile__section" id="settings-picture">
        {t('picture.title')}
      </h2>

      {waiting === undefined ? (
        <>
          {/* What is true of this portal, rather than a guess at what the
              member has: there are no photographs on it yet, and the circle
              beside every name holds initials. */}
          <p className="member__note">{t('picture.none')}</p>

          <RequiredNote />

          <CropChooser
            id="picture-file"
            label={t('picture.choose')}
            rule={t('picture.rule')}
            alt={t('picture.chosenAlt')}
            chosen={chosen}
            onChange={setChosen}
          />

          <p className="member__actions">
            {/* Told off rather than switched off, as everywhere else on the
                portal: `disabled` takes the button out of the tab order and
                takes the reason it stands for with it. */}
            <button
              type="button"
              className="button button--primary"
              aria-disabled={chosen === null}
              aria-describedby={chosen === null ? 'picture-waits' : undefined}
              onClick={() => {
                if (chosen === null) {
                  return
                }

                send(chosen)
              }}
            >
              {t('picture.send')}
            </button>
          </p>

          {chosen === null && (
            <p id="picture-waits" className="rate__hint" role="status">
              {t('picture.chooseFirst')}
            </p>
          )}
        </>
      ) : (
        <>
          {/* Nothing to press while one is waiting: the member has already
              asked, and a second ask gives a moderator two faces and no
              question to answer. */}
          <p className="member__note" ref={said} tabIndex={-1} role="status">
            {t('picture.waitingNote')}
          </p>

          {/* What was sent, cut where the member cut it and with the rest still
              showing under the shade. This is the „nazire se ispod" half of the
              12.08.2026 note, and it is the same component the moderator reads
              the picture through.

              Drawn only where there is a picture behind it. An item seeded into
              the mock file stands for one sent before this visit, and there is
              nowhere it could have been kept; an empty frame would say the
              picture had been lost rather than that it was never here. */}
          {waiting.picture !== '' && (
            <CropWindow picture={waiting.picture} crop={waiting.crop} alt={t('picture.sentAlt')} />
          )}
        </>
      )}
    </section>
  )
}
