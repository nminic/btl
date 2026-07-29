import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderAt } from '../test/render'

describe('TeamDetail', () => {
  it('shows the team, its totals and its members with what each contributed', async () => {
    renderAt('/sr/tim/dunavski-trkaci')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Zbirno, ceo tim' })).toBeVisible()

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.length).toBeGreaterThan(1)

    // Ordered by what each member brought, and the top three marked. The last
    // row is a member who has not raced yet, and shows zeros rather than a gap.
    expect(rows[0].className).toBe('podium')
    expect(rows[rows.length - 1]).toHaveTextContent('0,00')
  })

  it('leads from a member back to their profile', async () => {
    renderAt('/sr/tim/dunavski-trkaci')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    expect(within(rows[0]).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/takmicar/'),
    )
  })

  it('holds up for a team nobody has joined yet', async () => {
    renderAt('/sr/tim/novoosnovani-tim')

    expect(await screen.findByRole('heading', { level: 1, name: 'Novoosnovani tim' })).toBeVisible()
    expect(screen.getByText('Ovaj tim još nema članova.')).toBeVisible()
  })

  it('says so when the team does not exist', async () => {
    renderAt('/sr/tim/nepostojeci')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ovog tima nema.' })).toBeVisible()
  })

  it('is reachable from the list of teams', async () => {
    const user = userEvent.setup()
    renderAt('/sr/timovi')

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)
    await user.click(within(rows[0]).getAllByRole('link')[0])

    expect(await screen.findByRole('heading', { name: 'Zbirno, ceo tim' })).toBeVisible()
  })
})

describe('LeagueDetail', () => {
  it('lists the events that count towards the league', async () => {
    renderAt('/sr/liga/btl-2027')

    expect(await screen.findByRole('heading', { level: 1, name: /Balkanska trkačka liga 2027/ }))
      .toBeVisible()

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows.length).toBeGreaterThan(1)
    expect(within(rows[0]).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/sr/kalendar/'),
    )
  })

  it('shows the rules and the prizes that have been written', async () => {
    renderAt('/sr/liga/btl-2027')

    expect(await screen.findByRole('heading', { name: 'Propozicije' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Nagrade' })).toBeVisible()
  })

  it('hides both sections while neither has been written', async () => {
    renderAt('/sr/liga/runtrace-2027')

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('heading', { name: 'Propozicije' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nagrade' })).not.toBeInTheDocument()
  })

  it('holds up for a league with no events yet', async () => {
    renderAt('/sr/liga/planinska-2027')

    expect(await screen.findByRole('heading', { level: 1, name: /Planinska liga/ })).toBeVisible()
    expect(screen.getByText('Ovoj ligi još nije dodeljen nijedan događaj.')).toBeVisible()
  })

  it('says so when the league does not exist', async () => {
    renderAt('/sr/liga/nepostojeca')

    expect(await screen.findByRole('heading', { level: 1, name: 'Ove lige nema.' })).toBeVisible()
  })

  it('is reachable from the list of leagues', async () => {
    const user = userEvent.setup()
    renderAt('/sr/lige')

    await user.click(await screen.findByRole('link', { name: /RunTrace liga/ }))

    expect(await screen.findByRole('heading', { name: /Događaji koji ulaze u ligu/ })).toBeVisible()
  })
})
