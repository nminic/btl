import { useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { useWhatIsWaiting } from '../../data/useResource'
import type { WhatIsWaiting } from '../../data/types'
import { ServerSaid } from '../account/ServerSaid'
import type { Answer } from '../account/askTheServer'
import {
  WHEN_ANSWERING_A_TEAM_INVITE,
  theInvitationStanding,
  theServerWasAnswered,
} from './teamWrites'

/**
 * „PRIHVATI" AND „ODBIJ", UNDER A TEAM'S INVITATION THE SERVER IS KEEPING, AND THEY REACH
 * THE SERVER.
 *
 * <p>Owner, PDL, 05.09.2026: „**Poziv u tim prihvata pozvani član.**"
 * `PUT /api/teams/{id}/invitations/{invitation}` existed before this screen did and nothing
 * called it, so a served invitation drew a subject, a sender and a body and nothing else.
 *
 * <p><b>THE TWIN OF THIS FILE IS `member/InvitationAnswer.tsx` AND THEY ARE NOT
 * INTERCHANGEABLE.</b> That one answers an invitation the BROWSER made, by writing the team
 * onto a record in `session/SessionProvider.tsx`; this one answers an invitation the SERVER
 * made, by writing to the route. Handing a served key to that one is the fault this
 * arrangement exists to refuse: it looks an invitation up in the session's own list and
 * treats one it cannot find as one that is OVER, so the member would read „Ovaj poziv više
 * ne stoji." about a question `team_invitation` still held open. The keys are a number here
 * and text there (`data/types.ts` against `session/context.ts`), so the compiler is what
 * keeps them apart. `member/ServedPairInvite.tsx` is the same pair for the racing half and
 * this is its shape copied rather than a new one.
 *
 * <p><b>THE ONE THING THIS SCREEN READS THAT ITS PAIR TWIN DOES NOT, and it is the whole
 * reason `GET /api/me/applications` is read at all.</b> `PUT /api/pairs/{id}` takes the one
 * key the inbox already carries; this route takes the TEAM as well, and
 * `TeamJoiningWriteApi.invitationHeMayAnswer` really asks for it
 * (`where i.id = ? and i.team_id = ?`). No field of `GET /api/inbox` carries a team, so the
 * half that is missing is fetched from the one route that hands the invited member both.
 *
 * <p><b>WHAT THIS SCREEN DOES NOT WORK OUT, AND EACH ABSENCE IS MEASURED.</b>
 *
 * <ul>
 * <li><b>The season.</b> The twin computes it (`transfersTakeEffect`) because it writes the
 * membership itself. This one writes nothing: `TeamJoiningWriteApi.takeHimIn` reads that same
 * method ON THE SERVER on the day of the answer, and the class note says at length why the
 * season standing on the QUESTION is not the source of it. A season computed here would be a
 * second answer, and the two would differ across midnight on 31 December.
 * <li><b>Whether he is still a member, and whether the team still exists.</b> The route asks
 * both again inside the transaction (`join team t`, `and c.active`), so a copy here would be
 * a second home for a rule enforced in one statement.
 * <li><b>Whether the question is his.</b> The same statement asks that too, which is the
 * owner's own sentence of 05.09.2026 carried out. This screen could not ask it anyway:
 * `GET /api/inbox` spends `to_id` on its own `where` clause and the field never leaves the
 * server. What it CAN say is narrower and honest - a key that is not in what the server says
 * he is waiting on is not answerable by him, whether it is somebody else's or simply gone,
 * and `member/teamWrites.ts` writes that boundary down rather than pretending to tell the
 * two apart.
 * <li><b>The team's NAME.</b> Nothing here draws one. The subject and the body of the message
 * already carry it, written by the server out of the portal's own dictionary
 * (`teams.inviteSubject`, `teams.inviteBody`), so a name fetched here would be a second
 * telling of what the reader is already looking at.
 * </ul>
 *
 * <p><b>The loader carries no label, and that is a refusal to invent a word.</b>
 * `components/Resource` names a part when the dictionary has a name for it
 * (`event.races`, `event.results`); there is no name for „what you are waiting on" and one
 * written here would be a sentence of the portal's that no decision gives. `inline` is what
 * matters and is set: a sheet over the whole page would hide the message the reader is in
 * the middle of.
 */
export function ServedTeamInvite({ invitation, mine }: { invitation: number; mine: string }) {
  return (
    <Resource state={useWhatIsWaiting(mine)} inline>
      {(waiting) => <TheAnswer invitation={invitation} waiting={waiting} />}
    </Resource>
  )
}

function TheAnswer({ invitation, waiting }: { invitation: number; waiting: WhatIsWaiting }) {
  const { t } = useI18n()
  const today = useToday()
  /* What came back, where it was anything but „done". A successful answer draws nothing of
     its own: the question is closed on the server, the inbox is re-read, and the line comes
     back without a key so these buttons are gone rather than offered again. */
  const [said, setSaid] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [sending, setSending] = useState(false)
  /**
   * A SECOND PRESS WHILE THE FIRST IS STILL OUT, and it is a ref rather than the state
   * beside it.
   *
   * <p>`member/ServedPairInvite.tsx`'s own guard, which is `Registration.tsx`'s, which
   * `ProposeTeam.tsx`, `RateEvent.tsx`, `ProfilePicture.tsx` and `admin/Payments.tsx` all
   * copied. <b>The state cannot do this job</b>: `setSending(true)` is applied on the next
   * render, so two presses dispatched inside one task both read `sending === false` and both
   * send. A ref is written in the same tick it is read.
   *
   * <p><b>And it is why the case that measures it does not use `user.click` twice.</b>
   * Testing Library awaits between clicks, which lets React render, so `sending` alone would
   * pass and the guard would look sound while being absent. The case calls the handler twice
   * within one task instead.
   *
   * <p><b>What a second press would really cost here is worse than on the pair screen.</b>
   * „Prihvati" sent twice writes `team_membership` twice, and the second meets
   * `team_membership_one_team_at_a_time` rather than a tidy refusal - so what the member
   * would read is not „you are already in a team" but whatever a broken constraint answers.
   */
  const outstanding = useRef(false)

  const standing = theInvitationStanding(waiting, invitation, today)

  async function answer(team: number, accepted: boolean): Promise<void> {
    if (outstanding.current) {
      return
    }

    outstanding.current = true
    setSending(true)
    setSaid(null)

    const came = await theServerWasAnswered(team, invitation, accepted)

    outstanding.current = false
    setSending(false)

    if (came.got !== 'done') {
      setSaid(came)
    }
  }

  /**
   * THE ONE NUMBER THAT IS NOT A FAULT BUT AN ANSWER: 404 means the question is not there.
   *
   * <p>`TeamJoiningWriteApi` answers an empty 404 through `away()` for four states it
   * deliberately cannot tell apart - the row is gone, it belongs to another team, it is
   * somebody else's, or he is no longer a member - and the owner's reason of 05.09.2026 is
   * why they are one answer: „adresa koju član ne sme da otvori nije strana sa objašnjenjem
   * nego adresa koje za njega nema."
   *
   * <p><b>Told INSTEAD of the buttons rather than beside them</b>, because a question the
   * server says is not there cannot be answered by pressing again, and <b>the inbox is NOT
   * re-read</b>, for the reason `member/inboxRead.ts` states about its own refusal: nothing
   * is dropped where the server did not agree.
   *
   * <p><b>Only 404, and never every number that is not 200.</b> A 500 or a 502 is „try again
   * in a minute" and `ServerSaid` says exactly that; read as „closed", a server that was down
   * for a moment would tell a member his invitation had expired.
   */
  const notThere = said !== null && said.got === 'wrong' && said.status === 404

  if (!standing.standing || notThere) {
    return (
      <p className="messages__answered" role="status">
        {t('teams.inviteClosed')}
      </p>
    )
  }

  const team = standing.team

  return (
    <>
      <p className="messages__answer">
        {/* **„PRIHVATI" GOES AND „ODBIJ" STAYS, WHICH IS TWO DECISIONS AND NOT ONE.** PDL,
            06.09.2026: „**„Prihvati" traži prelazni rok, „Odbij" ne.**", and, of the member
            who already has a team, „Čim član ima tim, nijedan drugi poziv ne nudi
            „Prihvati"." Both name one button. The first entry says what taking the other one
            away would cost - „član pozvan 30. decembra ne bi mogao ni da prihvati ni da se
            oslobodi pitanja do sledećeg oktobra" - and that reads the same whichever of the
            two obstacles it is. Which sentence stands in its place, and in which order the
            two obstacles are asked, is `member/teamWrites.ts`. */}
        {standing.accept === 'offered' ? (
          /* **`aria-disabled` AND NEVER `disabled`, WHICH IS THE PORTAL'S OWN ANSWER GIVEN
             TWICE WITH ITS REASON.** `member/ProfilePicture.tsx` states it - „`disabled`
             takes the button out of the tab order and ... the press is refused in the
             handler as well, off a ref" - `event/RateEvent.tsx` says the same, and
             `pages/Home.css` carries the rule written for exactly this, in colours rather
             than `opacity`, so the focus ring keeps its full strength (WCAG 2.2 SC 1.4.11).

             **What `disabled` would really cost, and it is not cosmetic.** A member
             answering by keyboard has focus ON this button when he presses it. Switched off
             in that instant, the element leaves the tab order under his feet and the browser
             drops focus to the top of the document, so the one person who cannot see where
             he landed is the one it happens to. */
          <button
            type="button"
            className="button"
            aria-disabled={sending}
            onClick={() => {
              void answer(team, true)
            }}
          >
            {t('teams.inviteAccept')}
          </button>
        ) : (
          /* The sentence where the button was, which is `member/InvitationAnswer.tsx`'s own
             arrangement for the identical state: a `span` inside the same paragraph, beside
             the button that has not gone anywhere. The KEY is read out of the same map the
             route's refusals are read out of, so the sentence a member gets before he
             presses and the one he gets if the server refuses him cannot come apart. */
          <span className="messages__answered">
            {t(WHEN_ANSWERING_A_TEAM_INVITE[standing.accept])}
          </span>
        )}{' '}
        <button
          type="button"
          className="button button--secondary"
          aria-disabled={sending}
          onClick={() => {
            void answer(team, false)
          }}
        >
          {t('teams.inviteRefuse')}
        </button>
      </p>
      {said !== null && <ServerSaid answer={said} refusals={WHEN_ANSWERING_A_TEAM_INVITE} />}
    </>
  )
}
