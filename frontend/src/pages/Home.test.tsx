import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'
import { freshNews, type NewsItem } from './home/content'

describe('Home', () => {
  it('lays the widgets out in the order the rulebook fixes', async () => {
    renderAt('/sr')

    await screen.findByRole('heading', { level: 2, name: 'Priprema, pozor, SAD!' })

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)

    expect(headings).toEqual([
      expect.stringContaining('Sezona'),
      'Priprema, pozor, SAD!',
      expect.stringContaining('Članarina za BTL'),
      'Top 10 muškarci',
      'Top 10 žene',
      'BTL kalkulator',
      'Kako radi BTL u tri koraka',
      'Zajednica u brojkama',
    ])
  })

  it('counts down to the start of the season', async () => {
    renderAt('/sr')

    expect(await screen.findByText(/do početka sezone 2027/)).toBeVisible()
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
    expect(within(men).getByRole('link', { name: 'Cela rang lista' })).toHaveAttribute(
      'href',
      '/sr/rang-liste?pol=m',
    )
  })

  it('carries no heading of its own and nothing to click', async () => {
    renderAt('/sr')

    await screen.findByText(/^Najviše/)
    expect(screen.queryByRole('heading', { name: /Trke po dužini/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /kategorija/ })).not.toBeInTheDocument()
  })

  it('works the calculator, and waits quietly until it can answer', async () => {
    const user = userEvent.setup()
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

    await screen.findByRole('heading', { name: 'Zajednica u brojkama' })
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
