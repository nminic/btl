import { screen, within } from '@testing-library/react'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useSession } from '../session/useSession'

/* „Pozovi u tim", from the press to the answer.
 *
 * The other half of „Prijavi se u tim", and deliberately not its mirror. An application waits
 * on the team's own page, because whoever leads a team may change between the question and the
 * answer and the portal works that out each time it draws. An invitation names one person who
 * cannot change, and that person has no reason to open the team's page at all, so it reaches
 * them in their inbox (PDL, „Gde stoji odluka", 06.09.2026).
 *
 * Everything here is walked on the screens, in one visit, because every half of it is about
 * what somebody else sees: the press is on one member's profile, the answer is in another
 * member's mail, and the notice is in a third member's.
 */

/** The reader becomes somebody else inside one visit. */
function Become({ who }: { who: string }) {
  const { signIn } = useSession()

  return (
    <button type="button" onClick={() => { signIn(who) }}>
      postani {who}
    </button>
  )
}

/** Administration taking somebody out of their team, which is the one road by which a team
 *  loses its last member: `AdminTeams` writes exactly this when a team is deleted, and a
 *  member's own form writes it when a moderator moves them. Written as a probe rather than
 *  walked through the administration screens, because what is measured is what the invitation
 *  does about it, not how the record got that way. */
function Empty({ team }: { team: string[] }) {
  const { editRecord } = useSession()

  return (
    <button type="button" onClick={() => { for (const who of team) { editRecord(who, { teamId: '' }) } }}>
      isprazni {team.join(' ')}
    </button>
  )
}

/** A team deleted during the visit, which is what its own page does when somebody presses
 *  „Obriši". Its members lose the team on their records; what it does not touch is an
 *  invitation it had already sent. */
function Delete({ team }: { team: string }) {
  const { remove } = useSession()

  return (
    <button type="button" onClick={() => { remove('teams', team) }}>
      obriši {team}
    </button>
  )
}

/* 000001 Vladan Đurišić and 000007 Strahinja Vukićević are both in Dunavski trkači, 000003
   Anđelija Vukotić leads Vardar, and 000002 Relja Momčilović and 000004 Časlav Radenković have
   no team at all. Read off `public/mock/competitors.json` rather than remembered. */
const FREE = '/sr/takmicar/000002-relja-momcilovic'
const OTHER_FREE = '/sr/takmicar/000004-caslav-radenkovic'
const TAKEN = '/sr/takmicar/000007-strahinja-vukicevic'
const IN_WINDOW = '2026-10-15'
const OUTSIDE = '2026-06-15'

/** Every message in the panel in the header, which is the one place a message is a link:
 *  the list at `/sr/poruke` writes each one out whole and links to none of them. Newest
 *  first, the way the panel draws them. */
async function inbox(user: ReturnType<typeof setupUser>) {
  await user.click(await screen.findByRole('button', { name: /Otvori poruke/ }))

  return screen.queryAllByRole('link').filter((one) => /\/poruke\/msg-/.test(one.getAttribute('href') ?? ''))
}

/** The line under the name on a profile, whole. The club is a sentence there and the same
 *  name is also in the header panel, which keeps its messages in the document after it is
 *  closed: read across the whole document, „is he in Dunavski trkači" is answered by the
 *  invitation he was sent. */
function clubLine(): string {
  return must(
    screen.getByText(/Članski broj/).closest('p'),
    'the line under the name',
  ).textContent ?? ''
}

/** The one invitation waiting, opened. */
async function openTheInvitation(user: ReturnType<typeof setupUser>) {
  const waiting = (await inbox(user)).filter((one) => /Poziv u tim/.test(one.textContent ?? ''))

  await user.click(must(waiting[0], 'an invitation in the inbox'))
}

describe('who is offered „Pozovi u tim"', () => {
  it('is offered to any member of a team, on the profile of somebody who has none', async () => {
    renderAt(FREE, 'competitor', '000007', undefined, IN_WINDOW)

    /* 000007 does not lead Dunavski trkači; 000001 has been in it since 2014 and does. The
       owner's parenthesis on 05.09.2026 was „(bilo koji član)", so this case is walked as the
       member who is not the administrator on purpose: read as an administrator's act, it would
       still pass while the rule it enforces had gone. */
    expect(await screen.findByRole('button', { name: 'Pozovi u tim' })).toBeVisible()
  })

  it('is not offered by a member who has no team of their own', async () => {
    renderAt(TAKEN, 'competitor', '000002', undefined, IN_WINDOW)

    expect(await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pozovi u tim' })).toBeNull()
  })

  it('is not offered about somebody who already has a team', async () => {
    renderAt(TAKEN, 'competitor', '000003', undefined, IN_WINDOW)

    expect(await screen.findByRole('heading', { level: 1, name: /Strahinja Vukićević/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pozovi u tim' })).toBeNull()
  })

  it('is not offered outside the transfer window', async () => {
    renderAt(FREE, 'competitor', '000007', undefined, OUTSIDE)

    expect(await screen.findByRole('heading', { level: 1, name: /Relja Momčilović/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pozovi u tim' })).toBeNull()
  })

  it('is not offered to a visitor', async () => {
    renderAt(FREE, 'visitor', null, undefined, IN_WINDOW)

    expect(await screen.findByRole('heading', { level: 1, name: /Relja Momčilović/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pozovi u tim' })).toBeNull()
  })

  it('is not offered a second time by the same team to the same person', async () => {
    const user = setupUser()

    renderAt(FREE, 'competitor', '000007', undefined, IN_WINDOW)

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    /* **An application cannot be doubled and an invitation can.** The button that files an
       application is drawn only while the member has none waiting anywhere, and the member is
       the one pressing it. An invitation is sent without the other person saying anything, so
       without this the same team could fill the same inbox with the same question every day
       (PDL, 06.09.2026). */
    expect(screen.queryByRole('button', { name: 'Pozovi u tim' })).toBeNull()
    expect(screen.getByText(/Poziv u tim „Dunavski trkači" je poslat/)).toBeVisible()
  }, SLOW)
})

describe('what the invitation does', () => {
  it('reaches the invited member as a message with two answers, and nobody else', async () => {
    const user = setupUser()

    renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Become who="000004" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    /* Somebody who was not asked, first, so „there is a message" cannot be answered by a
       message the portal writes to everybody. 000004 has no team either, which is what makes
       him the right third party: he differs from the invited member in nothing but having been
       asked. */
    await user.click(screen.getByRole('button', { name: 'postani 000004' }))

    expect(
      (await inbox(user)).filter((one) => /Poziv u tim/.test(one.textContent ?? '')),
    ).toEqual([])

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheInvitation(user)

    expect(await screen.findByRole('button', { name: 'Prihvati' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Odbij' })).toBeVisible()
  }, SLOW)

  it('puts the member in the team from the next season when it is accepted', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Become who="000007" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheInvitation(user)
    await user.click(await screen.findByRole('button', { name: 'Prihvati' }))

    expect(await screen.findByText(/Prihvatio\/la si ovaj poziv/)).toBeVisible()

    /* And the team stops counting it among the questions it is waiting on. The record is
       kept, so that the sentence above can name the team that asked; what makes it stop
       being an open question is that the person it names now has a team. */
    await user.click(screen.getByRole('button', { name: 'postani 000007' }))
    await router.navigate('/sr/tim/dunavski-trkaci')

    expect(await screen.findByRole('heading', { level: 1, name: /Dunavski trkači/ })).toBeVisible()
    expect(screen.queryByRole('list', { name: 'Poslati pozivi' })).toBeNull()

    /* Read on his own profile rather than on the team's, because the team's page draws a
       season's roster and the season he joins from is the next one: 2027 while the portal is
       read as October 2026. The profile says which club he is in and from when, which is the
       whole of what was written. */
    await router.navigate(FREE)

    expect(await screen.findByRole('heading', { level: 1, name: /Relja Momčilović/ })).toBeVisible()

    /* The season is the next one and not the running one, which is the whole of the second
       half: read as October 2026, a member taken in runs for the club from 2027 (PDL,
       05.09.2026). Read off the line rather than off the page, so „2027" cannot be answered by
       a result, a season control or the invitation still sitting in the header panel. */
    expect(clubLine()).toContain('U klubu Dunavski trkači od 2027.')
  }, SLOW)

  it('writes nothing when it is refused, and says so where the buttons were', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <Become who="000002" />,
    )

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheInvitation(user)
    await user.click(await screen.findByRole('button', { name: 'Odbij' }))

    /* The message stays: deleting somebody's mail would delete the answer to „what happened to
       that invitation" (PDL, 06.09.2026). What goes is the pair of buttons. */
    expect(await screen.findByText(/Odbio\/la si ovaj poziv/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()

    await router.navigate(FREE)

    expect(
      await screen.findByRole('heading', { level: 1, name: /Relja Momčilović/ }),
    ).toBeVisible()
    expect(clubLine()).toContain('Bez tima')
  }, SLOW)
})

describe('a member who is asked by more than one team', () => {
  it('stops offering „Prihvati" on the other invitation once one is accepted', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000003" />
        <Become who="000002" />
      </>,
    )

    /* Dunavski trkači ask first, then Vardar through one of its own members, so the two
       invitations differ in the team as well as in the identity: the same team asking twice is
       refused a few cases above, and it is the wrong shape for this question. */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))
    await router.navigate(FREE)
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))

    const both = (await inbox(user)).filter((one) => /Poziv u tim/.test(one.textContent ?? ''))

    expect(both).toHaveLength(2)

    /* Newest first, so the one Dunavski trkači sent is last. */
    await user.click(must(both[1], 'the invitation Dunavski trkači sent'))
    await user.click(await screen.findByRole('button', { name: 'Prihvati' }))

    const after = (await inbox(user)).filter((one) => /Poziv u tim/.test(one.textContent ?? ''))

    await user.click(must(after[0], 'the invitation Vardar sent, which nobody answered'))

    /* **The right to answer is worked out when the message is drawn, not remembered on it.**
       Three teams may ask the same person on the same day and none of them knows about the
       others, so „already answered" cannot be a flag on any one of them (PDL, 06.09.2026). */
    expect(await screen.findByText(/U međuvremenu si ušao\/la u tim/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()
  }, SLOW)

  it('tells the team that was left waiting, and not the team that was joined', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000003" />
        <Become who="000002" />
        <Become who="000001" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))
    await router.navigate(FREE)
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))

    const both = (await inbox(user)).filter((one) => /Poziv u tim/.test(one.textContent ?? ''))

    await user.click(must(both[1], 'the invitation from Dunavski trkači'))
    await user.click(await screen.findByRole('button', { name: 'Prihvati' }))

    /* **To whoever leads the team now, worked out from its roster.** 000003 leads Vardar and
       also pressed „Pozovi", so this case cannot tell „the leader" from „whoever typed" on its
       own; what it can say is that the notice went to the team that was left waiting and not
       to the one that was joined. 000001 leads Dunavski trkači and is the third party here:
       he was never asked anything and must be told nothing. */
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))

    expect(
      (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? '')),
    ).toEqual([])

    await user.click(screen.getByRole('button', { name: 'postani 000003' }))

    expect(
      (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? '')),
    ).toHaveLength(1)
  }, SLOW)
})

describe('what the team sees of what it sent', () => {
  it('lists the invitations it has open, to its own members', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000003" />
        <Become who="000007" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    /* And a second question, from another team and about another person, so „this list has a
       row" cannot be answered by whatever invitation the portal happens to hold. Anđelija
       leads Vardar and asks Časlav, who like Relja has no team of his own. */
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))
    await router.navigate(OTHER_FREE)
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    /* Read back as somebody in Dunavski trkači, because the list is drawn to the team's own
       members and to nobody else. */
    await user.click(screen.getByRole('button', { name: 'postani 000007' }))
    await router.navigate('/sr/tim/dunavski-trkaci')

    expect(await screen.findByRole('heading', { level: 1, name: /Dunavski trkači/ })).toBeVisible()

    /* **The team does not depend on somebody else's inbox.** The invitation is decided in the
       invited member's mail, but a team that can see its questions only by asking the person it
       asked cannot tell a question nobody answered from one never sent (PDL, 06.09.2026). */
    const sent = await screen.findByRole('list', { name: 'Poslati pozivi' })

    expect(within(sent).getByText(/Relja Momčilović/)).toBeVisible()
    expect(within(sent).queryByText(/Časlav Radenković/)).toBeNull()

    /* Anđelija leads Vardar and is in no way part of Dunavski trkači, so what one team asked is
       not something every member of every team reads. */
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))
    await router.navigate('/sr/tim/dunavski-trkaci')

    expect(await screen.findByRole('heading', { level: 1, name: /Dunavski trkači/ })).toBeVisible()
    expect(screen.queryByRole('list', { name: 'Poslati pozivi' })).toBeNull()
  }, SLOW)
})

describe('what is left when a team goes away', () => {
  it('stops offering „Pozovi u tim" to somebody whose team has just been emptied', async () => {
    const user = setupUser()

    renderAt(FREE, 'competitor', '000007', undefined, IN_WINDOW, <Empty team={['000007']} />)

    expect(await screen.findByRole('button', { name: 'Pozovi u tim' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'isprazni 000007' }))

    /* **The record is what says who is in a team, and this screen reads it each time.**
       Written against the identity alone it would go on offering the button to somebody who
       is in no team, and the press would file an invitation from a team they left. */
    expect(screen.queryByRole('button', { name: 'Pozovi u tim' })).toBeNull()
  }, SLOW)

  it('says so, instead of two buttons, when the team that asked is gone', async () => {
    const user = setupUser()

    renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Delete team="team-dunav" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'obriši team-dunav' }))
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheInvitation(user)

    /* A team that is no longer there cannot take anybody in, and „Prihvati" would write a
       team on the record that names nothing. The message stays and says what happened, which
       is what every other closed invitation does. */
    expect(await screen.findByText(/Tim koji te je pozvao više ne postoji/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()
  }, SLOW)

  it('tells nobody about a missed invitation when the team that sent it has emptied', async () => {
    const user = setupUser()

    const { router } = renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000003" />
        <Become who="000002" />
        <Empty team={['000003', '000009', '000015', '000021', '000027']} />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))
    await router.navigate(FREE)
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    /* Vardar loses both of its members after it has asked. Its question is still open and
       nobody is left to be told about it: „Tim koji nema nijednog člana ne dobija poruku,
       jer nema kome" (PDL, 06.09.2026). Without this the notice is addressed to nobody and
       lands in the inbox of every member of the league, because an empty address is the
       league (`Message.to`). */
    await user.click(
      screen.getByRole('button', { name: 'isprazni 000003 000009 000015 000021 000027' }),
    )
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))

    const both = (await inbox(user)).filter((one) => /Poziv u tim/.test(one.textContent ?? ''))

    await user.click(must(both[1], 'the invitation Dunavski trkači sent'))
    await user.click(await screen.findByRole('button', { name: 'Prihvati' }))

    /* **Read in the inbox the notice would have gone to, not in the invited member's.**
       Anđelija sent Vardar's invitation and leads it while it has anybody in it, so she is
       the one who is told in the case above and the one who must be told nothing here. Read
       in Relja's inbox instead, this would pass whether the notice was sent or not, because
       it never goes to him either way.

       All five of Vardar's members are cleared and not two: with three left the team still
       has somebody at its head, the notice goes out, and the case says „nobody was told"
       while somebody was (measured, 06.09.2026). */
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))

    expect(
      (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? '')),
    ).toEqual([])
  }, SLOW)
})
