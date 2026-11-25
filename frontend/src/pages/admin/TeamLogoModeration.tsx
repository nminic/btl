import { useEffect, useRef, useState } from 'react'
import { CropChooser, type Chosen } from '../../components/CropChooser'
import { TeamMark } from '../../components/TeamMark'
import { clearResourceCache } from '../../data/client'
import type { Team } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { pictureToSend } from '../member/photoWrites'
import { theTeamsLogoAt, WHEN_SETTING_A_TEAMS_LOGO } from '../member/teamLogoWrites'
import { DeleteSheet } from './DeleteSheet'

/** What the circle draws: the picture and its circle, or nothing and the initials. */
type Shown = Pick<Team, 'logo' | 'crop' | 'smallLogo'>

/**
 * A TEAM'S LOGO, SET AND TAKEN DOWN BY THE ADMINISTRATION, AT ONCE, IN THE FORM OF THE TEAM.
 *
 * Owner, PDL 25.11.2026, „Urednik tima postavlja znak tima slikom”: „da moze i iz administracije”, and the derivation
 * recorded beside it: „Znak koji postavi administracija važi odmah, bez odobravanja”, from the league's mark. So
 * this is the league's box (`LeagueMarkModeration.tsx`), copied with its guards: one press at a time, the answer said
 * under the buttons, the removal behind the sheet, and the list of teams read again once the route has accepted a
 * write. **A logo the team's editor has sent and that waits is not touched** by either write (the owner's answer of
 * the same day): a moderator may still approve it over this one.
 */
export function TeamLogoModeration({ team }: { team: Team }) {
  const { t } = useI18n()
  const [shown, setShown] = useState<Shown>({ logo: team.logo, crop: team.crop, smallLogo: team.smallLogo })
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

    const answered = await askTheServer(theTeamsLogoAt(team.id), pictureToSend(chosen.file, chosen.crop))

    outstanding.current = false
    setSending(false)

    if (answered.got !== 'done') {
      setAnswer(answered)

      return
    }

    clearResourceCache('teams')
    setShown({ logo: chosen.picture, crop: chosen.crop, smallLogo: null })
    setPicked(null)
    setSaid('saved')
  }

  async function takeDown(): Promise<void> {
    setAnswer(null)
    setSaid(null)

    const answered = await askTheServer(theTeamsLogoAt(team.id), {}, 'DELETE')

    if (answered.got !== 'done') {
      setAnswer(answered)

      return
    }

    clearResourceCache('teams')
    setShown({ logo: null, crop: null, smallLogo: null })
    setSaid('removed')
  }

  return (
    <section className="member__panel" aria-labelledby={`team-logo-${String(team.id)}`}>
      <h2 className="profile__section" id={`team-logo-${String(team.id)}`}>
        {t('teamLogo.title')}
      </h2>

      <p className="member__note">
        <TeamMark team={{ ...team, ...shown }} />
        <span>{t(shown.logo === null ? 'teamLogo.none' : 'teamLogo.standingNote')}</span>
      </p>
      <p className="member__note">{t('teamLogo.atOnce')}</p>

      <CropChooser
        id={`team-logo-file-${String(team.id)}`}
        label={t('teamLogo.choose')}
        asked={false}
        unmarked
        alt={t('teamLogo.chosenAlt')}
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
          {t('teamLogo.save')}
        </button>
        {shown.logo !== null && (
          <DeleteSheet
            name={t('teamLogo.title')}
            opener={t('teamLogo.remove')}
            asks={t('teamLogo.removeAsks')}
            look="button button--secondary"
            onDelete={takeDown}
          />
        )}
      </p>

      {said !== null && (
        <p className="member__note" ref={sentence} tabIndex={-1} role="status">
          {t(said === 'saved' ? 'teamLogo.saved' : 'teamLogo.removed')}
        </p>
      )}
      {answer !== null && answer.got !== 'done' && <ServerSaid answer={answer} refusals={WHEN_SETTING_A_TEAMS_LOGO} />}
    </section>
  )
}
