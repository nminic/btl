import { useEffect, useRef, useState } from 'react'
import { CropChooser, type Chosen } from '../../components/CropChooser'
import { clearResourceCache } from '../../data/client'
import type { Competitor } from '../../data/types'
import { AskedLabel } from '../../forms/AskedLabel'
import { LongBox } from '../../forms/LongBox'
import { profil } from '../../forms/definitions'
import { limitOf } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { WHEN_CHANGING_MY_DATA } from '../member/myAccount'
import { pictureToSend, WHEN_SENDING_A_PICTURE } from '../member/photoWrites'
import { THE_PICTURE_AND_THE_WORDS } from './finishTheProfile'

/** Where the administration sends the picture and the words of the member the address names. */
function addressOfHis(memberNumber: string, what: 'photo' | 'bio'): string {
  return `/api/members/${memberNumber}/${what}`
}

/**
 * THE MEMBER'S PICTURE AND HIS WORDS ABOUT HIMSELF, CHANGED BY THE ADMINISTRATION ON HIS CARD „PODACI".
 *
 * <p>Owner, 06.11.2026 (PDL „Boksovi „Profilna slika" i „Tekst o sebi" prelaze sa Podešavanja"):
 * „Administracija na tuđoj kartici Podaci sme i da menja članovu sliku i tekst o sebi", and „Izmena
 * administracije stupa odmah na profil, bez reda za proveru, i član dobija poruku u sanduče". So the
 * buttons save rather than send for a decision, and the sentence after a save says both halves.
 *
 * <p><b>What it starts from is what stands on his profile</b>, off the record the head of the card is
 * drawn from, and nothing of his that waits: a waiting picture is served to the member who sent it and to
 * the moderator deciding it, through two named routes, and to nobody else (PDL 27.09.2026, „Slika koja
 * čeka se na profilu ne vidi dok nije odobrena", and ADL A60). That is the assistant's reading, offered to
 * the owner with the work.
 *
 * <p><b>Uz „Izaberi novu sliku" ne stoji nikakva oznaka</b> (owner, same decision): the chooser is told
 * the picture is not asked for, which is what draws no mark beside its label.
 */
export function TheMembersPictureAndWords({ competitor }: { competitor: Competitor }) {
  return (
    <div id={THE_PICTURE_AND_THE_WORDS} className="member__pair member__row">
      <HisPicture competitor={competitor} />
      <HisWords key={competitor.memberNumber} competitor={competitor} />
    </div>
  )
}

/** The picture that stands on his profile, as the chooser draws one it was handed. */
function standingOf(competitor: Competitor): Chosen | null {
  return competitor.photo === null || competitor.crop === null
    ? null
    : {
        name: competitor.photo,
        picture: competitor.photo,
        crop: competitor.crop,
        file: NOTHING_CHOSEN,
      }
}

/** Handed to the chooser in the place of a file for the picture that stands, and never sent. */
const NOTHING_CHOSEN = new File([], 'the-picture-that-stands')

function HisPicture({ competitor }: { competitor: Competitor }) {
  const { t } = useI18n()
  const [standing, setStanding] = useState<Chosen | null>(() => standingOf(competitor))
  const [picked, setPicked] = useState<Chosen | null>(null)
  const [sending, setSending] = useState(false)
  const outstanding = useRef(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const said = useRef<HTMLParagraphElement>(null)
  const saved = answer?.got === 'done'

  useEffect(() => {
    if (saved) {
      said.current?.focus()
    }
  }, [saved])

  async function save(chosen: Chosen): Promise<void> {
    outstanding.current = true
    setSending(true)
    setAnswer(null)

    const answered = await askTheServer(addressOfHis(competitor.memberNumber, 'photo'), pictureToSend(chosen.file, chosen.crop))

    outstanding.current = false
    setSending(false)
    setAnswer(answered)

    if (answered.got !== 'done') {
      return
    }

    /* WHAT STANDS IS NOW WHAT WAS SAVED, and the list every circle of his is drawn from is no longer
       true: it carries `photo` on his row. */
    clearResourceCache('competitors')
    setStanding({ ...chosen, file: NOTHING_CHOSEN })
    setPicked(null)
  }

  return (
    <section className="member__panel" aria-labelledby="their-picture">
      <h2 className="profile__section" id="their-picture">
        {t('picture.title')}
      </h2>

      <p className="member__note">{t(standing === null ? 'theirBoxes.pictureNone' : 'theirBoxes.pictureStanding')}</p>
      <p className="member__note">{t('theirBoxes.atOnce')}</p>

      <CropChooser
        id="their-picture-file"
        label={t('picture.choose')}
        asked={false}
        unmarked
        alt={picked !== null ? t('picture.chosenAlt') : t('theirBoxes.currentAlt')}
        chosen={picked ?? standing}
        onChange={(next) => {
          setAnswer(null)
          /* A circle moved over the picture that stands, with no new file, is not taken: the administration
             sets a picture, and moving his own circle is the member's (his send of the same picture with
             another circle goes to the queue). */
          setPicked(next === null || next.file === NOTHING_CHOSEN ? null : next)
        }}
      />

      <p className="member__actions">
        <button
          type="button"
          className="button button--primary"
          aria-disabled={picked === null || sending}
          onClick={() => {
            if (picked === null || outstanding.current) {
              return
            }

            void save(picked)
          }}
        >
          {t('theirBoxes.pictureSave')}
        </button>
      </p>

      {saved && (
        <p className="member__note" ref={said} tabIndex={-1} role="status">
          {t('theirBoxes.saved')}
        </p>
      )}
      {answer !== null && answer.got !== 'done' && <ServerSaid answer={answer} refusals={WHEN_SENDING_A_PICTURE} />}
    </section>
  )
}

function HisWords({ competitor }: { competitor: Competitor }) {
  const { t } = useI18n()
  const [standing, setStanding] = useState(competitor.bio ?? '')
  const [written, setWritten] = useState(competitor.bio ?? '')
  const [sending, setSending] = useState(false)
  const outstanding = useRef(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const said = useRef<HTMLParagraphElement>(null)
  const saved = answer?.got === 'done'
  const same = written.trim() === standing.trim()

  useEffect(() => {
    if (saved) {
      said.current?.focus()
    }
  }, [saved])

  async function save(): Promise<void> {
    outstanding.current = true
    setSending(true)
    setAnswer(null)

    const asked = written.trim()
    const answered = await askTheServer(addressOfHis(competitor.memberNumber, 'bio'), { bio: asked }, 'PUT')

    outstanding.current = false
    setSending(false)
    setAnswer(answered)

    if (answered.got !== 'done') {
      return
    }

    /* `competitor.bio` is on every row of the public list, which is therefore no longer true. */
    clearResourceCache('competitors')
    setStanding(asked)
    setWritten(asked)
  }

  return (
    <section className="member__panel" aria-labelledby="their-bio">
      <h2 className="profile__section" id="their-bio">
        {t('bio.title')}
      </h2>

      <p className="member__note">{t('theirBoxes.atOnce')}</p>

      <div className="rankings__field rankings__field--wide">
        <AskedLabel id="their-bio-box" asked={false}>
          {t('profile.bio')}
        </AskedLabel>
        <LongBox
          id="their-bio-box"
          value={written}
          maxLength={limitOf(profil, 'bio')}
          leftId="their-bio-left"
          aria-describedby="their-bio-left"
          onChange={(value) => {
            setAnswer(null)
            setWritten(value)
          }}
        />
      </div>

      <p className="member__actions">
        <button
          type="button"
          className="button button--primary"
          aria-disabled={same || sending}
          onClick={() => {
            if (same || outstanding.current) {
              return
            }

            void save()
          }}
        >
          {t('theirBoxes.wordsSave')}
        </button>
      </p>

      {saved && (
        <p className="member__note" ref={said} tabIndex={-1} role="status">
          {t('theirBoxes.saved')}
        </p>
      )}
      {answer !== null && answer.got !== 'done' && <ServerSaid answer={answer} refusals={WHEN_CHANGING_MY_DATA} />}
    </section>
  )
}
