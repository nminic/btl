import { screen, within } from '@testing-library/react'
import sr from '../../i18n/sr.json'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { setupUser } from '../../test/user'

/* A team put forward by a member, and the queue that has been waiting for one.
 *
 * The queue of new teams was written with the rest of the eight and nothing
 * could ever put anything in it: teams arrived one way only, entered by an
 * administrator (owner, 03.08.2026).
 */

describe('the way to propose a team', () => {
  it('is offered to a member on the standing of the teams', async () => {
    renderAt('/sr/timovi', 'competitor', '000007')

    expect(await screen.findByRole('link', { name: 'Predloži tim' })).toBeVisible()
  })

  it('is not offered to somebody who is not signed in', async () => {
    renderAt('/sr/timovi')

    await screen.findByRole('table', { name: 'Timovi' })
    expect(screen.queryByRole('link', { name: 'Predloži tim' })).toBeNull()
  })

  it('asks whoever reaches the address without signing in to sign in', async () => {
    renderAt('/sr/novi-tim')

    expect(await screen.findByRole('heading', { name: /prijav/i })).toBeVisible()
    expect(screen.queryByLabelText(/Naziv tima/)).toBeNull()
  })
})

describe('a proposal a member sends', () => {
  const fill = async (user: ReturnType<typeof setupUser>, name: string) => {
    await user.type(await screen.findByLabelText(/Naziv tima/), name)
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
  }

  it('says it is waiting on a moderator rather than that the team exists', async () => {
    const user = setupUser()
    renderAt('/sr/novi-tim', 'competitor', '000007')

    await fill(user, 'Trkači Morave')

    expect(await screen.findByRole('heading', { name: 'Predlog je poslat' })).toBeVisible()
    expect(screen.getByText(/„Trkači Morave" čeka odluku moderatora/)).toBeVisible()
  })

  it('refuses to send without the three things it asks for', async () => {
    const user = setupUser()
    renderAt('/sr/novi-tim', 'competitor', '000007')

    await user.click(await screen.findByRole('button', { name: 'Pošalji predlog' }))

    expect(screen.queryByRole('heading', { name: 'Predlog je poslat' })).toBeNull()
    expect(screen.getAllByText('Ovo polje je obavezno.')).toHaveLength(3)
  })
})

describe('who the queue of new teams says decides', () => {
  it('names both, because both may (PDL P13, P21)', () => {
    /* This is the text the queue's own page carries into its description, and it
       said "Svaki nov tim odobrava superadministrator" for as long as P13 did.
       Changing P13 and leaving it was how the decision and the screen went on
       disagreeing one file further along, and nothing was measuring it. */
    const said = sr.verification.fromTeams

    expect(said).toMatch(/[Ss]uperadmin/)
    expect(said).toMatch(/moderator/)
  })
})

describe('what the screen promises a member', () => {
  it('promises no answer, because none arrives', async () => {
    /* It used to say the answer comes to your messages. Nothing writes it there:
       the inbox is written to on one queue only, the pictures, so a decision on
       a proposal reaches nobody (PENDING R9).

       Checked by counting the inbox rather than by matching the old sentence,
       which any other wording of the same promise would have slipped past. */
    const user = setupUser()
    const { router } = renderAt('/sr/poruke', 'competitor', '000007')

    const before = within(await screen.findByRole('list')).getAllByRole('listitem').length

    await router.navigate('/sr/novi-tim')
    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/poruke')

    expect(within(await screen.findByRole('list')).getAllByRole('listitem')).toHaveLength(before)
  })

  it('promises no sight of it either, because there is no screen that shows one', async () => {
    /* A proposal lives in the session and is read in the administration alone,
       so "only you can see it" would have been the same kind of promise. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'competitor', '000007')

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/timovi')
    await screen.findByRole('table', { name: 'Timovi' })

    expect(screen.queryByText('Trkači Morave')).toBeNull()
  })
})

describe('a name a team in the league already answers to', () => {
  it('is refused at the door rather than a fortnight later', async () => {
    /* PDL: the name must not be taken by a team already approved. A member told
       at the door can change it; a member told a fortnight later by a refusal
       has to start again. */
    const user = setupUser()
    renderAt('/sr/novi-tim', 'competitor', '000007')

    /* By the name as it stands on the standing of the teams, in another case, so
       the check is about the name and not about the typing. */
    await user.type(await screen.findByLabelText(/Naziv tima/), 'dunavski TRKAČI')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    expect(screen.getByText(/već postoji u ligi/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Predlog je poslat' })).toBeNull()
  })
})

describe('a proposal from somebody the member list does not hold', () => {
  it('goes through, with no name beside it rather than the word undefined', async () => {
    /* The member list is read to put a name on the proposal, and it can come
       back without one: a number handed out during this visit is not in the file
       the list is read from, and after the database arrives the two can be a
       moment apart for a hundred other reasons. What must not happen is that the
       proposal is refused, or that it goes to the moderator signed "undefined". */
    const user = setupUser()
    /* Signed in as the superadmin, so the queue can be opened at the end of it,
       but under a number the member list does not hold. */
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '999999')

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))

    expect(await screen.findByRole('heading', { name: 'Predlog je poslat' })).toBeVisible()

    await router.navigate('/sr/administracija/verifikacija/timovi')
    const waiting = await screen.findByRole('list', { name: /Čeka/ })

    expect(within(waiting).getByText('Trkači Morave')).toBeVisible()
    expect(within(waiting).queryByText(/undefined/)).toBeNull()
  })
})

describe('the queue of new teams', () => {
  it('holds what a member proposed, beside what was already in it', async () => {
    /* The whole point of the exercise: a moderator opening the queue cannot tell
       which of two waiting teams came from a file and which from a member,
       because once there is a database there is no such difference. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000007')

    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Zašto ovaj tim/), 'Trčimo zajedno već tri godine.')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/administracija/verifikacija/timovi')

    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const items = within(waiting).getAllByRole('listitem')

    /* Beside the ones from the file, not instead of them. */
    expect(items.length).toBeGreaterThan(1)
    expect(within(waiting).getByText('Trkači Morave')).toBeVisible()
    /* Carrying who asked and what they said, which is what a moderator decides
       on: a name and a town with nobody attached is not a thing to judge. */
    expect(within(waiting).getByText(/Čačak, Srbija\. Trčimo zajedno već tri godine\./)).toBeVisible()
  })

  it('counts the proposal wherever the queue is counted, not only in the queue', async () => {
    /* Counted once, in one place, so the number beside the queue in the
       navigation and the queue itself cannot disagree (pending.ts). A moderator
       told nothing is waiting, on a screen about to show them something, stops
       believing the number. */
    const user = setupUser()
    const { router } = renderAt('/sr/administracija/verifikacija/timovi', 'superadmin', '000007')

    const named = () =>
      must(
        screen
          .getAllByRole('link')
          .map((link) => /^Novi timovi(\d+)$/.exec(link.textContent ?? ''))
          .find((found) => found !== null),
        'veza ka redu novih timova sa brojem',
      )[1]

    await screen.findByRole('list', { name: /Čeka/ })
    const before = Number(named())

    await router.navigate('/sr/novi-tim')
    await user.type(await screen.findByLabelText(/Naziv tima/), 'Trkači Morave')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })

    await router.navigate('/sr/administracija/verifikacija/timovi')
    await screen.findByRole('list', { name: /Čeka/ })

    expect(Number(named())).toBe(before + 1)
  })
})

describe('a proposal a moderator accepts', () => {
  /* What approving does beyond writing down the decision (owner, 03.08.2026,
     PDL P13): the team is made, the member who proposed it is its organiser,
     and that member is told in the inbox. */
  const propose = async (user: ReturnType<typeof setupUser>, name: string) => {
    await user.type(await screen.findByLabelText(/Naziv tima/), name)
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.click(screen.getByRole('button', { name: 'Pošalji predlog' }))
    await screen.findByRole('heading', { name: 'Predlog je poslat' })
  }

  it('writes to the member who asked for it, in the inbox', async () => {
    /* Not a message on a screen nobody is looking at: the decision may come
       days later. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000007')

    await propose(user, 'Trkači Morave')

    await router.navigate('/sr/administracija/verifikacija/timovi')
    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const mine = must(
      within(waiting)
        .getAllByRole('listitem')
        .find((item) => /Trkači Morave/.test(item.textContent ?? '')),
      'predlog u redu čekanja',
    )

    await user.click(within(mine).getByRole('button', { name: 'Odobri' }))

    await router.navigate('/sr/poruke')
    const inbox = within(await screen.findByRole('list'))

    expect(inbox.getByText(/Tim „Trkači Morave" je prihvaćen/)).toBeVisible()
  })

  it('makes the team, with the member who proposed it as its organiser', async () => {
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000007')

    await propose(user, 'Trkači Morave')

    await router.navigate('/sr/administracija/verifikacija/timovi')
    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const mine = must(
      within(waiting)
        .getAllByRole('listitem')
        .find((item) => /Trkači Morave/.test(item.textContent ?? '')),
      'predlog u redu čekanja',
    )

    await user.click(within(mine).getByRole('button', { name: 'Odobri' }))

    /* A record like any other from that moment: in the administration's list of
       teams, with the town it was proposed with. */
    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))
    const row = must(
      listed.getAllByRole('row').find((one) => /Trkači Morave/.test(one.textContent ?? '')),
      'red novog tima',
    )

    expect(within(row).getByText('Čačak')).toBeVisible()
  })

  it('leaves nothing behind when the proposal is turned down', async () => {
    /* The other half. A refusal makes no team and writes to nobody: the reason
       is written down, and this queue hands nothing back to a member. */
    const user = setupUser()
    const { router } = renderAt('/sr/novi-tim', 'superadmin', '000007')

    await propose(user, 'Trkači Morave')

    await router.navigate('/sr/administracija/verifikacija/timovi')
    const waiting = await screen.findByRole('list', { name: /Čeka/ })
    const mine = must(
      within(waiting)
        .getAllByRole('listitem')
        .find((item) => /Trkači Morave/.test(item.textContent ?? '')),
      'predlog u redu čekanja',
    )

    await user.click(within(mine).getByRole('button', { name: 'Vrati na doradu' }))
    await user.type(screen.getByLabelText(/Razlog/), 'Već postoji tim tog imena u Čačku.')
    await user.click(screen.getByRole('button', { name: 'Vrati uz ovaj razlog' }))

    await router.navigate('/sr/administracija/timovi')
    const listed = within(await screen.findByRole('table', { name: 'Timovi' }))

    expect(listed.queryByText('Trkači Morave')).toBeNull()
  })
})
