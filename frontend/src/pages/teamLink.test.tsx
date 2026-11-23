import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen } from '@testing-library/react'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'

/**
 * THE TEAM'S OWN PAGE UNDER ITS WORDS, ONLY WHERE IT HAS ONE (PDL P13, 11.08.2026: „neobavezni link"; on
 * the page since 23.11.2026).
 *
 * <p>Both halves, because a page that drew a link for every team would send a reader to nothing, and one
 * that drew none would have lost the field the owner asked for. The second is the same team served with
 * no link at all: `Team.link` is optional because the portal also builds team records of its own that
 * are no answer of any route (`Teams.tsx`), and those are read as having none.
 */
const TEAMS: { slug: string; link?: string }[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'teams.json'), 'utf-8'),
)

describe('the link of a team', () => {
  it('is drawn as the address it is, opening in a tab of its own', async () => {
    renderAt('/sr/tim/dunavski-trkaci')

    const link = await screen.findByRole('link', { name: 'https://dunavski-trkaci.example' })

    expect(link).toHaveAttribute('href', 'https://dunavski-trkaci.example')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('is not drawn for a team served without one', async () => {
    const server = serverThat((path, init) =>
      path === '/api/teams' && (init?.method ?? 'GET') === 'GET'
        ? new Response(
            JSON.stringify(
              TEAMS.map(({ link: _link, ...rest }) => rest),
            ),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        : null,
    )

    try {
      renderAt('/sr/tim/dunavski-trkaci')

      await screen.findByRole('heading', { level: 1, name: 'Dunavski trkači' })

      expect(screen.queryByRole('link', { name: /dunavski-trkaci\.example/ })).toBeNull()
    } finally {
      server.stop()
    }
  })
})
