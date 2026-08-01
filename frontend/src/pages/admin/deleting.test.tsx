import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { livePage } from '../../data/pages'
import { I18nProvider } from '../../i18n/I18nProvider'
import { RoleProvider } from '../../roles/RoleProvider'
import { SessionProvider } from '../../session/SessionProvider'
import { first, must } from '../../test/at'
import { moderatorWith, expectFrontPage, renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
import { Entities } from './Entities'
import { TEAMS } from './entityForms'
import { RowActions } from './EntityEditor'
import { Verification } from './Verification'

/* Deleting a record, and the two things it must not quietly do: leave the
 * identity behind, and leave the record behind. */

describe('a record entered under an identity a deletion had just freed', () => {
  it('is in the list, and does not inherit what was written against the old one', async () => {
    /* The fault this is here for: deletions were one flat list of identities and
       the list of records was filtered by it after the entries of this visit had
       been merged in. So a member entered on a number a deletion had freed
       saved, confirmed, and was then not in the list, and the next member was
       handed the same number again, and again after that. The overlay of changes
       is keyed by the identity, so had the record survived it would have been
       wearing the town and the name of the member who was deleted. */
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = () => within(screen.getByRole('table', { name: 'Članovi' }))
    await screen.findByRole('table', { name: 'Članovi' })

    // Change something about the first member, then delete them.
    const remove = first(table().getAllByRole('button', { name: /^Obriši:/ }))
    const name = must(remove.getAttribute('aria-label'), 'a name on the delete control').replace('Obriši: ', '')
    const before = table().getAllByRole('row').length

    await user.click(remove)
    await user.click(table().getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

    expect(table().getAllByRole('row')).toHaveLength(before - 1)
    expect(table().queryByText(name)).not.toBeInTheDocument()

    // And enter a new one, which is handed the number that has just come free.
    await user.click(screen.getByRole('button', { name: 'Novi član' }))
    await user.type(screen.getByLabelText(/^Ime/), 'Probni')
    await user.type(screen.getByLabelText(/^Prezime/), 'Novak')
    await user.selectOptions(screen.getByLabelText(/^Pol/), 'M')
    await user.type(screen.getByLabelText(/^Godina rođenja/), '1990')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/^U ligi od sezone/), '2027')
    await user.selectOptions(screen.getByLabelText(/^Osnov članstva/), 'payment')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const after = within(await screen.findByRole('table', { name: 'Članovi' }))

    expect(after.getByText('Probni Novak')).toBeVisible()
    expect(after.queryByText(name)).not.toBeInTheDocument()
  })
})

describe('a record entered during this visit and then deleted', () => {
  it('goes altogether, rather than being filtered out of a list it is still in', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    await screen.findByRole('table', { name: 'Timovi' })
    const table = () => within(screen.getByRole('table', { name: 'Timovi' }))
    const before = table().getAllByRole('row').length

    await user.click(screen.getByRole('button', { name: 'Novi tim' }))
    await user.type(screen.getByLabelText(/^Naziv tima/), 'Probni tim')
    await user.type(screen.getByLabelText(/^Mesto/), 'Čačak')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.selectOptions(screen.getByLabelText(/^Organizator tima/), '000001')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))
    await screen.findByRole('status', { name: 'Sačuvano' })
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    await screen.findByText('Probni tim')
    expect(table().getAllByRole('row')).toHaveLength(before + 1)

    await user.click(table().getByRole('button', { name: 'Obriši: Probni tim' }))
    await user.click(table().getByRole('button', { name: 'Potvrdi brisanje: Probni tim' }))

    expect(table().queryByText('Probni tim')).not.toBeInTheDocument()
    expect(table().getAllByRole('row')).toHaveLength(before)
  })
})

describe('the focus after a row is deleted', () => {
  it('goes to the one control on the screen that cannot be the row just deleted', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/timovi', 'superadmin')

    const table = () => within(screen.getByRole('table', { name: 'Timovi' }))
    await screen.findByRole('table', { name: 'Timovi' })

    const remove = first(table().getAllByRole('button', { name: /^Obriši:/ }))
    const name = must(remove.getAttribute('aria-label'), 'a name on the delete control').replace('Obriši: ', '')

    await user.click(remove)
    await user.click(table().getByRole('button', { name: `Potvrdi brisanje: ${name}` }))

    /* Without this the focus is on a button that is no longer on the page and
       the next Tab starts from the top; the move is also the only word a screen
       reader gets that anything happened. */
    expect(screen.getByRole('button', { name: 'Novi tim' })).toHaveFocus()
  })

  it('does not go looking for it where there is none', async () => {
    /* RowActions drawn on its own, without the strip that carries the control.
       Nothing to move the focus to is not a reason to refuse to delete. */
    const user = setupUser()

    render(
      <I18nProvider locale="sr">
        <SessionProvider>
          <RowActions
            entity={TEAMS}
            record={{ id: 'tim-1', name: 'Probni' }}
            name="Probni"
            onOpen={vi.fn()}
          />
        </SessionProvider>
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Obriši: Probni' }))

    const sure = screen.getByRole('button', { name: 'Potvrdi brisanje: Probni' })
    await user.click(sure)

    /* Nothing here reads the list, so the row is still drawn; what matters is
       that asking for an anchor that is not on the page neither threw nor moved
       the focus anywhere unexpected. */
    expect(sure).toHaveFocus()
  })
})

describe('a deleted written page', () => {
  it('stops being served, rather than going off the list and answering as before', () => {
    const page = { title: 'Pravilnik', sections: [] }

    expect(livePage({ pravilnik: page }, 'pravilnik', [])).toBe(page)
    expect(livePage({ pravilnik: page }, 'pravilnik', ['pravilnik'])).toBeUndefined()
  })
})

describe('a section with nothing in it', () => {
  /* Behind the door, which asks the same question first (needs.ts), so nobody
     reaches these through the route table. Here in case the door is ever
     loosened: a section that is empty must go to the front page and not draw
     itself with nothing in it. */
  const nobody = () => (
    <I18nProvider locale="sr">
      <SessionProvider>
        <RoleProvider initialRole="moderator" initialModerator={moderatorWith([])}>
          <MemoryRouter initialEntries={['/sr/administracija/entiteti']}>
            <Entities />
            <Verification />
          </MemoryRouter>
        </RoleProvider>
      </SessionProvider>
    </I18nProvider>
  )

  it('sends whoever reached it to the front page', () => {
    // Both render a redirect and nothing else, so nothing of either is drawn.
    const { container } = render(nobody())

    expect(container).toBeEmptyDOMElement()
  })
})

describe('the front page is where a closed door ends', () => {
  it('is reached from a section a moderator holds nothing in', async () => {
    renderAt('/sr/administracija/verifikacija', 'moderator', null, moderatorWith([]))

    await expectFrontPage()
  })
})
