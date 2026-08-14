import { useState } from 'react'
import { useToday } from '../../clock/useClock'
import { AskedLabel } from '../../forms/AskedLabel'
import { useI18n } from '../../i18n/useI18n'
import { NO_RATING } from '../../data/types'
import type { Competitor } from '../../data/types'
import { useSession } from '../../session/useSession'

/**
 * Changing or removing the picture on a profile, after joining.
 *
 * Owner, 12.08.2026: „Članovi treba da imaju mogućnost da promene ili obrišu
 * fotografiju naknadno tokom korišćenja sajta. Tad se samo fotografija šalje na
 * odobrenje Adminu ili moderatoru sa adekvatnim pravima."
 *
 * Only the picture goes, and that is the whole point of putting it here rather
 * than behind an edit of the profile: a member who wants a better photograph
 * should not have their biography, their town and their shirt size sent back
 * through a queue with it. The racing profile queue already holds the two apart
 * (`kind` in data/types.ts), because the decision over them is not the same one:
 * a text is edited and published, a picture is accepted or handed back with an
 * instruction telling the member what to change.
 *
 * Removing is not a decision anybody else makes. A member taking their own face
 * off the portal is not asking for anything, so nothing is queued: it goes, and
 * the circle holds their initials again, which is what it holds for everybody
 * who never sent one (components/Portrait.tsx).
 */
export function ProfilePicture({ me }: { me: Competitor }) {
  const { t } = useI18n()
  const { propose, proposals } = useSession()
  const today = useToday()
  const [chosen, setChosen] = useState('')
  const [gone, setGone] = useState(false)
  /* Bumped to empty the file field, which is emptied by being drawn again
     rather than by reaching into it. A file input cannot be given a value,
     so the usual way is a ref and `field.current.value = ""`, and a ref that
     is only ever set writes a branch for a case that cannot happen. */
  const [round, setRound] = useState(0)

  /* One waiting picture at a time, counting what was already in the queue as
     well as what was sent during this visit: a member who sends a second while
     the first is undecided gives the moderator two pictures of one person and no
     way to know which one the member meant. */
  const waiting = proposals.some(
    (one) => one.queue === 'profiles' && one.kind === 'photo' && one.memberNumber === me.memberNumber,
  )

  const who = `${me.firstName} ${me.lastName}`

  function send(): void {
    propose({
      queue: 'profiles',
      /* The one queue that holds two sorts, and this is the sort that is handed
         back with an instruction rather than edited and published. */
      kind: 'photo',
      date: today,
      memberNumber: me.memberNumber,
      who,
      subject: who,
      subjectId: me.memberNumber,
      body: t('picture.forReview', { name: chosen }),
      currentDate: '',
      proposedDate: '',
      rating: NO_RATING,
      email: '',
      city: '',
      country: '',
    })

    setChosen('')
  }

  return (
    <section className="member__panel" aria-labelledby="settings-picture">
      <h2 className="profile__section" id="settings-picture">
        {t('picture.title')}
      </h2>

      {/* What is on the portal right now, said in words rather than shown: the
          circle beside the name on every screen already shows it, and a second
          copy here would be one more place to keep in step. */}
      <p className="member__note">
        {gone ? t('picture.none') : t(waiting ? 'picture.waiting' : 'picture.onPortal')}
      </p>

      {waiting ? (
        /* Nothing to press while one is waiting: the member has already asked,
           and a second ask is what gives a moderator two faces and no question. */
        <p className="member__note">{t('picture.waitingNote')}</p>
      ) : (
        <>
          <div className="rankings__field rankings__field--wide">
            <AskedLabel id="picture-file" asked={false}>
              {t('picture.choose')}
            </AskedLabel>
            <input
              id="picture-file"
              key={round}
              type="file"
              accept="image/*"
              onChange={(event) => {
                /* Read off the value rather than off `files`. The file list is
                   nullable by type and never null in a browser, and asking for
                   the first of it is empty only when the field was cleared: two
                   fallbacks for one case, neither of which anything walks. The
                   value is a path and is the empty string when nothing is
                   chosen, so the name falls out of it with no branch at all. */
                setChosen(event.target.value.replace(/^.*[\\\\/]/, ''))
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

            {!gone && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setGone(true)
                  setChosen('')
                  setRound((was) => was + 1)
                }}
              >
                {t('picture.remove')}
              </button>
            )}
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
