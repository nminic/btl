import { screen, within } from '@testing-library/react'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'
import { useClock } from '../clock/useClock'
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

/** The day the portal is read as, moved inside one visit. The portal has its own control for
 *  this (`clock/useClock`), and the invitation has to be answered on a different day from the
 *  one it was sent on: sent and read on one day, „is the window open" and „was it open when
 *  this was sent" are the same question and the case says nothing about either. */
function Day({ on }: { on: string }) {
  const { simulate } = useClock()

  return (
    <button type="button" onClick={() => { simulate(on) }}>
      danas je {on}
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

/** Every message in the panel in the header, newest first, the way the panel draws them.
 *
 *  Read by the address the link carries rather than by where it stands, because since
 *  06.09.2026 the list at `/sr/poruke` carries the same links: on that address this returns
 *  both sets and a case that means „the panel" has to say so itself. Everywhere else it is the
 *  panel alone, because nothing else on the portal links to a message. */
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
    /* On the profile of somebody who **also** has no team, so only one of the two conditions
       can be the reason. Read on a member who has one, both fall at once and the case is
       satisfied by the wrong one: it would go on passing while „a member with no team may
       invite in the name of some team" was true (review, 06.09.2026). */
    renderAt(OTHER_FREE, 'competitor', '000002', undefined, IN_WINDOW)

    expect(await screen.findByRole('heading', { level: 1, name: /Časlav Radenković/ })).toBeVisible()
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

  it('is still offered by the same team about somebody else', async () => {
    const user = setupUser()
    const { router } = renderAt(FREE, 'competitor', '000007', undefined, IN_WINDOW)

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await router.navigate(OTHER_FREE)

    /* **The other half of „not twice", and without it the rule reads „once, ever".** The case
       above has one team, one person and one invitation, so it cannot tell „this team already
       asked **this person**" from „this team already asked". Measured 06.09.2026: dropping the
       member from that comparison leaves everything green, and a club that has invited anybody
       can never invite again. */
    expect(await screen.findByRole('button', { name: 'Pozovi u tim' })).toBeVisible()
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
    expect(await screen.findByText(/Ovaj poziv više ne stoji/)).toBeVisible()
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

    const sent = (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? ''))

    expect(sent).toHaveLength(1)

    /* And what it says, which is the only thing it carries. Written from what this door has in
       hand, and this door has different things in hand from the other two. */
    await user.click(must(sent[0], 'the notice Vardar was sent'))

    expect(
      await screen.findByText(/Relja Momčilović je u međuvremenu ušao\/la u tim „Dunavski trkači"/),
    ).toBeVisible()
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

describe('the transfer window holds the answer as well as the question', () => {
  it('does not offer „Prihvati" once the window has shut, and says the invitation waits', async () => {
    const user = setupUser()

    renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Day on="2027-01-05" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheInvitation(user)

    expect(await screen.findByRole('button', { name: 'Prihvati' })).toBeVisible()

    /* **Five days into the new season, and the door is shut.** Everything that changes a squad
       goes through one window (PDL, 05.09.2026), so the offer is not made outside it; what the
       season written would be is a separate question and lives in `transfersTakeEffect`. Until
       06.09.2026 neither held, and pressing here put somebody into a squad in the middle of a
       season (review, same day). */
    await user.click(screen.getByRole('button', { name: 'danas je 2027-01-05' }))

    expect(await screen.findByText(/Poziv čeka/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()

    /* **„Odbij" stays.** Refusing writes nothing about any squad; held by the window too, a
       member asked on 30 December could neither take the offer nor be rid of it until the
       following October, while the club kept them on its list of open questions the whole
       time (review, 06.09.2026). */
    expect(screen.getByRole('button', { name: 'Odbij' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Odbij' }))

    expect(await screen.findByText(/Ovaj poziv više ne stoji/)).toBeVisible()
  }, SLOW)
})

describe('the third door writes the season the other two write', () => {
  it('puts a founder in their club from the season that has not begun, even when approved late', async () => {
    const user = setupUser()
    const { router } = renderAt(
      '/sr/novi-tim',
      'superadmin',
      '000002',
      undefined,
      IN_WINDOW,
      <Day on="2027-01-05" />,
    )

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    /* **Sent in the window and decided five days into the next season**, which is the moderator's
       own day and not the member's. Until 06.09.2026 the season written came out of „what is
       being sold", which outside the window answers with the season that is **running**: the
       founder went into a squad in the middle of a season and the club counted their results
       from that moment (PDL 05.09.2026, „Obračun bodova tima počinje 1. januara naredne
       sezone"; review, same day).

       What it writes now is the first season that has not begun, which is what the other two
       doors write and what the concept is called (`transfersTakeEffect`). */
    await user.click(screen.getByRole('button', { name: 'danas je 2027-01-05' }))
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Trkači Morave' })
    const card = within(must(heading.closest('li'), 'the card the proposal stands on'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))
    await router.navigate(FREE)

    expect(await screen.findByRole('heading', { level: 1, name: /Relja Momčilović/ })).toBeVisible()
    expect(clubLine()).toContain('U klubu Trkači Morave od 2028.')
  }, SLOW)
})

describe('which day the answer is read off', () => {
  it('writes the season of the day it is answered, not of the day it was sent', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Day on="2027-10-15" />
      </>,
    )

    /* **Two windows apart, which is the only setup that separates the two days.** A portal
       read on the day the invitation was sent gives the same answer whichever day the season
       is read off, so every case until now was satisfied by either: measured 06.09.2026,
       `transfersTakeEffect(invitation.date)` left the whole package green.

       The state is one the portal deliberately allows: „Poziv van roka čeka, ne propada... 1.
       oktobra se dugme vraća samo od sebe" (PDL, 06.09.2026). Sent in the 2026 window,
       answered in the 2027 one, the member runs for the club from 2028. Read off the day it
       was sent it would be 2027, a season already run from end to end, and the club would
       count every result that member has. */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'danas je 2027-10-15' }))
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheInvitation(user)
    await user.click(await screen.findByRole('button', { name: 'Prihvati' }))

    await router.navigate(FREE)

    expect(await screen.findByRole('heading', { level: 1, name: /Relja Momčilović/ })).toBeVisible()
    expect(clubLine()).toContain('U klubu Dunavski trkači od 2028.')
  }, SLOW)

  it('dates the notice by the day it is sent, not by the day the invitation was', async () => {
    const user = setupUser()

    renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000003" />
        <Become who="000002" />
        <Day on="2027-10-15" />
        <Day on="2027-11-20" />
      </>,
    )

    /* The notice to the club left waiting carries a day, and it is drawn in the panel and in
       „Sve poruke". Read off the invitation it answers rather than off the clock, a thing that
       happened in October 2027 is filed under October 2026 (review, 06.09.2026). Same two
       windows, because on one day the two are the same string. */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'danas je 2027-10-15' }))
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))

    const both = (await inbox(user)).filter((one) => /Poziv u tim „/.test(one.textContent ?? ''))

    await user.click(must(both[1], 'the invitation Dunavski trkači sent'))
    await user.click(await screen.findByRole('button', { name: 'Prihvati' }))

    /* Read on a **third** day, so the day the notice carries is not also the day the panel is
       drawn on: written the same day, „the message's day" and „today" are one string and the
       assertion would pass on a panel that drew the clock (review, 06.09.2026). */
    await user.click(screen.getByRole('button', { name: 'danas je 2027-11-20' }))
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))

    const told = (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? ''))

    expect(must(told[0], 'the notice Vardar was sent').textContent).toContain('15. 10. 2027.')
  }, SLOW)

  it('dates a sent invitation by the day it was sent, not by the day the page is read', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <Day on="2026-12-20" />,
    )

    /* The club reads its own open questions, and each carries the day it asked. Read off the
       clock instead, a club opening the page in December is told it asked somebody today,
       whom it asked in October: the right answer and the wrong one are the same string on
       every case that reads the page on the day it sent (review, 06.09.2026). The row for an
       application a few lines above has this case written for the same reason
       (`teamJoin.test.tsx`). */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'danas je 2026-12-20' }))

    /* A second question, two months later and about somebody else. */
    await router.navigate(OTHER_FREE)
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await router.navigate('/sr/tim/dunavski-trkaci')

    /* **Two rows, and each has to carry its own two facts.** With one open question „the day of
       this row" and „the day of the first row" are the same string, so both fields could be read
       off the first record and the page would still pass: measured 06.09.2026, both mutations
       left the whole package green. Relja was asked in October and Časlav in December, so the
       two rows differ in the name and in the day at once. */
    const rows = within(await screen.findByRole('list', { name: 'Poslati pozivi' })).getAllByRole(
      'listitem',
    )

    expect(rows).toHaveLength(2)

    const said = rows.map((row) => row.textContent ?? '')

    expect(said.filter((one) => /Relja Momčilović/.test(one) && /15\. 10\. 2026\./.test(one))).toHaveLength(1)
    expect(said.filter((one) => /Časlav Radenković/.test(one) && /20\. 12\. 2026\./.test(one))).toHaveLength(1)
  }, SLOW)
})

describe('the day the notice carries, on the other two doors', () => {
  it('dates it by the day the club took the member in, not by the day they applied', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000003',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Become who="000001" />
        <Become who="000003" />
        <Day on="2027-10-15" />
        <Day on="2027-11-20" />
      </>,
    )

    /* **The same axis as on the door through the inbox, and `afterJoining` is why it has to be
       written three times rather than once.** The rule that decides who is told lives in one
       module; the day each door writes does not, and each writes it from something of its own.
       Measured 06.09.2026: the notice on this door dated by the application it answers rather
       than by the clock left the whole package green.

       Vardar asks Relja in the 2026 window. Relja applies to Dunavski trkači the same day, the
       window shuts with nothing agreed, and they take him in a year later. The notice Vardar
       gets is about something that happened in October 2027. */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await router.navigate('/sr/tim/dunavski-trkaci')
    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))

    await user.click(screen.getByRole('button', { name: 'danas je 2027-10-15' }))
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))
    await router.navigate('/sr/tim/dunavski-trkaci')
    await user.click(await screen.findByRole('button', { name: /^Primi u tim: Relja/ }))

    await user.click(screen.getByRole('button', { name: 'danas je 2027-11-20' }))
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))

    const told = (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? ''))

    expect(must(told[0], 'the notice Vardar was sent').textContent).toContain('15. 10. 2027.')
  }, SLOW)

  it('dates it by the day the proposal was approved, not by the day it was sent', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'superadmin',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Become who="000001" />
        <Become who="000007" />
        <Day on="2027-01-05" />
        <Day on="2027-02-10" />
      </>,
    )

    /* And the third door, for the same reason. A proposal sent inside the window and approved
       after it is a state the queue allows on purpose, and the notice is about the approval. */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await router.navigate('/sr/novi-tim')

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await user.click(screen.getByRole('button', { name: 'danas je 2027-01-05' }))
    await user.click(screen.getByRole('button', { name: 'postani 000007' }))
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Trkači Morave' })
    const card = within(must(heading.closest('li'), 'the card the proposal stands on'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))

    await user.click(screen.getByRole('button', { name: 'danas je 2027-02-10' }))
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))

    const told = (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? ''))

    /* Whole, and not as a piece of a longer day: „5. 1. 2027." is inside „15. 1. 2027.", so a
       notice ten days late would satisfy `toContain` (review, 06.09.2026). Nothing in this walk
       can produce that day, which is why it is a doubt rather than a fault; it costs one
       boundary to remove it. */
    expect(must(told[0], 'the notice Dunavski trkači were sent').textContent).toMatch(
      /(?<!\d)5\. 1\. 2027\./,
    )
  }, SLOW)
})

describe('a team is told whichever road the member took in', () => {
  it('tells the team that was waiting when the member is taken in on their own application', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000003',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Become who="000001" />
        <Become who="000003" />
        <Become who="000009" />
      </>,
    )

    /* Vardar asks Relja, and Relja meanwhile applies to Dunavski trkači and is taken in there.
       The owner's sentence is „kad član uđe u tim (ko god da je poslao poziv)", so this road
       owes exactly what accepting an invitation owes: Vardar's question ends and Vardar is
       told (PDL, 06.09.2026). Until then the notice was written at one of the three doors and
       the other two were silent. */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await router.navigate('/sr/tim/dunavski-trkaci')
    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000001' }))
    await router.navigate('/sr/tim/dunavski-trkaci')
    await user.click(await screen.findByRole('button', { name: /^Primi u tim: Relja/ }))

    /* **Nobody who was not meant to be told, first.** An empty address is the league talking
       to everybody (`Message.to`), so a notice addressed to nobody lands in every signed-in
       member's inbox and „the club that was waiting was told" is satisfied by that same
       message: measured 06.09.2026, `to: ''` on this door left the whole package green while
       the same mutation fell on the other two. Milica is in Vardar and does not lead it, so
       she separates two axes at once — the whole league, and any member of the club rather
       than the one who leads it. */
    await user.click(screen.getByRole('button', { name: 'postani 000009' }))

    expect(
      (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? '')),
    ).toEqual([])

    await user.click(screen.getByRole('button', { name: 'postani 000003' }))

    const told = (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? ''))

    expect(told).toHaveLength(1)

    /* And the notice says who left and where they went, which is the whole of what it carries.
       Read on the message itself, because the panel shows only the subject and the subject has
       no value in it at all. */
    await user.click(must(told[0], 'the notice Vardar was sent'))

    expect(
      await screen.findByText(/Relja Momčilović je u međuvremenu ušao\/la u tim „Dunavski trkači"/),
    ).toBeVisible()
  }, SLOW)

  it('leaves nothing open on the team page after the member is taken in elsewhere', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000003',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Become who="000001" />
        <Become who="000009" />
      </>,
    )

    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await router.navigate('/sr/tim/dunavski-trkaci')
    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000001' }))
    await router.navigate('/sr/tim/dunavski-trkaci')
    await user.click(await screen.findByRole('button', { name: /^Primi u tim: Relja/ }))

    /* 000009 is in Vardar and does not lead it, which is the point: the list is drawn to every
       member of the team, so a question that has ended must be gone for all of them and not
       only for whoever was told. */
    await user.click(screen.getByRole('button', { name: 'postani 000009' }))
    await router.navigate('/sr/tim/vardarski-krug')

    expect(await screen.findByRole('heading', { level: 1, name: /Vardar/ })).toBeVisible()
    expect(screen.queryByRole('list', { name: 'Poslati pozivi' })).toBeNull()
  }, SLOW)
})

describe('the third door, and the team that was joined', () => {
  it('tells the team that was waiting when a moderator approves the team the member proposed', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'superadmin',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Become who="000003" />
        <Become who="000001" />
      </>,
    )

    /* Dunavski trkači ask Relja, and Relja meanwhile founds a club of his own. Approving the
       proposal writes the team on his record exactly as the other two doors do
       (`admin/PendingQueue.tsx`), so it owes the same: the question Dunavski trkači are waiting
       on has ended, and they are told. Walked as a superadmin because the walk crosses into
       the administration, which is shut to a competitor. */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await router.navigate('/sr/novi-tim')

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    await screen.findByRole('heading', { name: 'Predlog je poslat' })
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Trkači Morave' })
    const card = within(must(heading.closest('li'), 'the card the proposal stands on'))

    await user.click(card.getByRole('button', { name: 'Odobri' }))

    /* **Who was told, first**, because a case that only says who was not told passes just as
       well when nobody was told at all. 000007 sent the invitation but 000001 leads Dunavski
       trkači, so this also says the notice goes to the role and not to whoever typed. */
    await user.click(screen.getByRole('button', { name: 'postani 000001' }))

    expect(
      (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? '')),
    ).toHaveLength(1)

    /* And two people who have nothing to do with it: Anđelija leads another club entirely, and
       Relja is the one who left rather than the one who was left. */
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))

    expect(
      (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? '')),
    ).toEqual([])

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))

    expect(
      (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? '')),
    ).toEqual([])
  }, SLOW)

  it('names the member and the club they went to, on the road through the queue', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'superadmin',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Become who="000001" />
        <Become who="000007" />
      </>,
    )

    /* The body carries the only two facts the notice has, and each of the three doors writes
       them from something different. Read on one door only, the other two may write anything:
       measured 06.09.2026, both `{ name: '', team: '' }` mutations left the whole package
       green. This is the door through the moderator's queue; the one through the team's page
       is read a few cases above. */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await router.navigate('/sr/novi-tim')

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    await screen.findByRole('heading', { name: 'Predlog je poslat' })
    await router.navigate('/sr/administracija/verifikacija/timovi')

    const heading = await screen.findByRole('heading', { name: 'Trkači Morave' })
    const card = within(must(heading.closest('li'), 'the card the proposal stands on'))

    /* **The proposal is approved by somebody else**, because the sentence names whoever went
       into the club and this door has two people in hand: the member on the queue item and the
       member at the keyboard. Approved by the same person, those two are one string and the
       case says nothing about which of them is written: measured 06.09.2026, reading the name
       off the session instead of off the queue item left the whole package green, and every
       waiting club would have been told that the moderator had joined a club. */
    await user.click(screen.getByRole('button', { name: 'postani 000007' }))
    await user.click(card.getByRole('button', { name: 'Odobri' }))

    await user.click(screen.getByRole('button', { name: 'postani 000001' }))

    const told = (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? ''))

    await user.click(must(told[0], 'the notice Dunavski trkači were sent'))

    expect(
      await screen.findByText(/Relja Momčilović je u međuvremenu ušao\/la u tim „Trkači Morave"/),
    ).toBeVisible()
  }, SLOW)

  it('does not tell the team the member has just joined about its own invitation', async () => {
    const user = setupUser()
    const { router } = renderAt(
      FREE,
      'competitor',
      '000007',
      undefined,
      IN_WINDOW,
      <>
        <Become who="000002" />
        <Become who="000001" />
      </>,
    )

    /* Dunavski trkači ask Relja **and** Relja applies to Dunavski trkači, and then they take
       him in on the application. Their own question ended by being answered, so a notice saying
       „he went somewhere else" would be the club told about itself. Every other case has the
       inviting team and the joined team be different clubs, so this axis is measured nowhere
       else (measured 06.09.2026: without it, removing that one condition changes nothing). */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await router.navigate('/sr/tim/dunavski-trkaci')
    await user.click(await screen.findByRole('button', { name: 'Prijavi se u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000001' }))
    await router.navigate('/sr/tim/dunavski-trkaci')
    await user.click(await screen.findByRole('button', { name: /^Primi u tim: Relja/ }))

    expect(
      (await inbox(user)).filter((one) => /ostao bez odgovora/.test(one.textContent ?? '')),
    ).toEqual([])
  }, SLOW)
})

describe('the way to the answer', () => {
  it('opens from the list of all messages, not only from the panel in the header', async () => {
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
    await router.navigate('/sr/poruke')

    /* **„Sve poruke" is where the panel sends a member who wants to read properly.** It wrote
       every message out whole and linked to none of them, which was enough while every message
       told something; one of them now asks, and a member who read „Tim te poziva" here had no
       way to answer and no way to reach the screen that has one (review, 06.09.2026).

       Read inside the list itself, because the panel in the header keeps its own links in the
       document and would answer this on its own. */
    const list = within(await screen.findByRole('list'))

    await user.click(list.getByRole('link', { name: /Poziv u tim/ }))

    expect(await screen.findByRole('button', { name: 'Prihvati' })).toBeVisible()
  }, SLOW)
})

describe('what the invitation must not be confused with', () => {
  it('never hands a refused invitation to the next person the team asks', async () => {
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
    await user.click(await screen.findByRole('button', { name: 'Odbij' }))

    /* The list of open invitations has just shortened, and the next identity is counted from
       the highest ever given rather than from how many there are (`SessionProvider`). Counted,
       the second invitation is handed the identity the refused one still names: Relja's own
       refused message offers „Prihvati" again and pressing it puts **Časlav** in the club
       (review, 06.09.2026). */
    await user.click(screen.getByRole('button', { name: 'postani 000007' }))
    await router.navigate(OTHER_FREE)
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheInvitation(user)

    expect(await screen.findByText(/Ovaj poziv više ne stoji/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()
  }, SLOW)

  it('leaves every message that is not an invitation exactly as it was', async () => {
    const user = setupUser()

    renderAt('/sr/poruke', 'competitor', '000007')

    /* The plan for this increment named this as the likeliest fault of the lot: every message
       the portal has ever written is a message that tells, and drawing the answer unless a
       message says otherwise puts two buttons under all of them. Walked on the messages the
       prototype starts with, which carry no invitation at all. */
    const first = (await inbox(user))[0]

    await user.click(must(first, 'the first message in the inbox'))

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()
    expect(screen.queryByText(/poziv/i)).toBeNull()
  }, SLOW)

  it('ends the other clubs\' questions for good, and not only while the member has a club', async () => {
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
        <Delete team="team-dunav" />
      </>,
    )

    /* **Closing has to be measured where having a club stops covering for it.** Every other
       case reads the other invitation while the member is in a club, and there the message
       says „you joined elsewhere" whether the record was closed or not: the sentence is chosen
       by the club, so closing can be switched off entirely and nothing goes red (review,
       06.09.2026, measured on the whole package).

       So the club is deleted afterwards and the member is in none again. Left open, Vardar's
       question offers „Prihvati" a second time — about a question Vardar has already been told
       went unanswered. */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000003' }))
    await router.navigate(FREE)
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))

    const both = (await inbox(user)).filter((one) => /Poziv u tim/.test(one.textContent ?? ''))

    await user.click(must(both[1], 'the invitation Dunavski trkači sent'))
    await user.click(await screen.findByRole('button', { name: 'Prihvati' }))

    await user.click(screen.getByRole('button', { name: 'obriši team-dunav' }))

    const after = (await inbox(user)).filter((one) => /Poziv u tim/.test(one.textContent ?? ''))

    await user.click(must(after[0], 'the invitation Vardar sent, which nobody answered'))

    expect(await screen.findByText(/Ovaj poziv više ne stoji/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()
  }, SLOW)

  it('does not come back to life when the club that took them in is deleted', async () => {
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

    /* **The accepted invitation is the one that is not closed**, so that the member's own copy
       of the message can name the club that asked. Left at that, the question would be open
       again the moment they were out of a club, and the club's page would list it as waiting.

       The portal has one road out of a club and it takes the club with it: no form carries a
       team field, and both places that clear it (`AdminTeams`, `TeamDetail`) are deleting the
       club itself. So the message answers with the club being gone rather than with two
       buttons, and there is nothing to come back to. Written as a case because it is the only
       thing standing between the kept record and a question that answers itself twice
       (review, 06.09.2026). */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheInvitation(user)
    await user.click(await screen.findByRole('button', { name: 'Prihvati' }))

    expect(await screen.findByText(/Prihvatio\/la si ovaj poziv/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'obriši team-dunav' }))

    expect(await screen.findByText(/Tim koji te je pozvao više ne postoji/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Prihvati' })).toBeNull()
  }, SLOW)

  it('ends only the invitations of the member who joined', async () => {
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

    /* Dunavski trkači ask two people. Relja accepts; Časlav's question is nobody's business but
       his own and must still be waiting. Every other case has all the invitations in the visit
       belong to one person, so „this member's" and „any" give the same list and the axis is
       measured nowhere (review, 06.09.2026). */
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))
    await router.navigate(OTHER_FREE)
    await user.click(await screen.findByRole('button', { name: 'Pozovi u tim' }))

    await user.click(screen.getByRole('button', { name: 'postani 000002' }))
    await openTheInvitation(user)
    await user.click(await screen.findByRole('button', { name: 'Prihvati' }))

    await user.click(screen.getByRole('button', { name: 'postani 000007' }))
    await router.navigate('/sr/tim/dunavski-trkaci')

    const sent = await screen.findByRole('list', { name: 'Poslati pozivi' })

    expect(within(sent).getByText(/Časlav Radenković/)).toBeVisible()
    expect(within(sent).queryByText(/Relja Momčilović/)).toBeNull()
  }, SLOW)
})
