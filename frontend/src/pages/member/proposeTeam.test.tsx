import { screen, within } from '@testing-library/react'
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
