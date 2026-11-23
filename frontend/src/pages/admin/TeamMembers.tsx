import { useState } from 'react'
import { SYMBOL } from '../../app/actionSymbol'
import { ActionButton } from '../../components/ActionButton'
import { Prompt } from '../../components/Prompt'
import type { Competitor, Team } from '../../data/types'
import type { Suggestion } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { MemberChoice } from '../event/MemberChoice'
import { memberOfTheTeam, membersOfTheTeam, WHEN_THE_ADMINISTRATION_MOVES_A_MEMBER } from './teamWrites'
import '../Leagues.css'

/** How a member reads in the list and in the box once chosen: the two names and the number. */
function labelOf(one: Competitor): string {
  return `${one.firstName} ${one.lastName} (${one.memberNumber})`
}

/**
 * „DODAJ ČLANA” AND „IZBACI” UNDER ONE TEAM OF THE ADMINISTRATION'S LIST.
 *
 * <p>PDL P13, „[ODLUKA 23.11.2026 ...] Administracija dodaje i izbacuje članove tima direktno”: „U
 * Administracija → Timovi, uz svaki tim: „Dodaj člana” (izbor člana sa kucanjem) i „Izbaci” uz svakog
 * člana.” Both go to `TeamAdministrationWriteApi`, which asks the rules (the window, one team at a time, the
 * season paid) and tells the member; this panel decides none of them and says the route's sentence when it
 * refuses.
 *
 * <p><b>Copied rather than invented.</b> The box is `event/MemberChoice.tsx`, the administration's box of a
 * member that takes typing (PDL 23.11.2026, „Tri brze izmene administracije”), and the list with a control at
 * the end of each row and the row that adds are `LeagueRaceModeration.tsx`'s, the panel that puts races into a
 * league and takes them out, with its classes. What the box offers is every member in no team, because a
 * member in one is refused anyway; the route stays the one that decides.
 *
 * <p><b>„Izbaci” asks „Da” or „Ne” first</b> (PDL P13, „[ODLUKE 23.11.2026 ...] (3) „Izbaci” pita „Da”/„Ne”
 * u istom redu, isto kao brisanje i storno”), and the question is the storno's own, copied with its guards:
 * `MemberRow.tsx`'s `yesOrNo` (`components/Prompt.tsx`, one way of saying yes, „Da”, and „Ne”), and the sheet
 * telling off every press while the request is out (`working`). „Ne” puts the question away and nothing is
 * sent; the answer closes it, and a refusal is said beside the panel as for „Dodaj člana”.
 *
 * <p><b>Without `MemberRow`'s second guard, the ref that holds a request to one at a time, and that is
 * measured.</b> Here „Da” is the one way to send, and `working` is set in the same press, so the next press
 * meets a sheet that answers nothing; the ref's `return` was never reached (coverage of PR 810), and the case
 * of „Da” pressed twice is held by `working` alone.
 *
 * <p><b>After every write the list is read again</b> (`onWritten`), as after the making of a team: who is in
 * which team reaches this screen as `Competitor.teamId`, so the row moves only when the server says it did.
 */
export function TeamMembers({
  team,
  members,
  free,
  season,
  onWritten,
}: {
  team: Team
  /** Who is in this team now, off `/api/competitors`. */
  members: readonly Competitor[]
  /** Who is in no team, which is what the box offers. */
  free: readonly Competitor[]
  /** The season a change of team takes effect in, which `theSeasonIsNotPaid` names. */
  season: number
  onWritten: () => void
}) {
  const { t } = useI18n()
  const [typed, setTyped] = useState('')
  const [chosen, setChosen] = useState('')
  const [notChosen, setNotChosen] = useState(false)
  const [refused, setRefused] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [said, setSaid] = useState('')
  /** The member whose „Izbaci” was pressed and who waits for „Da” or „Ne”, or nobody. */
  const [asking, setAsking] = useState<Competitor | null>(null)
  /** Whether „Da” has been answered and the request is out, which tells off every press on the sheet. */
  const [working, setWorking] = useState(false)
  const boxId = `team-${String(team.id)}-member`
  const notChosenId = `${boxId}-not-chosen`
  const offered: Suggestion[] = free.map((one) => ({
    id: one.memberNumber,
    value: labelOf(one),
    said: labelOf(one),
    fills: {},
  }))

  /** A refusal stays beside the panel and keeps what was typed; a write that went says so and reads again. */
  async function answered(asked: Promise<Answer>, done: string): Promise<boolean> {
    const answer = await asked

    if (answer.got !== 'done') {
      setRefused(answer)
      setSaid('')

      return false
    }

    setRefused(null)
    setSaid(done)
    onWritten()

    return true
  }

  /** „Da”: the member goes, once, and the question closes with the answer. */
  async function takeOut(one: Competitor): Promise<void> {
    setWorking(true)

    try {
      await answered(
        askTheServer(memberOfTheTeam(team.id, one.memberNumber), {}, 'DELETE'),
        t('admin.teamMemberTakenOut'),
      )
    } finally {
      setAsking(null)
      setWorking(false)
    }
  }

  async function add(): Promise<void> {
    if (chosen === '') {
      setNotChosen(true)

      return
    }

    setNotChosen(false)

    if (
      await answered(
        askTheServer(membersOfTheTeam(team.id), { memberNumber: chosen }, 'POST'),
        t('admin.teamMemberAdded'),
      )
    ) {
      setTyped('')
      setChosen('')
    }
  }

  return (
    <section aria-label={t('admin.teamMembersOf', { team: team.name })}>
      {members.length === 0 ? (
        <p className="profile__empty">{t('admin.teamNoMembers')}</p>
      ) : (
        <ul className="leagues__event-races">
          {members.map((one) => (
            <li key={one.memberNumber} className="leagues__counted-race">
              <span>{labelOf(one)}</span>
              <ActionButton
                symbol={SYMBOL.cross}
                word={t('admin.teamMemberOut')}
                className="button button--secondary"
                name={t('admin.teamMemberOutNamed', { member: labelOf(one) })}
                onClick={() => setAsking(one)}
              />
            </li>
          ))}
        </ul>
      )}

      {asking !== null && (
        <Prompt
          title={t('admin.teamMemberOutAsk')}
          choices={[{ label: t('admin.yes'), onChoose: () => void takeOut(asking) }]}
          decline={t('admin.no')}
          onDecline={() => setAsking(null)}
          working={working ? t('results.sending') : undefined}
        >
          <p>{t('admin.teamMemberOutWhom', { member: labelOf(asking), team: team.name })}</p>
        </Prompt>
      )}

      <div className="leagues__adding">
        <div className="rankings__field leagues__adding-member">
          <label htmlFor={boxId}>{t('admin.teamMemberChoose')}</label>
          <MemberChoice
            fitted
            id={boxId}
            name={boxId}
            value={typed}
            suggestions={offered}
            invalid={notChosen}
            describedBy={notChosen ? notChosenId : undefined}
            /* A name typed is nobody until chosen, as on a row of results. */
            onType={(next) => {
              setTyped(next)
              setChosen('')
            }}
            onChoose={(one) => {
              setTyped(one.value)
              setChosen(one.id)
              setNotChosen(false)
            }}
          />
        </div>

        <button type="button" className="button" onClick={() => void add()}>
          {t('admin.teamMemberAdd')}
        </button>
      </div>

      {notChosen && (
        <p id={notChosenId} role="alert" className="entity-row-note">
          {t('admin.teamMemberNotChosen')}
        </p>
      )}

      {refused !== null && (
        <ServerSaid answer={refused} refusals={WHEN_THE_ADMINISTRATION_MOVES_A_MEMBER} params={{ season }} />
      )}

      {/* Said once and politely: the list above has already changed. */}
      <p aria-live="polite" className="visually-hidden">
        {said}
      </p>
    </section>
  )
}
