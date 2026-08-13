import { matchingMedia } from '../test/media'
import { must } from '../test/at'
import { screen, within } from '@testing-library/react'
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
