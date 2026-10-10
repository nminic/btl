import { useCallback, useEffect, useRef, useState } from 'react'
import { useToday } from '../../clock/useClock'
import { Unreadable } from '../../components/Unreadable'
import { teamOf } from '../../data/derive'
import { inYearlyWindow } from '../../data/season'
import { readerAdministers } from '../../data/teamAdmin'
import type { Competitor, Team } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import type { Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  theInvitationWasSent,
  whatThisTeamHasAsked,
  WHEN_INVITING_INTO_A_TEAM,
  type Queue,
  type TeamInvitation,
} from '../joiningThisTeam'

/**
 * „Pozovi u tim", on somebody else's profile, and since T5 (10.10.2026) on the server.
 *
 * The other half of „Prijavi se u tim", which lives on the team's own page, and
 * the two are deliberately not symmetrical. An application is decided by whoever
 * leads the team at the moment it is answered, so it waits where that role is
 * worked out; an invitation is decided by one named person who has no reason to
 * visit the team's page at all, so it goes to their inbox and the button that
 * starts it stands where somebody would be looking at them (PDL, „Gde stoji
 * odluka", 06.09.2026).
 *
 * **WHO SEES IT: WHOEVER LEADS A TEAM, AND NO OTHER MEMBER OF IT.** PDL 27.09.2026, the owner
 * choosing between three offered outcomes: „Samo administrator tima, kako pise u Pravilniku."
 * (Article 53), which overturned his own „(bilo koji član)" of 05.09.2026. The route has asked
 * that seat since the same day (`TeamJoiningWriteApi.heAdministersThisTeam`), and until T5 this
 * screen picked the reader's team by membership alone, so it offered every member of a team a
 * button that led to a 404 (QA review of 09.10.2026, row 4). The question is now
 * `readerAdministers`, the portal's one answer to „may I decide about this team", which
 * `TeamDetail.tsx` reads for „Izmeni", „Obriši" and the team's queue.
 *
 * **WHAT IT WRITES: NOTHING IN THE BROWSER.** Until T5 the press wrote an invitation and the
 * message that carries it into `session/SessionProvider.tsx`, so the member asked never saw it -
 * the message lived in the browser of the one asking. `POST /api/teams/{id}/invitations` writes
 * both (`TeamJoiningWriteApi.inviting`), and his inbox answers it with „Prihvati" and „Odbij"
 * (`member/ServedTeamInvite.tsx`).
 *
 * **When: inside the transfer window, and only about somebody with no team.**
 * The same window that governs founding a team, so everything that changes who
 * is in which team happens through one door rather than two (owner, 05.09.2026).
 *
 * There is no condition against inviting yourself, and that is not an omission:
 * the reader has a team and the member being read has none, so they cannot be
 * the same person. Written here because the absent check is the kind of thing a
 * later reader adds back.
 */
export function InviteToTeam({
  competitor,
  competitors,
  teams,
}: {
  competitor: Competitor
  competitors: Competitor[]
  teams: Team[]
}) {
  const today = useToday()
  const { memberNumber: reader } = useSession()

  /* The reader's team as the team itself and not as its identity, so „they are in
     no team" and „the team they name is not there" are one question with one
     answer. Asked as two, the second is a state nothing on the portal can reach,
     because deleting a team clears the identity off every record it named.

     Nobody signed in is the same question again: no record answers to `null`, so
     there is no team, and the line below draws nothing. A guard of its own above
     this was measured to be dead on 06.09.2026 — removed rather than left,
     because a guard nothing can reach is a guard nobody can be sure still
     works. */
  const team = teams.find(
    (one) => one.id === teamOf(competitors.find((each) => each.memberNumber === reader)),
  )

  if (
    team === undefined ||
    !readerAdministers(team, competitors, reader) ||
    teamOf(competitor) !== null ||
    !inYearlyWindow(today)
  ) {
    return null
  }

  /* Keyed by the team and the member, so a press, a refusal or a read about one profile is never
     drawn on the next: the profile is one component across every member's address, and the list
     of what this team has asked is read again for each one. */
  return (
    <AskingHimIn
      key={`${String(team.id)}/${competitor.memberNumber}`}
      team={team}
      member={competitor.memberNumber}
    />
  )
}

/**
 * THE BUTTON, OR IN ITS PLACE THAT THE TEAM HAS ALREADY ASKED HIM, read off the server.
 *
 * <p>PDL 06.09.2026, „[IZVEDENO] Isti tim ne poziva istog čoveka dvaput: ... poziv je isti zapis,
 * pa dok stoji, na njegovom mestu stoji da je poslat." Which invitations of this team stand is
 * `GET /api/teams/{id}/invitations`, answered to whoever leads the team, which this reader does;
 * it is the set `TeamJoiningWriteApi.thisTeamHasAskedHim` refuses a second invitation over, so
 * what is drawn and what the route would refuse cannot come apart.
 *
 * <p><b>NOTHING WHILE IT IS READ, AND A LIST THAT COULD NOT BE READ SAYS SO</b>, with the way to
 * ask again. That is MY reading of the decision of 02.10.2026 (PENDING stavka 368, in the PDL's
 * words: „Spisak koji ne moze da se ucita KAZE to, umesto da izgleda prazan"): the list is not
 * drawn here, but the button is a claim that he has not been asked, so drawing it over a list
 * nobody read would be the empty list the decision forbids.
 *
 * <p><b>After the server agreed the list is read again before the press lets go</b>, the order
 * `useTeamQueue.ts` keeps for the same lists, and „poziv je poslat" then stands where the button
 * stood and takes the focus the button left with, the arrangement `event/GoingToEvent.tsx` holds
 * for the line that replaces its form.
 */
function AskingHimIn({ team, member }: { team: Team; member: string }) {
  const { t } = useI18n()
  /** What this team has asked, or nothing while it has not been read yet. */
  const [asked, setAsked] = useState<Queue<TeamInvitation> | null>(null)
  /** Whether an asking again is out, which is what „Pokušaj ponovo" tells the reader. */
  const [reading, setReading] = useState(false)
  /** While a press is out, which is what the button says out loud (`aria-disabled`). */
  const [sending, setSending] = useState(false)
  const [refused, setRefused] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  /** That the sentence standing now replaced the button pressed, so it takes the focus. */
  const [sent, setSent] = useState(false)
  /**
   * A SECOND PRESS WHILE THE FIRST IS STILL OUT, and a ref rather than the state beside it, for
   * the reason `member/ServedTeamInvite.tsx` gives: two presses inside one task both read the
   * state as it was. Sent twice, the second is answered `heHasAlreadyBeenAsked` over an
   * invitation the first has just written.
   */
  const outstanding = useRef(false)
  const said = useRef<HTMLParagraphElement>(null)

  /* A read that comes back after the reader has gone writes into a component that is not there,
     which React ignores, so there is no guard for it here: a branch for it would be one nothing
     a reader can do reaches. */
  const read = useCallback(async (): Promise<void> => {
    setAsked(await whatThisTeamHasAsked(team.id))
  }, [team.id])

  useEffect(() => {
    void read()
  }, [read])

  useEffect(() => {
    /* Only where the focus fell to the body with the button: a reader who moved on while it was
       asked is not followed, which is `components/Resource.tsx`'s own reason. */
    if (sent && document.activeElement === document.body) {
      said.current?.focus()
    }
  }, [sent])

  async function readAgain(): Promise<void> {
    setReading(true)
    await read()
    setReading(false)
  }

  async function send(): Promise<void> {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setSending(true)
    setRefused(null)

    const answer = await theInvitationWasSent(team.id, member)

    if (answer.got === 'done') {
      await read()
      setSent(true)
    } else {
      setRefused(answer)
    }

    outstanding.current = false
    setSending(false)
  }

  if (asked === null) {
    return null
  }

  if (asked.got === 'unreadable') {
    return (
      <Unreadable
        said={t('data.error')}
        reading={reading}
        onRetry={() => {
          void readAgain()
        }}
      />
    )
  }

  /* HIM, by his number, on this team's list: never „the list has something on it", which would
     be a team that has asked anybody at all, and never a row with no number, which is somebody
     whose fee has lapsed and not the member on this page. */
  if (asked.rows.some((one) => one.memberNumber === member)) {
    return (
      <p className="profile__invited" tabIndex={-1} ref={said}>
        {t('teams.invited', { team: team.name })}
      </p>
    )
  }

  return (
    <>
      <button
        type="button"
        className="button button--secondary"
        aria-disabled={sending ? true : undefined}
        onClick={() => {
          void send()
        }}
      >
        {t('teams.invite')}
      </button>
      {/* Under the button and never in its place: refused, the button is still the way to ask,
          and the one refusal that means „he has been asked" is said in the words that stand in
          the button's place once the list shows it (`WHEN_INVITING_INTO_A_TEAM`). */}
      {refused !== null && (
        <ServerSaid
          answer={refused}
          refusals={WHEN_INVITING_INTO_A_TEAM}
          params={{ team: team.name }}
        />
      )}
    </>
  )
}
