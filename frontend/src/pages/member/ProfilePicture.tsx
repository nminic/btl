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
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { pictureToSend, THE_PICTURE_GOES_TO, WHEN_SENDING_A_PICTURE } from './photoWrites'

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
 * **THE PICTURE GOES TO THE SERVER SINCE 26.09.2026, AND UNTIL THEN IT WENT
 * NOWHERE AT ALL.** `send` wrote into the session overlay and stopped there, and
 * `POST /api/me/photo` had existed the whole time: measured on this side the day
 * the branch was opened, `grep -rn "me/photo" frontend/src` answered with nothing,
 * tests included. **Reported alongside it, and it is somebody else's measurement
 * rather than one made here:** the QA database held nought rows in `photo` and
 * nought in the verification queue, after the owner had chosen a photograph of his
 * own and approved it. Whose measurement each half is matters, because a sentence
 * in a comment is read as a fact by everybody after it. This is the first of the
 * four links in that chain and the only one that had no code at all.
 *
 * **The session is still written, and ONLY inside the branch an answer authorised.**
 * The moderator's queue is still drawn out of the portal's own overlay, so the card
 * has to appear there for the flow to be walkable end to end; what changed is that
 * it appears because the server said the picture arrived, never because a button was
 * pressed. That is the arrangement `admin/AdminModerators.tsx` already keeps for its
 * ticks, and the case that holds it here does what `AdminModerators.test.tsx` does
 * for that one: it reads the request that was really made, off a recording server,
 * because the panel would look identical either way.
 *
 * **TAKING A PICTURE DOWN IS NOT ON THIS SCREEN, AND THAT IS A DECISION OF THE
 * OWNER'S RATHER THAN WORK LEFT UNDONE.** `DELETE /api/me/photo` exists
 * (`MePhotoApi.remove`) and the right is his from 12.08.2026 - „Članovi treba da
 * imaju mogućnost da promene ili obrišu fotografiju naknadno" - but the control came
 * off this screen on 15.08.2026 for a reason that has not changed yet, and PDL P11
 * records it in these words: nobody saw the picture go, nothing remembered it past
 * the screen, „a panel je umeo da u istom dahu kaže ,Nemaš sliku' i ,čeka
 * odobrenje'", and **„Kontrola koja ništa ne radi je gora nego da je nema."**
 *
 * **What held it shut was one measured fact, and that fact fell on 27.09.2026:**
 * `Competitor` carried no picture, so this screen could not know whether one was
 * standing when it drew. It carries `photo` now (`data/types.ts`), served since
 * 26.09.2026, and this screen is handed the member's own record - so the thing that
 * was missing is here.
 *
 * **The control still does not come back, and that is now a DECISION rather than a
 * limit.** The branch that taught the type was scoped to the circle: „srednje i niske
 * ne diraj" is the standing rule, and a control is neither. What „Ukloni sliku" should
 * do is a product question with more than one answer - whether removing is itself a
 * thing a moderator approves, what a member sees between pressing and the removal
 * taking effect, and what happens to a picture already waiting - and PDL P11 records
 * that the last attempt failed precisely by answering those badly. `DELETE /api/me/photo`
 * exists and waits (`MePhotoApi.remove`); what is missing is the owner's sentence, not
 * the field.
 *
 * What this branch did change here is the one sentence that had become false: the panel
 * no longer tells a member the portal has no photograph when his own is on the screen.
 */
export function ProfilePicture({ me }: { me: Competitor }) {
  const { t } = useI18n()
  const { propose, proposals, decisions } = useSession()
  const today = useToday()
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [justSent, setJustSent] = useState(false)
  /* While the request is out. Two states rather than one, the shape
     `member/ProposeTeam.tsx` already has: the ref is what refuses a second press
     within one render, because state set in a handler is not readable by the next
     press in the same turn, and the flag is what the reader can see. */
  const [sending, setSending] = useState(false)
  const outstanding = useRef(false)
  /* Whatever came back that was not „it is done". Held here and shown under the
     button, never folded into one sentence of our own: the route tells five refusals
     apart on purpose (`photoWrites.ts`), and a screen that said „nešto je puklo"
     hands the reader a button to press again with no idea what to change. */
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  /* The one waiting picture, and only the one sent during this visit.
   *
     A review asked why an earlier visit is not counted, and the answer is that
     the only place it is written is `verification.json`, the whole queue: names
     and postal addresses of people who are not members yet, and the words of
     comments nobody has approved. Reading it here downloads all of that into a
     member`s browser, which a standing guard refuses by name
     (pages/publicData.test.tsx). Privacy beats the nicety: with a database this
     is one question about one member, and until then the cost is the member's
     own, on a second visit, and not the moderator's as this paragraph claimed
     until a review of PR 381 (27.09.2026) measured it.

     `proposals` lives in `useState` (session/SessionProvider.tsx), so it is gone
     the moment the tab is reloaded while the row this screen cannot see is still
     open on the server. A member who comes back to a picture still waiting is
     met by `picture.none` - „Portal još nema fotografije" - exactly as if he had
     sent nothing, sends again, and is refused `aPictureAlreadyWaits`, 409.
     Neither half of PDL.md:7582 holds for him then: he is not shown his own
     picture under its waiting mark, and the reason that decision gives for
     itself, spelt there without diacritics - „da zna da je slanje uspelo i da je
     ne salje tri puta" - is exactly what fails: nothing here stops him from
     sending again, which is the very thing that sentence exists to prevent. It
     is the shape PDL P11 already rejected once, a screen that in one breath told
     a member nothing was there and in the next that something already was
     (PDL.md:1659, over the withdrawn „Ukloni sliku"); this is that shape again,
     by a different road. Written down rather than left to be discovered
     (PENDING, and PDL P22).
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

  /* Which note the button points at, and never one that is not on the screen:
     `aria-describedby` naming an element that is not there is a description a
     screen reader announces as nothing at all, which is worse than none. The two
     cannot both stand - nothing is ever being sent while nothing is chosen, since
     `send` is only ever called with a picture and the field is cleared only once
     the server has answered - so one name is enough. */
  const describes = chosen === null ? 'picture-waits' : sending ? 'picture-sending' : undefined

  /**
   * Puts the picture in front of a moderator, and says nothing until the server has.
   *
   * <p><b>THE ORDER IS THE WHOLE OF IT.</b> The request goes first and the session
   * overlay is written only inside the arm an answer authorised. Written the other way
   * round - overlay first, request after - the member would be told „čeka odobrenje"
   * over a refusal, the card would stand in the moderator's queue with nothing behind
   * it on the server, and a second picture would then be refused 409 by a route holding
   * nothing. That is not a hypothetical: it is the state this screen was in until
   * 26.09.2026, less the request.
   *
   * <p><b>What is sent is the FILE, and the crop as three fractions written as fine as
   * the column holds.</b> `photoWrites.ts` says why the rounding is not tidying: a
   * single press of an arrow on the size slider gives seventeen decimal places, and
   * `MePhotoApi` refuses anything finer than eight rather than rounding it.
   */
  async function send(picture: Chosen): Promise<void> {
    outstanding.current = true
    setSending(true)
    setRefusal(null)

    const answer = await askTheServer(
      THE_PICTURE_GOES_TO,
      pictureToSend(picture.file, picture.crop),
    )

    outstanding.current = false
    setSending(false)

    if (answer.got !== 'done') {
      /* The picture stays chosen. A refusal a member can act on - too big, not a
         picture, one already waiting - is one he answers by choosing a different file
         or by waiting, and clearing the field under him would take away the thing he
         is being told about. */
      setRefusal(answer)

      return
    }

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
          {/* „Portal još nema fotografije, pa u krugu pored tvog imena stoje tvoji
              inicijali" - WHICH IS NOW A SENTENCE ABOUT THIS MEMBER AND NOT ABOUT THE
              PORTAL, so it is asked of his own record.

              It was true of the portal itself until 26.09.2026 and needed no condition:
              no record carried a picture at all. `/api/competitors` answers `photo`
              since then (PDL P28f) and every circle draws it, so for a member whose
              portrait was approved this panel would tell him the portal has no
              photograph while his own looks back at him from the header of the same
              page. That is the shape PDL P11 rejected once already, over the withdrawn
              „Ukloni sliku": a screen that „u istom dahu kaže ,Nemaš sliku' i ,čeka
              odobrenje'".

              **Said or not said, rather than said differently**, and that is a boundary
              rather than a preference: a second sentence is a new line in the dictionary
              and in the English one beside it, and what it should say to a member who
              already has a picture is the owner's to write, not this branch's to invent.
              He is not left guessing in the meantime - the circle with his own face in
              it is on this very screen, in the header - and „Izaberi novu sliku" under
              it already reads as it should for somebody who has one. */}
          {me.photo === null && <p className="member__note">{t('picture.none')}</p>}

          <RequiredNote />

          <CropChooser
            id="picture-file"
            label={t('picture.choose')}
            alt={t('picture.chosenAlt')}
            chosen={chosen}
            onChange={setChosen}
          />

          <p className="member__actions">
            {/* Told off rather than switched off, as everywhere else on the
                portal: `disabled` takes the button out of the tab order and
                takes the reason it stands for with it. Which is why the second
                press is refused in the handler as well, off a ref: `aria-disabled`
                is a thing said to a reader and not a thing the browser enforces,
                so without the ref a member who presses twice puts two pictures in
                front of a moderator, and the route answers the second 409. */}
            <button
              type="button"
              className="button button--primary"
              aria-disabled={chosen === null || sending}
              aria-describedby={describes}
              onClick={() => {
                if (chosen === null || outstanding.current) {
                  return
                }

                void send(chosen)
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

          {/* Said out loud while the picture is on its way, because a press that
              changes nothing visible is a press a reader by ear cannot tell from
              one that did not land. Five megabytes over a telephone connection is
              long enough to matter. */}
          {sending && (
            <p id="picture-sending" className="rate__hint" role="status">
              {t('picture.sending')}
            </p>
          )}

          {/* What the server said, in its own reason's words. Under the control it
              answers, so the sentence and the button a member presses again are in
              one place. */}
          {refusal !== null && (
            <ServerSaid answer={refusal} refusals={WHEN_SENDING_A_PICTURE} />
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
