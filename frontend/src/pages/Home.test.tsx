import { screen } from '@testing-library/react'
import { renderAt } from '../test/render'

describe('Home', () => {
  it('shows the season counters from the data layer', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('heading', { name: 'Sezona 2027' })).toBeVisible()
    expect(screen.getByText('Članova')).toBeInTheDocument()
    expect(screen.getByText('Kilometara')).toBeInTheDocument()
  })

  it('lists the nearest events in date order, with the race count', async () => {
    renderAt('/sr')

    const items = await screen.findAllByRole('listitem')
    const events = items.filter((item) => item.className === 'home__event')

    expect(events).toHaveLength(3)
    expect(events[0]).toHaveTextContent('Fruškogorski maraton')
    expect(events[0]).toHaveTextContent('2 trke')
    expect(events[2]).toHaveTextContent('BTL Round')
  })

  it('links to the full calendar', async () => {
    renderAt('/sr')

    expect(await screen.findByRole('link', { name: 'Ceo kalendar' })).toHaveAttribute(
      'href',
      '/sr/kalendar',
    )
  })
})
