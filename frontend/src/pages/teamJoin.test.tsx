import { screen, within } from '@testing-library/react'
import { renderAt } from '../test/render'
import { Asked } from '../test/saved'
import { setupUser } from '../test/user'
import { useSession } from '../session/useSession'

/* THE SESSION'S OWN LIST OF APPLICATIONS, AND NOTHING ELSE, SINCE T5 (10.10.2026).
 *
 * Until that day this file walked „Prijavi se u tim" and „Povuci prijavu" on a team's page, and
 * every case was satisfied by the browser's own copy: the press wrote into
 * `session/SessionProvider.tsx` and nowhere else, so the team never saw the application and a
 * reload took it away (QA review of 09.10.2026, row 4). Both buttons send since T5, and draw what
 * `GET /api/me/applications` answers (`pages/AskingThisTeam.tsx`), so the walk went to
 * `pages/teamJoinOnTheServer.test.tsx`, where each claim this file made is read off the socket:
 *
 * - offered inside the window to somebody with no team, and asked once: „asks THIS team, once";
 * - not offered on a second team while one application waits: „is not offered while an
 *   application stands on another team";
 * - taken back by the member who sent it, after the window has shut and after he has come by a
 *   team by another road: the three cases under „Povuci prijavu";
 * - taken back by its own identity and not by whichever was filed first: „takes back his
 *   application to THIS team, and not the first he has";
 * - no longer counted once the team it was sent to is gone: „counts no application to a team the
 *   list no longer has";
 * - not offered outside the window, to somebody already in a team, on a team nobody is in, or to
 *   a visitor: the cases under „who is offered".
 *
 * WHAT STAYS is the one thing about the prototype's list that is not a screen: the identities it
 * hands out. Nothing on the portal files or answers an application in the session any more
 * (`session/context.ts` says so where the three are declared), but the list and its two writers
 * are in the bundle until the cleanup item SC takes them away, and an identity handed out twice is
 * a fault whether a screen reaches it today or not. So it is driven here by probes, which is all
 * that ever called it besides the two buttons.
 */

describe("the prototype's list of applications", () => {
  it('takes back one by its own identity, and never hands a live identity out twice', async () => {
    /* **Two applications answered to one identity** while the identity was counted from how many
       there are, and `answer` shortens that very list (review, 06.09.2026); and taking one back by
       its position rather than by its identity closes a question somebody else asked.

       Three members ask, and the one taken back is the MIDDLE one, so neither the first row nor
       the last is the right answer by accident. Then the one taken back asks again: counted from
       how many there are, he is handed the identity 000008 still holds, and taking 000008's back
       takes his with it. */
    const user = setupUser()

    renderAt(
      '/sr',
      'competitor',
      '000002',
      undefined,
      '2026-10-15',
      <>
        <Also who="000002" team={1} />
        <Also who="000004" team={3} />
        <Also who="000008" team={2} />
        <Answered who="000004" />
        <Answered who="000008" />
        <Asked />
      </>,
    )

    const open = () => within(screen.getByRole('list', { name: 'open applications' }))

    await user.click(await screen.findByRole('button', { name: 'prijavi 000002' }))
    await user.click(screen.getByRole('button', { name: 'prijavi 000004' }))
    await user.click(screen.getByRole('button', { name: 'prijavi 000008' }))
    await user.click(screen.getByRole('button', { name: 'odgovori 000004' }))

    expect(open().getByText(/000002/)).toBeVisible()
    expect(open().getByText(/000008/)).toBeVisible()
    expect(open().queryByText(/000004/)).toBeNull()

    await user.click(screen.getByRole('button', { name: 'prijavi 000004' }))
    await user.click(screen.getByRole('button', { name: 'odgovori 000008' }))

    expect(open().getByText(/000004/)).toBeVisible()
    expect(open().getByText(/000002/)).toBeVisible()
    expect(open().queryByText(/000008/)).toBeNull()
  })
})

/** An application filed the way the team's page filed one until T5, on behalf of a member who
 *  need not be the one reading. The day is one no case reads. */
function Also({ who, team }: { who: string; team: number }) {
  const { apply } = useSession()

  return (
    <button
      type="button"
      onClick={() => {
        apply({ teamId: team, memberNumber: who, date: '2026-10-15' })
      }}
    >
      prijavi {who}
    </button>
  )
}

/** That member's applications answered, the way the team answered one: by the identity each
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
