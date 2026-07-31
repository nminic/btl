import { screen, within } from '@testing-library/react'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'
import { freshNews, type NewsItem } from './home/content'

describe('Home', () => {
  /* Two thirds of standing and prose against one third of figures and things to
     do (owner, 31.07.2026). The reading order is the left column whole and then
     the right one, which is also the order on a phone, where the two columns
     become one. */
  it('lays the page out in two columns, the boards first and the figures beside them', async () => {
    renderAt('/sr')

    await screen.findByRole('heading', { level: 2, name: 'Priprema, pozor, SAD!' })
    // The address is written text and arrives on its own request, so it is
    // waited for as well before the order is read.
    await screen.findByRole('heading', { level: 2, name: 'Reč predsednika' })

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)

    expect(headings).toEqual([
      'Top 10 muškarci',
      'Top 10 žene',
      'Reč predsednika',
      expect.stringContaining('Sezona'),
      'Priprema, pozor, SAD!',
      'BTL kalkulator',
      expect.stringContaining('Članarina za BTL'),
    ])
  })

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
     counters (owner, 30.07.2026). What remains is the one date a visitor can act
     on: when membership opens. */
  it('says when membership opens rather than counting down to the season', async () => {
    renderAt('/sr')

    expect(await screen.findByText(/Otvara se za/)).toBeVisible()
    expect(screen.queryByText(/do početka sezone/)).not.toBeInTheDocument()
  })

  it('groups a recurring event into one row instead of five', async () => {
    renderAt('/sr')

    const card = (await screen.findByRole('heading', { name: 'Priprema, pozor, SAD!' })).closest(
      'section',
    )!
    const titles = within(card)
      .getAllByRole('listitem')
      .map((row) => row.textContent!.replace(/[\d./]/g, ''))

    // No event name appears twice: repeats collapse into a single row.
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('says what membership costs and when that changes', async () => {
    renderAt('/sr')

    const slot = (await screen.findByRole('heading', { name: /Članarina za BTL/ })).closest(
      'section',
    )!

    expect(within(slot).getByText(/Otvara se za|Cena raste/)).toBeVisible()
  })

  it('shows both top tens and links to the whole standing', async () => {
    renderAt('/sr')

    const men = (await screen.findByRole('heading', { name: 'Top 10 muškarci' })).closest('section')!

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

    const calc = (await screen.findByRole('heading', { name: 'BTL kalkulator' })).closest(
      'section',
    )!
    expect(within(calc).getByText('Unesi dužinu i vreme.')).toBeVisible()

    // The golden race: 62.07 km, 3456 m up, 3133 m down, 7:28:31 gives 79.03.
    await user.type(within(calc).getByLabelText('Dužina staze (km)'), '62.07')
    await user.type(within(calc).getByLabelText('Uspon (m)'), '3456')
    await user.type(within(calc).getByLabelText('Spust (m)'), '3133')
    await user.type(within(calc).getByLabelText('h'), '7')
    await user.type(within(calc).getByLabelText('min'), '28')
    await user.type(within(calc).getByLabelText('s'), '31')

    expect(within(calc).getByText('79,03')).toBeVisible()
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
