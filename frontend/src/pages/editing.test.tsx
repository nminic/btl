import { screen, within } from '@testing-library/react'
import { at, must } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

describe('changing data in administration', () => {
  it('changes a value in the row it sits in, and keeps it', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    const row = at(within(table).getAllByRole('row'), 1)
    // Named, because the row also carries the control that opens the whole
    // record on a form.
    const city = within(row).getByRole('button', { name: /^Mesto:/ })
    const before = must(city.textContent, 'the place on the row')

    await user.click(city)
    const box = within(row).getByRole('textbox')
    await user.clear(box)
    await user.type(box, 'Vršac')
    await user.tab()

    expect(within(row).getByRole('button', { name: /^Mesto:/ })).toHaveTextContent('Vršac')
    expect(within(row).getByRole('button', { name: /^Mesto:/ })).not.toHaveTextContent(before)
  })

  it('lets an edit be abandoned', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    const row = at(within(table).getAllByRole('row'), 1)
    const before = must(
      within(row).getByRole('button', { name: /^Mesto:/ }).textContent,
      'the place on the row',
    )

    await user.click(within(row).getByRole('button', { name: /^Mesto:/ }))
    await user.type(within(row).getByRole('textbox'), 'nešto')
    await user.keyboard('{Escape}')

    expect(within(row).getByRole('button', { name: /^Mesto:/ })).toHaveTextContent(before)
  })

  it('changes the place of an event', async () => {
    const user = setupUser()
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Događaji' })
    const row = at(within(table).getAllByRole('row'), 1)

    /* Named rather than taken as the first control of the row: the name beside
       it is no longer one, and a test that counts controls would have gone on
       passing while typing the new name of an event into its town. */
    await user.click(within(row).getByRole('button', { name: /^Mesto:/ }))
    const box = within(row).getByRole('textbox')
    await user.clear(box)
    await user.type(box, 'Sremski Karlovci{Enter}')

    expect(within(row).getByRole('button', { name: /^Mesto:/ })).toHaveTextContent(
      'Sremski Karlovci',
    )
  })

  it('changes the name of an event on its form, where the address goes with it', async () => {
    /* Not in a cell, which is the whole of it. A cell writes one field of one
       record, and the address an event answers at is made out of its name and
       its day (entityForms.ts): renamed in the row, an event went on answering
       at the address of the name it used to have, and nothing said so. */
    const user = setupUser()
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Događaji' })
    const row = at(within(table).getAllByRole('row'), 1)

    expect(within(row).queryByRole('button', { name: /^Događaj:/ })).toBeNull()

    await user.click(within(row).getByRole('button', { name: /^Otvori:/ }))

    const name = await screen.findByLabelText(/^Naziv događaja/)
    await user.clear(name)
    await user.type(name, 'Novi naziv trke')
    await user.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    const saved = within(await screen.findByRole('status', { name: 'Sačuvano' }))

    expect(saved.getByText(/^novi-naziv-trke-\d{4}-\d{2}-\d{2}$/)).toBeVisible()
  })
})

describe('the text of a competition', () => {
  it('is written by whoever runs it, and only by them', async () => {
    const user = setupUser()
    renderAt('/sr/liga/runtrace-2027', 'superadmin')

    await screen.findByRole('heading', { level: 1 })

    // Nobody has written the rules yet, and staff are offered the chance to.
    const rules = must(screen.getByRole('heading', { name: 'Propozicije' }).closest('section'), 'section')
    expect(within(rules).getByText('Još nije napisano.')).toBeVisible()

    await user.click(within(rules).getByRole('button', { name: 'Izmeni' }))
    await user.type(
      within(rules).getByRole('textbox', { name: 'Propozicije' }),
      'Boduju se samo trke sa spiska.',
    )
    await user.tab()

    expect(within(rules).getByText('Boduju se samo trke sa spiska.')).toBeVisible()
  })

  it('is not offered to a visitor, and an empty one is not shown at all', async () => {
    renderAt('/sr/liga/runtrace-2027')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('heading', { name: 'Propozicije' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Izmeni' })).not.toBeInTheDocument()
  })

  it('is shown to a visitor once it has been written', async () => {
    renderAt('/sr/liga/btl-2027')

    expect(await screen.findByRole('heading', { name: 'Propozicije' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Nagrade' })).toBeVisible()
  })
})

describe('the last few branches these screens have', () => {
  it('cancels sending a result back', async () => {
    const user = setupUser()
    renderAt('/sr/rezultat/novi', 'superadmin', '000007')

    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Probna trka')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText(/Dužina/), '10')
    await user.type(screen.getByLabelText(/Uspon/), '0')
    await user.type(screen.getByLabelText(/Spust/), '0')
    await user.type(screen.getByLabelText('Sati'), '0')
    await user.type(screen.getByLabelText('Minuta'), '45')
    await user.type(screen.getByLabelText('Sekundi'), '0')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/r')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    await user.click(await screen.findByRole('button', { name: 'Administracija' }))
    // The entry carries the number waiting in its name (PDL P28a).
    await user.click(screen.getByRole('link', { name: /^Verifikacija/ }))
    await user.click(await screen.findByRole('link', { name: /Rezultati/ }))
    await user.click(await screen.findByRole('button', { name: 'Vrati na doradu' }))
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    // The result stays where it was, waiting.
    expect(screen.queryByRole('button', { name: 'Vrati uz ovaj razlog' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vrati na doradu' })).toBeVisible()
  })

  it('leaves an already written competition text alone unless it is changed', async () => {
    const user = setupUser()
    renderAt('/sr/liga/btl-2027', 'superadmin')

    const prizes = must((await screen.findByRole('heading', { name: 'Nagrade' })).closest('section'), 'section')
    const before = must(
      must(prizes.querySelector('.profile__text'), 'the prose of the prizes').textContent,
      'text',
    )

    await user.click(within(prizes).getByRole('button', { name: 'Izmeni' }))
    await user.tab()

    expect(prizes.querySelector('.profile__text')).toHaveTextContent(before)
  })
})
