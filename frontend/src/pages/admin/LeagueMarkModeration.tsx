import { useEffect, useRef, useState } from 'react'
import { CropChooser, type Chosen } from '../../components/CropChooser'
import { clearResourceCache } from '../../data/client'
import type { League } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { pictureToSend } from '../member/photoWrites'
import { LeagueMark } from '../league/LeagueMark'
import { DeleteSheet } from './DeleteSheet'
import { theMarkOf, WHEN_SETTING_A_LEAGUES_MARK } from './leagueMarkWrites'
import '../Leagues.css'

/** What the circle draws: the picture and its circle, or nothing and the initials. */
type Shown = Pick<League, 'logo' | 'crop' | 'smallLogo'>

/**
 * THE LEAGUE'S MARK, SET AND TAKEN DOWN IN THE MODERATION OF THE LEAGUE.
 *
 * Owner, PDL 23.11.2026, „Pravi logo lige”, chosen between offered outcomes: „ko postavlja:
 * administracija (administrator ili moderator sa pravom nad ligama) u moderaciji lige, bez odobravanja, i
 * odmah važi”, and „oblik: krug, seče se kao znak tima ... čuva se original, prikazuje se u krugu; bez loga
 * ostaje krug sa inicijalima”. So the button saves rather than sends for a decision, and the circle is
 * chosen with the chooser every picture of the portal is chosen with (`CropChooser`).
 *
 * **The shape is the administration's box for a member's picture** (`profile/TheMembersPictureAndWords.tsx`),
 * copied with its guards: one press at a time (`outstanding`), the answer said under the buttons, the
 * removal behind the sheet every deletion of the administration asks through (PDL 23.10.2026), and the list
 * every page of the leagues reads cleared once the route has accepted a write, so the card, the sheet and
 * the page of the league read the server again.
 *
 * **What it starts from is what the league answered with**, drawn by the very mark the three public places
 * draw (`LeagueMark`), so what the administration sees here is what a visitor will.
 */
export function LeagueMarkModeration({ league }: { league: League }) {
  const { t } = useI18n()
  const [shown, setShown] = useState<Shown>({ logo: league.logo, crop: league.crop, smallLogo: league.smallLogo })
  const [picked, setPicked] = useState<Chosen | null>(null)
  const [sending, setSending] = useState(false)
  const outstanding = useRef(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [said, setSaid] = useState<'saved' | 'removed' | null>(null)
  const sentence = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (said !== null) {
      sentence.current?.focus()
    }
  }, [said])

  async function save(chosen: Chosen): Promise<void> {
    outstanding.current = true
    setSending(true)
    setAnswer(null)
    setSaid(null)

    const answered = await askTheServer(theMarkOf(league.id), pictureToSend(chosen.file, chosen.crop))

    outstanding.current = false
    setSending(false)

    if (answered.got !== 'done') {
      setAnswer(answered)

      return
    }

    /* WHAT STANDS IS NOW WHAT WAS SAVED, drawn from the browser's own copy (the small circle is the server's
       to cut, so there is none yet here), and the list every page of the leagues reads is no longer true. */
    clearResourceCache('leagues')
    setShown({ logo: chosen.picture, crop: chosen.crop, smallLogo: null })
    setPicked(null)
    setSaid('saved')
  }

  /* TAKEN DOWN AT ONCE, and the sheet waits for the answer (`DeleteSheet`). */
  async function takeDown(): Promise<void> {
    setAnswer(null)
    setSaid(null)

    const answered = await askTheServer(theMarkOf(league.id), {}, 'DELETE')

    if (answered.got !== 'done') {
      setAnswer(answered)

      return
    }

    clearResourceCache('leagues')
    setShown({ logo: null, crop: null, smallLogo: null })
    setSaid('removed')
  }

  return (
    <section className="leagues__counting" aria-labelledby={`league-mark-${String(league.id)}`}>
      <h2 className="leagues__counting-title" id={`league-mark-${String(league.id)}`}>
        {t('leagueMark.title')}
      </h2>

      <p className="leagues__mark-standing">
        <LeagueMark league={{ name: league.name, ...shown }} />
        <span>{t(shown.logo === null ? 'leagueMark.none' : 'leagueMark.standing')}</span>
      </p>
      <p className="member__note">{t('leagueMark.atOnce')}</p>

      <CropChooser
        id={`league-mark-file-${String(league.id)}`}
        label={t('leagueMark.choose')}
        asked={false}
        unmarked
        alt={t('leagueMark.chosenAlt')}
        chosen={picked}
        onChange={(next) => {
          setAnswer(null)
          setSaid(null)
          setPicked(next)
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
          {t('leagueMark.save')}
        </button>
        {shown.logo !== null && (
          <DeleteSheet
            name={t('leagueMark.title')}
            opener={t('leagueMark.remove')}
            asks={t('leagueMark.removeAsks')}
            look="button button--secondary"
            onDelete={takeDown}
          />
        )}
      </p>

      {said !== null && (
        <p className="member__note" ref={sentence} tabIndex={-1} role="status">
          {t(said === 'saved' ? 'leagueMark.saved' : 'leagueMark.removed')}
        </p>
      )}
      {answer !== null && answer.got !== 'done' && (
        <ServerSaid answer={answer} refusals={WHEN_SETTING_A_LEAGUES_MARK} />
      )}
    </section>
  )
}
