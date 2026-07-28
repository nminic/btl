import { screen, within } from '@testing-library/react'
import { renderAt } from '../test/render'

describe('Home', () => {
  it('shows the league counters from the data layer', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('heading', { name: 'Liga u brojkama' })).toBeVisible()
    expect(screen.getByText('Članova')).toBeInTheDocument()
    expect(screen.getByText('Kilometara')).toBeInTheDocument()
  })

  it('lists only events that are still ahead, in date order', async () => {
    renderAt('/sr')

    const list = await screen.findByRole('list', { name: 'Sledeći događaji' })
    const dates = within(list)
      .getAllByRole('listitem')
      .map((item) => item.firstElementChild!.textContent!)

    expect(dates).toHaveLength(3)
    // The data reaches back to 2014, so the oldest race must not surface here.
    const years = dates.map((date) => Number(date.match(/\d{4}/)![0]))
    expect(years.every((year) => year >= new Date().getFullYear())).toBe(true)
    expect([...dates].sort()).toEqual(dates)
  })

  it('links to the full calendar', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('link', { name: 'Ceo kalendar' })).toHaveAttribute(
      'href',
      '/sr/kalendar',
    )
  })
})
