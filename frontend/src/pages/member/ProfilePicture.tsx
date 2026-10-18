import { useEffect, useRef, useState } from 'react'
import { CropChooser } from '../../components/CropChooser'
import type { Chosen } from '../../components/CropChooser'
import { Resource } from '../../components/Resource'
import { useI18n } from '../../i18n/useI18n'
import type { Competitor, Crop } from '../../data/types'
import { clearResourceCache } from '../../data/client'
import type { MyPictures } from '../../session/theServer'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  asTheColumnHolds,
  pictureToSend,
  theRowIn,
  THE_PICTURE_GOES_TO,
  WHEN_SENDING_A_PICTURE,
} from './photoWrites'
import { useMyPictures } from './useMyPictures'

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
 * with it.
 *
 * The square is chosen here too, before anything is sent (owner, 12.08.2026), and
 * what was cut away stays visible under it: „da se nazire ispod u njegovim
 * podešavanjima i ono što se neće videti". The same component draws it for the
 * moderator (components/CropWindow.tsx).
 *
 * <h2>THE PICTURE THAT IS ALREADY THERE IS ON THE SCREEN, WITH ITS CIRCLE, AND THE CIRCLE MOVES</h2>
 *
 * <p>Owner, 18.10.2026: „Slika koja je postavljena treba da bude vidljiva sa sve fokus krugom tako da
 * takmicar moze da ga pomera." The decisions behind it are older and were not carried out on this side:
 *
 * <ul>
 * <li>PDL P11, 27.09.2026: „Neka ta recenica stoji u segmentu da se salje slika. Tako da ukoliko udjem da
 * posaljem ponovo, vidim da je trenutno slika u statusu cekanja i tu vidim trenutno azuriranu sliku sa
 * krugom."
 * <li>PDL P11, 27.09.2026: „Ako hocu da pregazim novom ili da pomerim krug da gadja drugi deo slike, opet se
 * salje na verifikaciju i gazi trenutan red kod verifikatora." Both are legal: a new picture over the one
 * that waits, and the same picture with the circle somewhere else.
 * <li>PDL P11, 27.09.2026: „Slika koja čeka se na profilu ne vidi dok nije odobrena." That is the PROFILE;
 * this screen is the one place the waiting picture is shown to the member, and it is shown from his own
 * route (`GET /api/me/photo`, ADL A60), never from the public address.
 * </ul>
 *
 * <p><b>What was measured on 18.10.2026 and is the reason for all of this:</b> `MePhotoApi` has answered
 * `GET /api/me/photo` since 27.09.2026 - the waiting picture, the standing one and a circle for each - and
 * nothing on this side asked it. The waiting picture lived in the SESSION (`pictureSent`), which is a
 * `useState` above the router, so a refresh emptied it and the panel said „Portal još nema fotografije"
 * over a picture that was with a moderator. An approved picture was never drawn here at all. Both are
 * read from the server now, on every visit, and the session is written to only as before, for the
 * moderator's queue.
 *
 * <p><b>The circle over a picture that waits is moved without sending the picture again.</b> The route
 * reads a request with no `picture` part as exactly that (`MePhotoApi.send`, „A SEND WITH NO FILE IS 21c'S
 * SECOND HALF"): same bytes, same digest, same row, and the member's place in the moderator's queue is
 * kept. A circle moved over the picture that STANDS has no row to move it on, so its bytes are fetched
 * from the public address and sent as a new picture with the new circle; the route cannot tell them from
 * a file chosen on his disc, which is right, because to a moderator they are the same thing.
 *
 * <p><b>The picture and the circle are drawn by `CropChooser`, the component a new file is chosen
 * with</b>, so a member moves the circle of the picture that is there with the pointer or the three
 * sliders exactly as he does for one he has just picked, and the smallest circle the portal allows is
 * held by the same code (`components/crop.ts`). The picture that is already there is handed to it as a
 * `Chosen` whose file is `NO_FILE`, a placeholder that never leaves this screen: it is how this screen
 * tells "the circle moved over what is there" from "a file the member chose".
 *
 * <p><b>Two sources of what is on the screen, and the server is the one that decides.</b> What stands is
 * what the server said when the screen was drawn (`origin`), moved by exactly what a send the server
 * accepted put there. A box drawn from anything the screen remembers across a refresh would show the
 * picture before the refresh, which is the fault. `PersonalData.tsx` keeps the same arrangement for the
 * same reason.
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
  const held = useMyPictures(me.memberNumber)

  return (
    <section className="member__panel" aria-labelledby="settings-picture">
      <h2 className="profile__section" id="settings-picture">
        {t('picture.title')}
      </h2>

      <Resource state={held} inline>
        {(pictures) => <ThePicture me={me} pictures={pictures} />}
      </Resource>
    </section>
  )
}

/**
 * The placeholder for "the picture that is already there", handed to the chooser in the place of a file
 * it was given. It is recognised by identity and never sent: a request carrying it would be a picture of
 * nought bytes.
 */
const NO_FILE = new File([], 'the-picture-that-is-already-there')

/** What the server says is on the screen: which of the two it is, where to fetch it, and its circle. */
type Origin = { kind: 'waiting' | 'standing'; photo: string; crop: Crop }

/** The picture that waits if one does, because that is the one a member sent last. */
function originOf(pictures: MyPictures): Origin | null {
  if (pictures.waiting !== null) {
    return { kind: 'waiting', ...pictures.waiting }
  }

  return pictures.standing === null ? null : { kind: 'standing', ...pictures.standing }
}

/** Whether two circles are the same one AS THE COLUMN HOLDS THEM, which is what would be sent. */
function sameCircle(a: Crop, b: Crop): boolean {
  return (
    asTheColumnHolds(a.x) === asTheColumnHolds(b.x) &&
    asTheColumnHolds(a.y) === asTheColumnHolds(b.y) &&
    asTheColumnHolds(a.size) === asTheColumnHolds(b.size)
  )
}

/**
 * The bytes of the picture that stands on the profile, as a file, or nothing where they cannot be had.
 * Needed only to send the same picture again with another circle: nothing waits then, so there is no row
 * to move the circle on.
 */
async function theBytesAt(address: string): Promise<File | null> {
  try {
    const answer = await fetch(address)

    if (!answer.ok) {
      return null
    }

    const bytes = await answer.blob()

    return new File([bytes], 'picture', { type: bytes.type })
  } catch {
    return null
  }
}

function ThePicture({ me, pictures }: { me: Competitor; pictures: MyPictures }) {
  const { t } = useI18n()
  const { sendPicture, pictureSent, decisions } = useSession()
  const [origin, setOrigin] = useState<Origin | null>(() => originOf(pictures))
  /* A NEW FILE the member chose, and the circle he set over it. */
  const [picked, setPicked] = useState<Chosen | null>(null)
  /* THE CIRCLE MOVED OVER THE PICTURE THAT IS ALREADY THERE, or nothing where it has not been touched. */
  const [circle, setCircle] = useState<Crop | null>(null)
  const [justSent, setJustSent] = useState(false)
  /* While the request is out. Two states rather than one, the shape
     `member/ProposeTeam.tsx` already has: the ref is what refuses a second press
     within one render, because state set in a handler is not readable by the next
     press in the same turn, and the flag is what the reader can see. */
  const [sending, setSending] = useState(false)
  const outstanding = useRef(false)
  /* Whatever came back that was not „it is done". Held here and shown under the
     button, never folded into one sentence of our own: the route tells four refusals
     apart on purpose (`photoWrites.ts`), and a screen that said „nešto je puklo"
     hands the reader a button to press again with no idea what to change. */
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  /* THE PICTURE A MODERATOR HAS DECIDED DURING THIS VISIT IS NOT WAITING ANY MORE, and the screen hands
     the control back rather than leaving a member told to wait over a decision that has landed. Only a
     send of this visit can be decided here (`pictureSent` is the session's and names its member), so a
     picture that was already waiting when the screen was drawn is cleared by a refresh, which is how the
     server's own answer reaches it. AND THE KEY IS THE SERVER'S: the moderator decides the row the
     server made, `settle` files it under that row's id, and this reads the same id. */
  const decidedHere =
    origin !== null &&
    origin.kind === 'waiting' &&
    pictureSent !== null &&
    pictureSent.member === me.memberNumber &&
    decisions[pictureSent.row] !== undefined
  const there = decidedHere ? null : origin

  /* WHAT THE CHOOSER DRAWS: the file the member picked, or the picture that is already there with the
     circle wherever he has moved it. */
  const shown: Chosen | null =
    picked ??
    (there === null
      ? null
      : { name: there.photo, picture: there.photo, crop: circle ?? there.crop, file: NO_FILE })
  const moved = there !== null && circle !== null && !sameCircle(circle, there.crop)
  const changed = picked !== null || moved

  /* Said out loud, because the control just pressed is replaced by a sentence:
     without this the focus falls to the body and a screen reader is told nothing
     at all (WCAG 2.2 SC 4.1.3, and the order of focus in 2.4.3). */
  useEffect(() => {
    if (justSent) {
      said.current?.focus()
    }
  }, [justSent])

  /* Which note the button points at, and never one that is not on the screen:
     `aria-describedby` naming an element that is not there is a description a
     screen reader announces as nothing at all, which is worse than none. The two
     cannot both stand - nothing is ever being sent while nothing has changed. */
  const describes = !changed ? 'picture-waits' : sending ? 'picture-sending' : undefined

  /* One handler for the chooser, which tells a file the member chose from the picture that was
     there by the placeholder it was handed. */
  function choose(next: Chosen | null): void {
    if (next === null) {
      setPicked(null)
      setCircle(null)

      return
    }

    if (next.file === NO_FILE) {
      setCircle(next.crop)

      return
    }

    setPicked(next)
    setCircle(null)
  }

  /**
   * Puts the picture in front of a moderator, and says nothing until the server has.
   *
   * <p><b>THE ORDER IS THE WHOLE OF IT.</b> The request goes first and the session
   * overlay is written only inside the arm an answer authorised. Written the other way
   * round - overlay first, request after - the member would be told „čeka odobrenje"
   * over a refusal, the card would stand in the moderator's queue with nothing behind
   * it on the server.
   *
   * <p><b>What is sent is a file and the crop as three fractions written as fine as
   * the column holds</b> (`photoWrites.ts` says why the rounding is not tidying), or the three
   * fractions alone where the circle of a picture that waits has been moved.
   */
  async function send(): Promise<void> {
    const crop = picked !== null ? picked.crop : circle

    if (crop === null || (picked === null && there === null)) {
      return
    }

    outstanding.current = true
    setSending(true)
    setRefusal(null)

    let body: FormData | null

    if (picked !== null) {
      body = pictureToSend(picked.file, crop)
    } else if (there !== null && there.kind === 'waiting') {
      body = pictureToSend(null, crop)
    } else {
      const bytes = await theBytesAt(there === null ? '' : there.photo)

      body = bytes === null ? null : pictureToSend(bytes, crop)
    }

    const answer: Answer =
      body === null ? { got: 'nothing' } : await askTheServer(THE_PICTURE_GOES_TO, body)

    outstanding.current = false
    setSending(false)

    if (answer.got !== 'done') {
      /* The picture stays chosen. A refusal a member can act on - too big, not a
         picture - is one he answers by choosing a different file, and clearing the
         field under him would take away the thing he is being told about. */
      setRefusal(answer)

      return
    }

    const drawn = picked !== null ? picked.picture : there === null ? '' : there.photo

    /* WHAT THE MEMBER IS WAITING ON IS THE ROW THE SERVER MADE, NAMED BY THE KEY IT
       ANSWERED WITH, and `theRowIn` reads that key (`photoWrites.ts`). It is the same key the
       moderator's decision is filed under, which is what lets the mark clear when that decision
       lands. Where the answer names no row the key is the empty string: no decision is ever
       filed under that, so the mark stands for the rest of the visit, which is the direction
       that cannot mislead. */
    sendPicture({
      row: String(theRowIn(answer.body) ?? ''),
      picture: drawn,
      crop,
      /* WHOSE IT IS, so that the next member to sign in during this visit is neither told
         it is his nor shown it (`session/context.ts#PictureSent`). */
      member: me.memberNumber,
    })

    /* SO THAT THE ROW JUST MADE IS ON THE QUEUE THIS VISIT, and not only on the next one.
       `data/client.ts` fetches a resource once per visit, so a moderator who had already
       opened the queue held the list from before this upload and never saw the row at all. */
    clearResourceCache('verification')

    /* AND WHAT STANDS ON THIS SCREEN IS NOW WHAT THE SERVER ACCEPTED: the picture waits, with the
       circle that was sent. The next press measures against that and not against what the screen was
       drawn with. */
    setOrigin({ kind: 'waiting', photo: drawn, crop })
    setPicked(null)
    setCircle(null)
    setJustSent(true)
  }

  return (
    <>
      {there === null ? (
        /* „Portal još nema fotografije, pa u krugu pored tvog imena stoje tvoji inicijali" - a sentence
           about THIS MEMBER and not about the portal, so it is asked of what the server says he has. */
        <p className="member__note">{t('picture.none')}</p>
      ) : (
        <>
          <p
            className="member__note"
            ref={said}
            tabIndex={-1}
            role={justSent ? 'status' : undefined}
          >
            {there.kind === 'waiting' ? t('picture.waitingNote') : t('picture.standingNote')}
          </p>
          <p className="member__note">
            {there.kind === 'waiting' ? t('picture.waitingMove') : t('picture.standingMove')}
          </p>
        </>
      )}

      <CropChooser
        id="picture-file"
        label={t('picture.choose')}
        alt={
          picked !== null
            ? t('picture.chosenAlt')
            : there !== null && there.kind === 'waiting'
              ? t('picture.sentAlt')
              : t('picture.currentAlt')
        }
        chosen={shown}
        onChange={choose}
      />

      <p className="member__actions">
        {/* Told off rather than switched off, as everywhere else on the
            portal: `disabled` takes the button out of the tab order and
            takes the reason it stands for with it. Which is why the second
            press is refused in the handler as well, off a ref: `aria-disabled`
            is a thing said to a reader and not a thing the browser enforces. */}
        <button
          type="button"
          className="button button--primary"
          aria-disabled={!changed || sending}
          aria-describedby={describes}
          onClick={() => {
            if (!changed || outstanding.current) {
              return
            }

            void send()
          }}
        >
          {t('picture.send')}
        </button>
      </p>

      {!changed && (
        <p id="picture-waits" className="rate__hint" role="status">
          {there === null ? t('picture.chooseFirst') : t('picture.moveFirst')}
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
      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_SENDING_A_PICTURE} />}
    </>
  )
}
