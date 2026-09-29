import { useEffect, useRef } from 'react'
import { screen, within } from '@testing-library/react'
import { renderAt } from '../test/render'
import { Asked } from '../test/saved'
import { recordKey } from '../session/context'
import { MEMBERS } from './admin/entityForms'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useSession } from '../session/useSession'

/* A member asking to be let into a team, and the team answering.
 *
 * Owner, 05.09.2026: „član vidi dugme 'Prijavi se u tim' na strani tima, samo tokom
 * prelaznog perioda", and on who answers: the application is decided by the administrator
 * of that team and by nobody else, because who is in whose team is not the league's
 * business.
 *
 * **An application is a record about the team, not a letter to a person**, and every case
 * here is about what follows from that. Written as a letter it went to whoever ran the
 * team at the moment it was sent: a founder who left went on deciding while the one who
 * really ran the team never saw it, and an application nobody could answer waited for ever
 * and kept the member out of every team on the portal (reviews, 05. and 06.09.2026).
 *
 * 000002 (Relja Momčilović) has no team, so he asks. Dunavski trkači is run by 000001.
 */

/** A day inside the transfer window, which is the only time any of this is offered. */
const DAY = '2026-10-15'
/** And one outside it. */
const SHUT = '2026-06-15'
/** And a later day inside the same window, for whatever must not be today. */
/** A second application on one team, on a third day, so no two of the three coincide. */

/* 000004 is Časlav Radenković, the second member with no team. */

/** A day inside the window of the **following** year, so the season an answer writes and
 *  the season the application was sent in are two different numbers. */
/** And a third application, on a third day, so no row is first and last at once. */

const DUNAV = '/sr/tim/dunavski-trkaci'
const VARDAR = '/sr/tim/vardarski-krug'

/* What the two controls are called, now that each carries the name of whoever it answers
   about. 000002 is Relja Momčilović. */

describe('the way a member asks to be let into a team', () => {
  it('is offered inside the window to somebody with no team, and asked once', async () => {
    const user = setupUser()

    renderAt(DUNAV, 'competitor', '000002', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))

    /* Asked once, and the way to take it back stands where the way in stood. */
    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Povuci prijavu' })).toBeVisible()
  }, SLOW)

  it('is not offered on a second team while one application is waiting', async () => {
    /* A member is in one team (PDL P13), so they wait on one. Counted per team instead,
       one member stood before two teams at once and each answered without knowing of the
       other (review, 05.09.2026). */
    const user = setupUser()
    const { router } = renderAt(DUNAV, 'competitor', '000002', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await router.navigate(VARDAR)

    await screen.findByRole('heading', { level: 1, name: 'Vardarski krug' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
    /* And the way back out is on the team it was sent to, not on this one. */
    expect(screen.queryByRole('button', { name: 'Povuci prijavu' })).toBeNull()
  }, SLOW)

  it('can be taken back by the member who sent it, which is how it always has an ending', async () => {
    /* The one ending that needs nobody else. Whatever happens to the team, the member is
       never left waiting on something that cannot be answered. */
    const user = setupUser()
    const { router } = renderAt(DUNAV, 'competitor', '000002', undefined, DAY)

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'Povuci prijavu' }))

    expect(await screen.findByRole('button', { name: 'Prijavi se u tim' })).toBeVisible()

    /* And they are free on every other team again, which is what „waiting" was keeping
       them from. */
    await router.navigate(VARDAR)

    expect(await screen.findByRole('button', { name: 'Prijavi se u tim' })).toBeVisible()
  }, SLOW)

  it('can still be taken back once the member has a team by another road', async () => {
    /* **The way out shared its conditions with the way in, so it vanished whenever they
       changed** (review, 06.09.2026). Here a team arrives by another road while the
       application waits, which administration and the moderator's queue both do. Ending
       what you started may not depend on whether you could start it again. */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <Given who="000002" team={3} />,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'daj tim 000002' }))

    expect(await screen.findByRole('button', { name: 'Povuci prijavu' })).toBeVisible()
  }, SLOW)

  it('can still be taken back after the window has shut', async () => {
    /* Outside the window an application simply waits, which is what one door for every
       change of team means. Waiting is not being stuck: drawn inside the window check, in
       June the member had an application and nothing that could end it. */
    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      SHUT,
      <Applied who="000002" team={1} day={DAY} />,
    )

    return screen.findByRole('button', { name: 'Povuci prijavu' }).then((one) => {
      expect(one).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
    })
  })

  it('stops counting when the team it was sent to is deleted, so the member is free', async () => {
    /* **The worst of the three.** The team is deleted by the control 133c put on this very
       page. Written as it was, the application stayed open, no other team offered a way in
       because the member was waiting, and no page offered a way out because the team was
       gone: 000002 was outside every team on the portal for good (review, 06.09.2026). An
       application about a team that is not there is about nothing. */
    const user = setupUser()
    const { router } = renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <Folded team={1} />,
    )

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'obriši 1' }))
    await router.navigate(VARDAR)

    expect(await screen.findByRole('button', { name: 'Prijavi se u tim' })).toBeVisible()
  }, SLOW)

  it('keeps its own identity when an earlier one has been taken back', async () => {
    /* **Two applications answered to one identity** while the id was counted from how many
       there are, and `answer` shortens that very list (review, 06.09.2026). Add, add, take
       one back, add again: the fourth is handed the number the second holds, and taking
       either back takes both. The team the other was sent to never saw it go.

       000002 asks Dunav, 000004 asks Vardar, 000002 takes theirs back and asks again, then
       000004 takes theirs back. If the two share an id, 000002 is left with nothing. */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <>
        <Also who="000004" team={3} day={DAY} />
        <Answered who="000004" />
        <Asked />
      </>,
    )

    /* Add, add, take the first back, add again: the fourth is handed the number the second
       holds while the count is read off the length. All of it on one page, because six
       steps through three addresses did not reach the end and the case then measured
       something else (measured 06.09.2026). */
    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(screen.getByRole('button', { name: 'prijavi 000004' }))
    await user.click(await screen.findByRole('button', { name: 'Povuci prijavu' }))

    /* **Taking one back takes one back.** Closing goes by identity, so an identity that
       reaches two records closes both, and a list emptied instead of filtered closes
       everything. Neither shows on this screen, which draws one team. */
    expect(
      within(screen.getByRole('list', { name: 'open applications' })).getByText(/000004/),
    ).toBeVisible()
    expect(
      within(screen.getByRole('list', { name: 'open applications' })).queryByText(/000002/),
    ).toBeNull()

    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))

    /* Vardar answers the one it was sent. If the two share an identity, this takes 000002's
       with it and leaves them with nothing they ever asked to end. */
    await user.click(screen.getByRole('button', { name: 'odgovori 000004' }))

    expect(await screen.findByRole('button', { name: 'Povuci prijavu' })).toBeVisible()
  }, SLOW)

  it('takes back its own and not whichever was filed first', async () => {
    /* The identity a withdrawal carries is read off the member who sent it, not off the
       top of the list. With their own filed first the right answer and the wrong one
       coincide and the case says nothing, which is what the case above does: measured
       06.09.2026, a withdrawal reading `applications[0]` passed it. Here somebody else's
       stands first, and taking it by position would close a question the member never
       asked, on a team they have nothing to do with. */
    const user = setupUser()

    renderAt(
      DUNAV,
      'competitor',
      '000002',
      undefined,
      DAY,
      <>
        <Also who="000004" team={3} day={DAY} />
        <Asked />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'prijavi 000004' }))
    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))
    await user.click(await screen.findByRole('button', { name: 'Povuci prijavu' }))

    const open = within(screen.getByRole('list', { name: 'open applications' }))

    expect(open.getByText(/000004/)).toBeVisible()
    expect(open.queryByText(/000002/)).toBeNull()
  }, SLOW)

  it('is not offered outside the transfer window', async () => {
    renderAt(DUNAV, 'competitor', '000002', undefined, SHUT)

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })

  it('is not offered to somebody who is already in a team', async () => {
    renderAt('/sr/tim/nisavski-maraton-klub', 'competitor', '000007', undefined, DAY)

    await screen.findByRole('heading', { level: 1, name: 'Nišavski maraton klub' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })

  it('is not offered on a team nobody is in, because there is nobody to answer', async () => {
    renderAt('/sr/tim/novoosnovani-tim', 'competitor', '000002', undefined, DAY)

    await screen.findByRole('heading', { level: 1, name: 'Novoosnovani tim' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })

  it('is not offered to a visitor, who has no record to be in a team at all', async () => {
    renderAt(DUNAV, 'visitor', null, undefined, DAY)

    await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

    expect(screen.queryByRole('button', { name: 'Prijavi se u tim' })).toBeNull()
  })
})

/** A member who has come by a team some other way while their application waited. The
 *  moderator approving a team they proposed writes exactly this
 *  (`admin/PendingQueue.tsx`), and so does administration editing their record. */
function Given({ who, team }: { who: string; team: number }) {
  const { editRecord } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        editRecord(recordKey(MEMBERS.id, who), { teamId: String(team), teamSince: '2027' })
      }}
    >
      daj tim {who}
    </button>
  )
}

/** A second application, filed the way the screen files one, on behalf of somebody who is
 *  not the member reading this page. */
function Also({ who, team, day }: { who: string; team: number; day: string }) {
  const { apply } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        apply({ teamId: team, memberNumber: who, date: day })
      }}
    >
      prijavi {who}
    </button>
  )
}

/** That other application answered, the way the team answers one: by the identity it
 *  carries. */
function Answered({ who }: { who: string }) {
  const { applications, answer } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        applications
          .filter((one) => one.memberNumber === who)
          .forEach((one) => {
            answer(one.id)
          })
      }}
    >
      odgovori {who}
    </button>
  )
}

/** A team deleted during this same visit, which the control 133c put on this very page
 *  does. On a button and not on mounting, because the application has to exist before the
 *  team stops doing so. */
function Folded({ team }: { team: number }) {
  const { remove } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        remove('teams', String(team))
      }}
    >
      obriši {team}
    </button>
  )
}

/** An application already open, filed the way the screen files one, so the answering side
 *  can be measured on a day when nobody could have sent it. */
function Applied({ who, team, day }: { who: string; team: number; day: string }) {
  const { apply } = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      apply({ teamId: team, memberNumber: who, date: day })
    }
  }, [apply, who, team, day])

  return null
}

/* WHERE „THE ANSWER THE TEAM GIVES" WENT, 29.09.2026.
 *
 * Eighteen cases stood here and drove the SESSION: an application was filed into
 * `session/SessionProvider.tsx`, „Primi u tim" was pressed on the team's page, and what was
 * measured was what the session then held - the member's `teamId`, the message in his inbox,
 * the other teams' invitations closed. None of that is this side's any more. The team's queue
 * is read off `GET /api/teams/{id}/applications` and answered through
 * `PUT /api/teams/{id}/applications/{application}` (`pages/joiningThisTeam.ts`), so the act
 * those cases pressed does not exist here to be pressed.
 *
 * WHERE EACH HALF IS MEASURED NOW:
 *
 * - WHICH row, WHICH team, WHICH day, and what the request carries: `pages/teamQueueOnTheServer.test.tsx`,
 *   on a team that is not the first, a row that is not the first, and a day that is not today.
 * - WHAT FOLLOWS from the answer - the season he runs from, the message he gets, the other
 *   teams' invitations that stop standing: `TeamJoiningWriteApiTest` on the server, which is
 *   where the writing happens.
 *
 * AND THEY WERE NOT LEFT IN PLACE TO PASS QUIETLY, WHICH IS THE PART WORTH WRITING DOWN. Six of
 * the eighteen went on PASSING after the change and every one of them passed for the wrong
 * reason: they assert that something is NOT drawn, and nothing at all was being drawn. One of
 * the six („is not given outside the window") had become the opposite of the decision it was
 * written for - PDL, 06.09.2026: „„Prihvati" traži prelazni rok, „Odbij" ne" - so the section
 * IS drawn outside the window now and only one button is missing. A case asserting an
 * overturned rule while passing is worse than no case, so all eighteen went together.
 *
 * WHAT STAYS IN THIS FILE is the member's own half, above: „Prijavi se u tim" and „Povuci
 * prijavu" are still written into the session, because no screen on this portal sends
 * `POST /api/teams/{id}/applications` (`pages/account/refusals.test.ts` keeps that as an
 * exemption with its own reason). That is the boundary `pages/TeamDetail.tsx` names where it
 * reads the session, and it closes when applying goes to the route. */
