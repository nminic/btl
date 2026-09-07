import { screen, within } from '@testing-library/react'
import { liga } from '../forms/definitions'
import { limitOf } from '../forms/records'
import { at, must } from '../test/at'
import { SLOW } from '../test/slow'
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

  it('takes Enter as done, without reaching for the mouse', async () => {
    /* The cell used to be tested through the events screen, whose town stopped
       being a cell on 11.08.2026 (it carries a country now, and a cell writes
       one field). Enter went untested with it, which is how a screen losing a
       caller quietly loses a guard. */
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Članovi' })
    const row = at(within(table).getAllByRole('row'), 1)

    await user.click(within(row).getByRole('button', { name: /^Mesto:/ }))
    const box = within(row).getByRole('textbox')
    await user.clear(box)
    await user.type(box, 'Kikinda{Enter}')

    expect(within(row).getByRole('button', { name: /^Mesto:/ })).toHaveTextContent('Kikinda')
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

  it('changes the place of an event on its form and nowhere else', async () => {
    /* The town was a cell until 11.08.2026, and stopped being one when it began
       carrying the country it is in (forms/types.ts). A cell writes one field
       of one record, so a town corrected in the row left the event in the
       country of the town it used to be in, and no screen shows a country.
       The name beside it went the same way and for the same shape of reason,
       its address. */
    renderAt('/sr/administracija/dogadjaji', 'superadmin')

    const table = await screen.findByRole('table', { name: 'Događaji' })
    const row = at(within(table).getAllByRole('row'), 1)

    expect(within(row).queryByRole('button', { name: /^Mesto:/ })).toBeNull()
    expect(within(row).queryByRole('textbox')).toBeNull()
  })

  it('changes the name of an event on its form and nowhere else', async () => {
    /* Not in a cell, which is the whole of it. A cell writes one field of one
       record, and the address an event answers at is made out of its name and
       its day (entityForms.ts): renamed in the row, an event went on answering
       at the address of the name it used to have, and nothing said so. That the
       form writes the address again on every save is proved where it can be
       seen, on the category of a race (entityForms.test.tsx). */
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
    await user.click(screen.getByRole('button', { name: 'Nazad na spisak' }))

    const listed = within(await screen.findByRole('table', { name: 'Događaji' }))

    expect(listed.getByText('Novi naziv trke')).toBeVisible()
  })
})

describe('the text of a competition', () => {
  /* **Read on the list of competitions, and changed there** (owner, 07.09.2026): „Propozicije i
     Nagrade treba da se izlistavaju na ovoj strani, a ne kad se uđe u ligu", and, asked where a
     moderator should edit them now: „Ceo tekst, uređuje se tu." A screen that shows one thing and
     changes it somewhere else is a screen where the two can disagree, and the person who spots the
     mistake is the one who cannot fix it.

     Every case below therefore names the box of one competition and asks inside it: the list draws
     three, and a question asked of the screen would be answered by whichever one came first. */
  const boxOf = async (name: RegExp) =>
    within(
      must(
        (await screen.findByRole('heading', { level: 2, name })).closest('li'),
        'the box of the competition',
      ),
    )

  it('is written by whoever runs it, and only by them', async () => {
    const user = setupUser()
    renderAt('/sr/lige?sezona=2027', 'superadmin')

    const box = await boxOf(/Planinska liga/)

    // Nobody has written the rules yet, and staff are offered the chance to.
    const rules = must(box.getByRole('heading', { name: 'Propozicije' }).closest('section'), 'section')
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
    renderAt('/sr/lige?sezona=2027')

    const box = await boxOf(/Planinska liga/)

    expect(box.queryByRole('heading', { name: 'Propozicije' })).not.toBeInTheDocument()
    expect(box.queryByRole('button', { name: 'Izmeni' })).not.toBeInTheDocument()
  })

  it('bounds each box by its own field, not by the first of the two', async () => {
    /* **Two fields and one limit was a bug waiting for the two numbers to part** (review,
       07.09.2026). The component drew both texts and read the cap off `rules` for both, which is
       right for exactly as long as the definition gives them the same number. Measured that day
       with the prizes lowered to 500: the box let a moderator write three thousand, and the
       administration form then told them their own text was too long — the very fault `limitOf`
       exists to prevent, moved one screen along.

       Held against the definition rather than against a number written here, because the number is
       the definition's to change (`forms/definitions/admin-liga.form.json`). */
    const user = setupUser()
    renderAt('/sr/lige?sezona=2027', 'superadmin')

    const box = await boxOf(/RunTrace liga/)

    for (const [heading, field] of [
      ['Propozicije', 'rules'],
      ['Nagrade', 'prizes'],
    ] as const) {
      const section = must(box.getByRole('heading', { name: heading }).closest('section'), 'section')

      await user.click(within(section).getByRole('button', { name: 'Izmeni' }))

      expect(within(section).getByRole('textbox', { name: heading })).toHaveAttribute(
        'maxlength',
        String(limitOf(liga, field)),
      )
    }
  }, SLOW)

  it('is shown to a visitor once it has been written', async () => {
    renderAt('/sr/lige?sezona=2027')

    const box = await boxOf(/RunTrace liga/)

    expect(box.getByRole('heading', { name: 'Propozicije' })).toBeVisible()
    expect(box.getByRole('heading', { name: 'Nagrade' })).toBeVisible()
  })
})

describe('the last few branches these screens have', () => {
  it('cancels sending a result back', async () => {
    const user = setupUser()
    renderAt('/sr/rezultat/novi', 'superadmin', '000007')

    await user.type(await screen.findByLabelText(/^Naziv trke/), 'Probna trka')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText('Mesto'), 'Niš')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Dužina/), '10')
    await user.type(screen.getByLabelText(/Uspon/), '0')
    await user.type(screen.getByLabelText(/Spust/), '0')
    await user.type(screen.getByLabelText('Sati'), '0')
    await user.type(screen.getByLabelText('Minuta'), '45')
    await user.type(screen.getByLabelText('Sekundi'), '0')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/r')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    await user.click(await screen.findByRole('link', { name: /^Administracija/ }))
    /* Straight to the queue: the sectors stand beside every administrative
       screen now, so there is no road to a section to walk first. */
    await user.click(await screen.findByRole('link', { name: /Rezultati/ }))
    await user.click(await screen.findByRole('button', { name: 'Odbij' }))
    await user.click(screen.getByRole('button', { name: 'Odustani' }))

    // The result stays where it was, waiting.
    expect(screen.queryByRole('button', { name: 'Odbij uz ovaj razlog' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Odbij' })).toBeVisible()
  })

  it('leaves an already written competition text alone unless it is changed', async () => {
    const user = setupUser()
    renderAt('/sr/lige?sezona=2027', 'superadmin')

    const box = must(
      (await screen.findByRole('heading', { level: 2, name: /RunTrace liga/ })).closest('li'),
      'the box of the competition',
    )
    const prizes = must(
      within(box).getByRole('heading', { name: 'Nagrade' }).closest('section'),
      'section',
    )
    const before = must(
      must(prizes.querySelector('.profile__text'), 'the prose of the prizes').textContent,
      'text',
    )

    await user.click(within(prizes).getByRole('button', { name: 'Izmeni' }))
    await user.tab()

    expect(prizes.querySelector('.profile__text')).toHaveTextContent(before)
  })
})
