import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { livePage } from '../../data/pages'
import { I18nProvider } from '../../i18n/I18nProvider'
import { RoleProvider } from '../../roles/RoleProvider'
import { SessionProvider } from '../../session/SessionProvider'
import { at, first, must } from '../../test/at'
import { Decided } from '../../test/decided'
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

describe('one decision for a whole queue', () => {
  it('settles every waiting item at once, after asking', async () => {
    /* Owner, 01.08.2026. It asks first because there is nothing to undo:
       approving is what puts a thing on the portal, and a queue of forty
       approved by a misplaced click is forty things to find again by hand. */
    const user = setupUser()
    const asked: string[] = []
    const confirm = vi.spyOn(window, 'confirm').mockImplementation((message) => {
      asked.push(String(message))
      return true
    })

    try {
      renderAt('/sr/administracija/verifikacija/komentari', 'superadmin', null, undefined, null, <Decided />)

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const before = within(waiting).getAllByRole('listitem').length
      expect(before).toBeGreaterThan(1)

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(asked).toHaveLength(1)
      expect(first(asked)).toContain(String(before))
      expect(screen.getByText('Nema nijedne stavke na čekanju.')).toBeVisible()
      /* Every one of them decided, read off the session rather than off a table
         of settled items: a queue shows what is waiting and nothing else since
         06.08.2026. */
      expect(
        within(screen.getByRole('list', { name: 'Odluke sesije' })).getAllByRole('listitem'),
      ).toHaveLength(before)
    } finally {
      confirm.mockRestore()
    }
  })

  it('carries the published text out with it, on the queue that publishes', async () => {
    /* Biographies are the one queue where approving means publishing what the
       moderator left, so the settled row has to carry the text rather than go
       back for it. One decision for the whole queue must write the same thing
       one decision at a time writes. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      renderAt(
        '/sr/administracija/verifikacija/trkacki-profil',
        'superadmin',
        null,
        undefined,
        null,
        <Decided />,
      )

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      /* The card of a biography, which is what this is about: the queue holds
         the pictures too since 06.08.2026, and a picture is not published, it is
         accepted or handed back (queues.ts, `outcomeFor`).

         The text itself, read under the words that name it, and not the whole
         card: the card carries the member's name above it, and a word taken from
         there is a word the published text never had. */
      const card = within(
        must(
          within(waiting)
            .getAllByRole('listitem')
            .find((one) => within(one).queryByText('Tekst biografije') !== null),
          'a card carrying a biography',
        ),
      )
      const first_text = must(
        must(
          card.getByText('Tekst biografije').nextElementSibling,
          'the biography under the words that name it',
        ).textContent,
        'the first waiting biography',
      )

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      const decided = within(screen.getByRole('list', { name: 'Odluke sesije' }))
      const words = must(first_text.match(/[A-ZŠĐČĆŽ][a-zšđčćž]{4,}/), 'a word of the biography')

      expect(decided.getAllByText(new RegExp(words[0])).length).toBeGreaterThan(0)
    } finally {
      confirm.mockRestore()
    }
  })

  it('hands every activated membership its own number, not one number to all of them', async () => {
    /* The fault a loop would have walked straight into. A number is worked out
       against everything already spoken for, and what is spoken for is read off
       the session as this render sees it; the session does not change while a
       loop runs. Twenty activations in a loop are twenty members answering to
       000032, which is the exact fault the numbering was moved into one module
       to stop (memberNumbers.ts, PDL P8). */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      renderAt('/sr/administracija/verifikacija/uplate', 'superadmin', null, undefined, null, <Decided />)

      const waiting = await screen.findByRole('table', { name: 'Uplate i aktivacija članova' })
      const before = within(waiting).getAllByRole('row').slice(1).length
      expect(before).toBeGreaterThan(1)

      await user.click(screen.getByRole('button', { name: 'Aktiviraj sve po osnovu uplate' }))

      /* Read off the session, where the number handed out lives: the screen
         shows what is waiting and nothing else. Each line is one decision, and
         the number it handed out is the last field of it. */
      const lines = within(screen.getByRole('list', { name: 'Odluke sesije' }))
        .getAllByRole('listitem')
        .map((one) => String(one.textContent))
      const numbers = lines.map((line) => at(line.split(' | '), 4))

      expect(numbers).toHaveLength(before)
      expect(new Set(numbers).size).toBe(before)
      /* And every one of them is a membership on the ground of a fee, which is
         what the words on the button say it writes down. */
      expect(lines.filter((line) => line.includes('payment'))).toHaveLength(before)
    } finally {
      confirm.mockRestore()
    }
  })

  it('says what it did and takes the focus, rather than leaving it nowhere', async () => {
    /* The button is drawn only while something is waiting, so the sweep takes it
       off the screen in the same render that empties the queue. Without an
       answer the focus falls to the document: the next Tab starts the page from
       the skip link, and for anybody being read to nothing happened at all,
       because the only sign was a table appearing further down. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const before = within(waiting).getAllByRole('listitem').length

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      /* One, two and five are three different sentences in Serbian, so what is
         matched is the shape rather than one of the three. */
      const said = screen.getByText(new RegExp(`^Rešen.* ${before} stavk`))

      expect(said).toBeVisible()
      expect(said).toHaveFocus()
    } finally {
      confirm.mockRestore()
    }
  })

  it('says what it did on the money queue too, with the number it really settled', async () => {
    /* The same line on all three screens, and the number on it comes off the
       queue rather than out of the air: written as a nought it would have said
       "Rešeno je 0 stavki." after activating everybody, and nothing here would
       have noticed. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    try {
      renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

      const waiting = await screen.findByRole('table', { name: 'Uplate i aktivacija članova' })
      const before = within(waiting).getAllByRole('row').slice(1).length

      await user.click(screen.getByRole('button', { name: 'Aktiviraj sve po osnovu uplate' }))

      const said = screen.getByText(new RegExp(`^Rešen.* ${before} stavk`))

      expect(said).toBeVisible()
      expect(said).toHaveFocus()
    } finally {
      confirm.mockRestore()
    }
  })

  it('activates nobody when the question about the money is answered no', async () => {
    /* The one queue where saying yes by accident hands out member numbers, so
       the way out of the question is the half worth pinning. */
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    try {
      renderAt('/sr/administracija/verifikacija/uplate', 'superadmin')

      const waiting = await screen.findByRole('table', { name: 'Uplate i aktivacija članova' })
      const before = within(waiting).getAllByRole('row').slice(1).length

      await user.click(screen.getByRole('button', { name: 'Aktiviraj sve po osnovu uplate' }))

      expect(
        within(await screen.findByRole('table', { name: 'Uplate i aktivacija članova' }))
          .getAllByRole('row')
          .slice(1),
      ).toHaveLength(before)
      expect(screen.queryByRole('table', { name: 'Rešeno' })).toBeNull()
    } finally {
      confirm.mockRestore()
    }
  })

  it('settles nothing when the question is answered no', async () => {
    const user = setupUser()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    try {
      renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

      const waiting = await screen.findByRole('list', { name: /Čeka/ })
      const before = within(waiting).getAllByRole('listitem').length

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(within(await screen.findByRole('list', { name: /Čeka/ })).getAllByRole('listitem'))
        .toHaveLength(before)
    } finally {
      confirm.mockRestore()
    }
  })
})
