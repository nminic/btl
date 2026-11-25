import { useCallback, useEffect, useRef, useState } from 'react'
import { CropChooser, type Chosen } from '../../components/CropChooser'
import type { Crop } from '../../components/crop'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import type { Team } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { whatTheServerSaysOfThePicturesAt, type MyPictures } from '../../session/theServer'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { DeleteSheet } from '../admin/DeleteSheet'
import { asTheColumnHolds, pictureToSend } from './photoWrites'
import { A_WAITING_LOGO_IS_NAMED_BY, ourLogoAt, theWaitingLogoAddressIn, WHEN_SENDING_A_TEAMS_LOGO } from './teamLogoWrites'
import { useHeldRead } from './useHeldRead'

/**
 * THE TEAM'S LOGO, SENT FOR APPROVAL BY THE MEMBER WHO RUNS THE TEAM, ON THE PAGE „IZMENI TIM”, IN A BOX OF ITS OWN.
 *
 * Owner, PDL 25.11.2026, „Urednik tima postavlja znak tima slikom”: „Isti oblik secenja krugom”, and the answers of
 * the same day („Logo tima, pitanja iz plana”): the box is on „Izmeni tim”, apart from the form; the logo the
 * editor sends waits for a moderator and is not seen until it is approved; and he may take the logo that stands
 * down, at once and with no approval.
 *
 * **The shape is the member's own picture** (`member/ProfilePicture.tsx`), copied with its guards, because the
 * owner asked for the circle to work the same in every place (PDL 24.11.2026, „Podešavanje kruga na slici radi
 * identično na svakom mestu portala”): the logo that waits is drawn with its circle and a note that it waits; a
 * circle moved over it is sent alone, naming the picture it was drawn over; a circle moved over the logo that
 * STANDS is sent as that picture's own bytes with the new circle, because nothing waits to move it on; and the
 * picture and the circle are chosen with `CropChooser`, the chooser every picture of the portal is chosen with.
 */
export function TeamLogo({ team }: { team: Team }) {
  const { t } = useI18n()
  const read = useCallback(() => whatTheServerSaysOfThePicturesAt(ourLogoAt(team.id), A_WAITING_LOGO_IS_NAMED_BY), [team.id])
  const held = useHeldRead(read, team.id, 'The logo of the team could not be read')

  return (
    <section className="member__panel" aria-labelledby="team-logo">
      <h2 className="profile__section" id="team-logo">
        {t('teamLogo.title')}
      </h2>

      <Resource state={held} inline>
        {(pictures) => <TheLogo team={team} pictures={pictures} />}
      </Resource>
    </section>
  )
}

/** The placeholder for „the logo that is already there”, recognised by identity and never sent. */
const NO_FILE = new File([], 'the-logo-that-is-already-there')

/** What the server says is on the screen: which of the two it is, where to fetch it, its circle, and the address
 *  the logo that waits is named by, which a circle moved over it is sent over. */
type Origin = { kind: 'waiting' | 'standing'; photo: string; crop: Crop; named: string | null }

function originOf(pictures: MyPictures): Origin | null {
  if (pictures.waiting !== null) {
    return { kind: 'waiting', ...pictures.waiting, named: pictures.waiting.photo }
  }

  return pictures.standing === null ? null : { kind: 'standing', ...pictures.standing, named: null }
}

function sameCircle(a: Crop, b: Crop): boolean {
  return (
    asTheColumnHolds(a.x) === asTheColumnHolds(b.x) &&
    asTheColumnHolds(a.y) === asTheColumnHolds(b.y) &&
    asTheColumnHolds(a.size) === asTheColumnHolds(b.size)
  )
}

/** What a press would send, or nothing where nothing has changed (`ProfilePicture.planOf`, for its reasons). */
type Plan =
  | { how: 'file'; file: File; crop: Crop; drawn: string }
  | { how: 'circle'; crop: Crop; drawn: string; over: string | null }
  | { how: 'again'; crop: Crop; drawn: string }

function planOf(picked: Chosen | null, there: Origin | null, circle: Crop | null): Plan | null {
  if (picked !== null) {
    return { how: 'file', file: picked.file, crop: picked.crop, drawn: picked.picture }
  }

  if (there === null || circle === null || sameCircle(circle, there.crop)) {
    return null
  }

  return there.kind === 'waiting'
    ? { how: 'circle', crop: circle, drawn: there.photo, over: there.named }
    : { how: 'again', crop: circle, drawn: there.photo }
}

/** The bytes of the logo that stands, as a file, or nothing where they cannot be had. */
async function theBytesAt(address: string): Promise<File | null> {
  try {
    const answer = await fetch(address)

    if (!answer.ok) {
      return null
    }

    const bytes = await answer.blob()

    return new File([bytes], 'logo', { type: bytes.type })
  } catch {
    return null
  }
}

function TheLogo({ team, pictures }: { team: Team; pictures: MyPictures }) {
  const { t } = useI18n()
  const [origin, setOrigin] = useState<Origin | null>(() => originOf(pictures))
  /* WHETHER A LOGO STANDS on the team, which is what taking it down is offered over. Kept apart from `origin`, which
     shows the logo that waits when one does. */
  const [stands, setStands] = useState(pictures.standing !== null)
  const [picked, setPicked] = useState<Chosen | null>(null)
  const [circle, setCircle] = useState<Crop | null>(null)
  const [said, setSaid] = useState<'sent' | 'removed' | null>(null)
  const [sending, setSending] = useState(false)
  const outstanding = useRef(false)
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const sentence = useRef<HTMLParagraphElement>(null)

  const there = origin
  const shown: Chosen | null =
    picked ?? (there === null ? null : { name: there.photo, picture: there.photo, crop: circle ?? there.crop, file: NO_FILE })
  const plan = planOf(picked, there, circle)

  useEffect(() => {
    if (said !== null) {
      sentence.current?.focus()
    }
  }, [said])

  function choose(next: Chosen | null): void {
    setSaid(null)

    if (next === null) {
      setPicked(null)

      return
    }

    if (next.file === NO_FILE) {
      setCircle(next.crop)

      return
    }

    setPicked(next)
    setCircle(null)
  }

  async function send(what: Plan): Promise<void> {
    outstanding.current = true
    setSending(true)
    setRefusal(null)
    setSaid(null)

    let body: FormData | null

    if (what.how === 'file') {
      body = pictureToSend(what.file, what.crop)
    } else if (what.how === 'circle') {
      body = pictureToSend(null, what.crop, what.over)
    } else {
      const bytes = await theBytesAt(what.drawn)

      body = bytes === null ? null : pictureToSend(bytes, what.crop)
    }

    const answer: Answer = body === null ? { got: 'nothing' } : await askTheServer(ourLogoAt(team.id), body)

    outstanding.current = false
    setSending(false)

    if (answer.got !== 'done') {
      setRefusal(answer)

      return
    }

    /* The card is on the moderator's queue in this visit too (`data/client.ts` fetches a resource once). */
    clearResourceCache('verification')
    setOrigin({ kind: 'waiting', photo: what.drawn, crop: what.crop, named: theWaitingLogoAddressIn(answer.body) })
    setPicked(null)
    setCircle(null)
    setSaid('sent')
  }

  /* TAKEN DOWN AT ONCE (owner, 25.11.2026); the sheet waits for the answer (`DeleteSheet`). What waits stays. */
  async function takeDown(): Promise<void> {
    setRefusal(null)
    setSaid(null)

    const answered = await askTheServer(ourLogoAt(team.id), {}, 'DELETE')

    if (answered.got !== 'done') {
      setRefusal(answered)

      return
    }

    clearResourceCache('teams')
    setStands(false)
    setOrigin((was) => (was !== null && was.kind === 'standing' ? null : was))
    setSaid('removed')
  }

  return (
    <>
      {there === null ? (
        <p className="member__note">{t('teamLogo.none')}</p>
      ) : (
        <>
          <p className="member__note">{t(there.kind === 'waiting' ? 'teamLogo.waitingNote' : 'teamLogo.standingNote')}</p>
          <p className="member__note">{t(there.kind === 'waiting' ? 'teamLogo.waitingMove' : 'teamLogo.standingMove')}</p>
        </>
      )}

      <CropChooser
        id="team-logo-file"
        label={t('teamLogo.choose')}
        asked={false}
        unmarked
        alt={
          picked !== null
            ? t('teamLogo.chosenAlt')
            : there !== null && there.kind === 'waiting'
              ? t('teamLogo.sentAlt')
              : t('teamLogo.currentAlt')
        }
        chosen={shown}
        onChange={choose}
      />

      <p className="member__actions">
        <button
          type="button"
          className="button button--primary"
          aria-disabled={plan === null || sending}
          aria-describedby={sending ? 'team-logo-sending' : undefined}
          onClick={() => {
            if (plan === null || outstanding.current) {
              return
            }

            void send(plan)
          }}
        >
          {t('teamLogo.send')}
        </button>
        {stands && (
          <DeleteSheet
            name={t('teamLogo.title')}
            opener={t('teamLogo.remove')}
            asks={t('teamLogo.removeAsks')}
            look="button button--secondary"
            onDelete={takeDown}
          />
        )}
      </p>

      {sending && (
        <p id="team-logo-sending" className="rate__hint" role="status">
          {t('teamLogo.sending')}
        </p>
      )}
      {said !== null && (
        <p className="member__note" ref={sentence} tabIndex={-1} role="status">
          {t(said === 'sent' ? 'teamLogo.sent' : 'teamLogo.removed')}
        </p>
      )}
      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_SENDING_A_TEAMS_LOGO} />}
    </>
  )
}
