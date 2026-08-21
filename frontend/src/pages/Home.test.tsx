import { matchingMedia } from '../test/media'
import { must } from '../test/at'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { freshNews, type NewsItem } from './home/content'

describe('Home', () => {
  /* Two thirds of standing and prose against one third of figures and things to
     do (owner, 31.07.2026). */
  it('lays the widgets out in the order a phone reads them', async () => {
    renderAt('/sr')

    await screen.findByRole('heading', { level: 2, name: 'Priprema, pozor, SAD!' })
    // The address is written text and arrives on its own request, so it is
    // waited for as well before the order is read.
    await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)

    /* The order in the markup is the order on a phone (owner, 31.07.2026): the
       two boards, the figures of the season, the turning chart, what is next,
       the address, the calculator. On a wide screen the grid puts them in two
       columns without moving them in the markup.

       The widget of membership stood at the end of it until 04.08.2026, when the
       owner had it removed: "nećemo ga koristiti do daljnjeg". */
    expect(headings).toEqual([
      'Top 10 muškarci',
      'Top 10 žene',
      expect.stringContaining('Sezona'),
      'Priprema, pozor, SAD!',
      'Reč predsednika',
      'BTL kalkulator',
    ])
  })

  /* Whose season it is, counted the way every other widget on this page counts
     it (PDL P11): a member whose fee has run out is not in the season now, so
     the count of members is the count of the field and not of everybody the
     league has ever had. The data has 32 members and 31 of them active, which is
     the whole point of that one difference. */
  it('counts the members of the running season, not everybody there has ever been', async () => {
    /* Read with the unrolling off, which is not a convenience but the only way
       this is about a number. The counters climb from zero, so every value below
       the target is a frame on the way there: a test that catches 31 in flight
       passes just as happily when the target is 32. With less motion asked for,
       the row is nought and then its target and nothing in between. */
    const previous = window.matchMedia
    /* The whole shape, not just `matches`: the theme in the shell subscribes to
       the system preference, and a stub without `addEventListener` throws inside
       an effect and takes the effects after it down with it. `matchingMedia` is
       where that whole shape is written out (test/media.ts). */
    window.matchMedia = matchingMedia((query) => query.includes('reduced-motion'))

    try {
      renderAt('/sr')

      // 32 members in the data, 31 of them active. Which of the two this says
      // is the whole of PDL P11 on the front page.
      expect(await screen.findByText(/^31 član$/, {}, { timeout: 10_000 })).toBeVisible()
      expect(screen.queryByText(/^32 člana$/)).not.toBeInTheDocument()
    } finally {
      window.matchMedia = previous
    }
  }, 20_000)

  /* Two blocks went out (owner, 31.07.2026): one explained on the front page
     what the written pages explain properly, the other counted members, which is
     now the first row of the counters. */
  it('no longer explains itself in three steps, nor counts the community twice', async () => {
    renderAt('/sr')

    await screen.findByRole('heading', { level: 2, name: 'Priprema, pozor, SAD!' })
    expect(screen.queryByRole('heading', { name: /Kako radi BTL/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Zajednica u brojkama' })).not.toBeInTheDocument()
  })

  it('names itself for a screen reader without showing the name again', async () => {
    renderAt('/sr')

    /* The block above the counters is gone in full, name included (owner,
       30.07.2026): the header says it in full right above, and repeating it pushed
       the scoreboard below the fold. A page with no h1 at all is still a page a
       screen reader cannot name, so the heading stays and does not show.

       Held on the class, because that is the mechanism that hides it and jsdom
       measures nothing: toBeVisible passes on a heading of one clipped pixel, so a
       test written that way would pass with the name back on screen in full. */
    const heading = await screen.findByRole('heading', { level: 1, name: 'Balkanska trkačka liga' })

    expect(heading).toHaveClass('visually-hidden')
  })

  /* The countdown to the season left the page together with the block above the
     counters (owner, 30.07.2026), and the widget that said when membership opens
     left it on 04.08.2026: "nećemo ga koristiti do daljnjeg". So the front page
     quotes no price and no date of its own any more, and that is the thing worth
     holding: neither the countdown nor the slot came back by accident. */
  it('counts down to nothing, and quotes no price', async () => {
    renderAt('/sr')

    await screen.findByRole('heading', { level: 2, name: 'BTL kalkulator' })

    expect(screen.queryByText(/do početka sezone/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Otvara se za/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cena raste/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Članarina za BTL/ })).not.toBeInTheDocument()
  })

  it('groups a recurring event into one row instead of five', async () => {
    renderAt('/sr')

    const card = must(
      (await screen.findByRole('heading', { name: 'Priprema, pozor, SAD!' })).closest('section'),
      'the widget around that heading',
    )
    const titles = within(card)
      .getAllByRole('listitem')
      .map((row) => must(row.textContent, 'text').replace(/[\d./]/g, ''))

    // No event name appears twice: repeats collapse into a single row.
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('shows both top tens and links to the whole standing', async () => {
    renderAt('/sr')

    const men = must((await screen.findByRole('heading', { name: 'Top 10 muškarci' })).closest('section'), 'section')

    expect(within(men).getAllByRole('listitem').length).toBeGreaterThan(0)
    // The standing moved to /tabela; /top-liste is the page of Top 10 boards now.
    expect(within(men).getByRole('link', { name: 'Cela tabela' })).toHaveAttribute(
      'href',
      '/sr/tabela?pol=m',
    )
  })

  it('carries no heading of its own and nothing to click', async () => {
    renderAt('/sr')

    await screen.findByText(/^Najviše/)
    expect(screen.queryByRole('heading', { name: /Trke po dužini/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /kategorija/ })).not.toBeInTheDocument()
  })

  it('works the calculator, and waits quietly until it can answer', async () => {
    const user = setupUser()
    renderAt('/sr')

    const calc = must(
      (await screen.findByRole('heading', { name: 'BTL kalkulator' })).closest('section'),
      'the widget around that heading',
    )
    /* The label of the answer stands there from the start (owner, 31.07.2026),
       so the card does not change height as somebody types; what arrives is the
       number. */
    expect(within(calc).getByText('BTL poeni:')).toBeVisible()
    expect(within(calc).getByText('Unesi dužinu i vreme.')).toBeVisible()

    // The golden race: 62.07 km, 3456 m up, 3133 m down, 7:28:31 gives 79.03.
    await user.type(within(calc).getByLabelText('Dužina (km)'), '62.07')
    await user.type(within(calc).getByLabelText('Uspon (m)'), '3456')
    await user.type(within(calc).getByLabelText('Spust (m)'), '3133')
    await user.type(within(calc).getByLabelText('Sati'), '7')
    await user.type(within(calc).getByLabelText('Minuti'), '28')
    await user.type(within(calc).getByLabelText('Sekunde'), '31')

    expect(within(calc).getByText('BTL poeni:')).toBeVisible()
    expect(within(calc).getByText('79,03')).toBeVisible()
    expect(within(calc).queryByText('Unesi dužinu i vreme.')).not.toBeInTheDocument()
  })

  it('empties the six boxes on Reset and hands the cursor back to the first', async () => {
    const user = setupUser()
    renderAt('/sr')

    const calc = must(
      (await screen.findByRole('heading', { name: 'BTL kalkulator' })).closest('section'),
      'the widget around that heading',
    )

    const reset = within(calc).getByRole('button', { name: 'Reset' })
    const length = within(calc).getByLabelText('Dužina (km)')

    /* Nothing typed, so there is nothing to undo and the button says so. It is
       refused rather than switched off, so it can still be pressed, and pressing
       it has to leave the widget exactly as it was. */
    expect(reset).toHaveAttribute('aria-disabled', 'true')
    await user.click(reset)
    expect(reset).toHaveAttribute('aria-disabled', 'true')
    /* Nothing happened, and the cursor is the half of that which can be seen: a
       refused Reset that still threw the cursor into the first box would be
       doing something. */
    expect(length).not.toHaveFocus()

    /* Any one of the six brings it to life, and the one tried here is the last
       of them: a check that reads the length alone would call a widget with a
       time typed into it empty. */
    await user.type(within(calc).getByLabelText('Sekunde'), '31')
    expect(reset).toHaveAttribute('aria-disabled', 'false')

    await user.type(length, '62.07')
    await user.type(within(calc).getByLabelText('Uspon (m)'), '3456')
    await user.type(within(calc).getByLabelText('Spust (m)'), '3133')
    await user.type(within(calc).getByLabelText('Sati'), '7')
    await user.type(within(calc).getByLabelText('Minuti'), '28')
    expect(within(calc).getByText('79,03')).toBeVisible()

    /* And one box written behind React's back, which is what a box holding
       writing the browser will not read as a number amounts to: React believes
       the value it last wrote, sees no change on the way to empty, and leaves
       the box alone. Emptying the widget's own record is therefore not enough,
       and this is the half that says so.

       In Chrome the writing is a lone minus sign, which the box reports as an
       empty value. jsdom does not sanitise the value of a number box, so here it
       is a number React has not been told about. Different writing, same
       mechanism, same box left full under an emptied widget. */
    const seconds = within(calc).getByLabelText('Sekunde')

    /* Emptied through the widget, so the record holds nothing for it, and then
       written to directly, so the box does. React now believes the box is empty
       and will not write to it again. */
    await user.clear(seconds)
    ;[seconds]
      .filter((node): node is HTMLInputElement => node instanceof HTMLInputElement)
      .forEach((box) => {
        box.value = '31'
      })

    await user.click(reset)

    for (const label of ['Dužina (km)', 'Uspon (m)', 'Spust (m)', 'Sati', 'Minuti', 'Sekunde']) {
      expect(within(calc).getByLabelText(label)).toHaveValue(null)
    }

    expect(reset).toHaveAttribute('aria-disabled', 'true')
    expect(within(calc).getByText('Unesi dužinu i vreme.')).toBeVisible()
    // And the cursor is where the next race is typed, not where it was pressed.
    expect(length).toHaveFocus()
  })

  it('counts a box that holds writing the browser will not read as a number', async () => {
    const user = setupUser()
    renderAt('/sr')

    const calc = must(
      (await screen.findByRole('heading', { name: 'BTL kalkulator' })).closest('section'),
      'the widget around that heading',
    )

    const reset = within(calc).getByRole('button', { name: 'Reset' })
    const length = within(calc).getByLabelText('Dužina (km)')

    /* What the browser does and jsdom does not. A box of type number reports an
       empty value for writing it refuses to read as a number, a lone minus sign
       or `1e`, while the characters stand in the box where anybody can see them.
       jsdom does not sanitise the value of a number box, so no typing produces
       that state here; the browser's own answer is put on the node instead.
       Measured in Chrome on 21.08.2026, where typing „-" into the length does
       exactly this. */
    const emptied = (bad: boolean) => {
      Object.defineProperty(length, 'validity', { configurable: true, value: { badInput: bad } })
      fireEvent.input(length, { target: { value: '' } })
    }

    await user.type(length, '5')
    expect(reset).toHaveAttribute('aria-disabled', 'false')

    // Empty, and nothing wrong with it: the widget is back where it started.
    emptied(false)
    expect(reset).toHaveAttribute('aria-disabled', 'true')

    /* The same empty value, this time because the browser will not read what is
       written in the box. The writing is there, so the button has to be. Both
       directions, because the second assertion alone would pass on a widget that
       had simply never noticed the box was emptied. */
    emptied(true)
    expect(reset).toHaveAttribute('aria-disabled', 'false')
  })

  it('hides the news and the sponsor while they have nothing fresh to say', async () => {
    renderAt('/sr')

    await screen.findByRole('heading', { name: 'Reč predsednika' })
    expect(screen.queryByRole('heading', { name: 'Vesti' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sponzor dana' })).not.toBeInTheDocument()
  })
})

describe('freshNews', () => {
  const item = (id: string, date: string): NewsItem => ({ id, date, titleKey: 'x', textKey: 'y' })

  it('drops anything older than sixty days', () => {
    const items = [item('staro', '2026-01-01'), item('novo', '2026-07-01')]

    expect(freshNews(items, '2026-07-29').map((one) => one.id)).toEqual(['novo'])
  })

  it('takes the three newest, newest first', () => {
    const items = ['2026-07-01', '2026-07-20', '2026-07-10', '2026-07-25'].map((date) =>
      item(date, date),
    )

    expect(freshNews(items, '2026-07-29').map((one) => one.id)).toEqual([
      '2026-07-25',
      '2026-07-20',
      '2026-07-10',
    ])
  })
})
