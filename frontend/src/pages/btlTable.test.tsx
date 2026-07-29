import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '../i18n/I18nProvider'
import { renderAt } from '../test/render'
import { BtlTable } from './BtlTable'

/* The league's own table: one standing for the season with everybody in it. The
 * rankings screen is the one that splits by gender and category. */

describe('the BTL table', () => {
  it('puts everybody in one table, and says what that table is', async () => {
    renderAt('/sr/btl-tabela')

    expect(await screen.findByRole('heading', { level: 1, name: 'BTL tabela' })).toBeVisible()
    expect(screen.getByText(/muškarci i žene zajedno|svi članovi zajedno/i)).toBeVisible()

    const table = await screen.findByRole('table', { name: 'BTL tabela' })
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1)
    expect(within(table).getByRole('columnheader', { name: 'Bodovi' })).toBeVisible()
  })

  it('leads from a row to the competitor it belongs to', async () => {
    const user = userEvent.setup()
    renderAt('/sr/btl-tabela')

    const table = await screen.findByRole('table', { name: 'BTL tabela' })
    const first = within(table).getAllByRole('row')[1]

    await user.click(within(first).getByRole('link'))

    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
    expect(screen.getByRole('table', { name: 'Rezultati' })).toBeVisible()
  })

  it('opens on a season with a field in it, and takes another one when asked', async () => {
    const user = userEvent.setup()
    renderAt('/sr/btl-tabela')

    const season = await screen.findByLabelText('Sezona')
    const opened = (season as HTMLSelectElement).value

    await user.selectOptions(season, '2019')

    expect((season as HTMLSelectElement).value).toBe('2019')
    expect(opened).not.toBe('2019')
    expect(await screen.findByRole('table', { name: 'BTL tabela' })).toBeVisible()
  })
})

describe('a season nobody raced in', () => {
  const realFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('says so instead of showing an empty table', async () => {
    // A result by somebody who is not in the list of competitors: the season
    // exists, and the standing for it is still empty.
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      new Response(
        String(input).endsWith('competitors.json')
          ? '[]'
          : JSON.stringify([
              {
                id: 'r1',
                memberNumber: 'M0001',
                raceId: 'race',
                eventName: 'Trka',
                date: '2026-05-05',
                distanceKm: 10,
                ascentM: 0,
                descentM: 0,
                seconds: 3000,
                points: 12,
                category: 'short',
              },
            ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch

    render(
      <I18nProvider locale="sr">
        <MemoryRouter>
          <BtlTable />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(
      await screen.findByText('U ovoj sezoni i kategoriji nema nijednog rezultata.'),
    ).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
