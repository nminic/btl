import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'

describe('changing data in administration', () => {
  it('changes a value in the row it sits in, and keeps it', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    const first = within(table).getAllByRole('row')[1]
    const city = within(first).getByRole('button')
    const before = city.textContent

    await user.click(city)
    const box = within(first).getByRole('textbox')
    await user.clear(box)
    await user.type(box, 'Vršac')
    await user.tab()

    expect(within(first).getByRole('button')).toHaveTextContent('Vršac')
    expect(within(first).getByRole('button')).not.toHaveTextContent(before!)
  })

  it('lets an edit be abandoned', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    const first = within(table).getAllByRole('row')[1]
    const before = within(first).getByRole('button').textContent

    await user.click(within(first).getByRole('button'))
    await user.type(within(first).getByRole('textbox'), 'nešto')
    await user.keyboard('{Escape}')

    expect(within(first).getByRole('button')).toHaveTextContent(before!)
  })

  it('changes the name and the place of an event', async () => {
    const user = userEvent.setup()
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Događaji' })
    const first = within(table).getAllByRole('row')[1]

    await user.click(within(first).getAllByRole('button')[0])
    const box = within(first).getByRole('textbox')
    await user.clear(box)
    await user.type(box, 'Novi naziv trke{Enter}')

    expect(within(first).getAllByRole('button')[0]).toHaveTextContent('Novi naziv trke')
  })
})

describe('the text of a competition', () => {
  it('is written by whoever runs it, and only by them', async () => {
    const user = userEvent.setup()
    renderAt('/sr/liga/runtrace-2027', 'superadmin')

    await screen.findByRole('heading', { level: 1 })

    // Nobody has written the rules yet, and staff are offered the chance to.
    const rules = screen.getByRole('heading', { name: 'Propozicije' }).closest('section')!
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
    const user = userEvent.setup()
    renderAt('/sr/rezultat/novi', 'superadmin', '000007')

    await user.type(await screen.findByLabelText(/Naziv događaja/), 'Probna trka')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText(/Vreme starta/), '09:00')
    await user.type(screen.getByLabelText(/Dužina/), '10')
    await user.type(screen.getByLabelText(/Uspon/), '0')
    await user.type(screen.getByLabelText(/Spust/), '0')
    await user.type(screen.getByLabelText('Sati'), '0')
    await user.type(screen.getByLabelText('Minuta'), '45')
    await user.type(screen.getByLabelText('Sekundi'), '0')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/r')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    await user.click(await screen.findByRole('button', { name: 'Administracija' }))
    await user.click(screen.getByRole('link', { name: 'Verifikacija' }))
    await user.click(await screen.findByRole('link', { name: /Rezultati/ }))
    await user.click(await screen.findByRole('button', { name: 'Vrati na doradu' }))
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    // The result stays where it was, waiting.
    expect(screen.queryByRole('button', { name: 'Vrati uz ovaj razlog' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vrati na doradu' })).toBeVisible()
  })

  it('leaves an already written competition text alone unless it is changed', async () => {
    const user = userEvent.setup()
    renderAt('/sr/liga/btl-2027', 'superadmin')

    const prizes = (await screen.findByRole('heading', { name: 'Nagrade' })).closest('section')!
    const before = prizes.querySelector('.profile__text')!.textContent

    await user.click(within(prizes).getByRole('button', { name: 'Izmeni' }))
    await user.tab()

    expect(prizes.querySelector('.profile__text')).toHaveTextContent(before!)
  })
})
