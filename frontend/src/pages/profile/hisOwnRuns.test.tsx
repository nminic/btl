import { act, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expectFrontPage, renderAt } from '../../test/render'
import { SLOW } from '../../test/slow'
import { hisRunsFrom, serverThat } from '../../test/serverAnswers'

/* THE PROFILE ASKS FOR HIS RUNS AND NOBODY ELSE'S (inkrement „Poboljšanje performansi”, korak 1, owner,
   21.11.2026: „Profil traži samo rezultate tog člana ... umesto rezultata cele lige”).

   THE AXES, and where the set-up keeps each pair of sources apart:

   - whose runs: the member on the address against the member who is READING, and against the first
     member of the file. The reader is 000001, the profile is 000002, so a profile that asked by the
     session's number or by the first number on the list asks a different address and draws other races;
   - which door: his own two against the league's two. The league's are never asked, so a profile still
     reading the whole league fails by name and not only by size;
   - one member after another: a profile opened from another one, with the second's runs still on their
     way, must not draw the first's in the meantime. The races of the first that the second never ran are
     read off the file, and the case says first that there are some;
   - an address with no number on it: answered as a profile nobody may reach, and nothing is asked. */

const FIRST = '000001'
const SECOND = '000002'

/** The league's files of runs, which the disc serves at both doors of each (`test/setup.ts`). */
const THE_FILE: unknown = JSON.parse(readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'results.json'), 'utf-8'))
const THE_UNSCORED: unknown = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'unscored-results.json'), 'utf-8'),
)

/** The names of the races one member ran, scored and unscored, as his two doors serve them. */
function racesOf(memberNumber: string): Set<string> {
  return new Set(
    [...hisRunsFrom(THE_FILE, memberNumber), ...hisRunsFrom(THE_UNSCORED, memberNumber)].map((one) =>
      String(Reflect.get(Object(one), 'raceName')),
    ),
  )
}

/** The races drawn in the table, in its order. */
function drawnRaces(): string[] {
  return within(screen.getByRole('table', { name: 'Trke' }))
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
}

function asked(server: { asked: { path: string }[] }): string[] {
  return server.asked.map((one) => one.path)
}

describe('the runs a profile asks for', () => {
  it('asks for his two doors, by the number on the address, and for neither door of the league', async () => {
    const server = serverThat(() => null)

    try {
      renderAt(`/sr/takmicar/${SECOND}?sezona=sve`, 'competitor', FIRST)

      expect(await screen.findByRole('table', { name: 'Trke' }, { timeout: SLOW / 2 })).toBeVisible()

      expect(asked(server)).toContain(`/api/competitors/${SECOND}/results`)
      expect(asked(server)).toContain(`/api/competitors/${SECOND}/unscored-results`)
      expect(asked(server), 'the profile asked for the runs of the member who is reading').not.toContain(
        `/api/competitors/${FIRST}/results`,
      )
      expect(asked(server), 'the profile still reads the whole league').not.toContain('/api/results')
      expect(asked(server), 'the profile still reads the whole league').not.toContain('/api/unscored-results')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('draws the runs of the member on the address, and not of the member reading it', async () => {
    const mine = racesOf(SECOND)
    const theReaders = [...racesOf(FIRST)].filter((name) => !mine.has(name))

    expect(theReaders.length, 'the reader ran no race the profile did not, so a swap draws the same').toBeGreaterThan(0)

    renderAt(`/sr/takmicar/${SECOND}?sezona=sve`, 'competitor', FIRST)

    await screen.findByRole('table', { name: 'Trke' }, { timeout: SLOW / 2 })
    const drawn = drawnRaces()

    expect(drawn.length).toBeGreaterThan(0)
    expect(drawn.filter((name) => !mine.has(name)), 'races the member on the address never ran').toEqual([])
  }, SLOW)

  it('never draws the runs of the member before while the next one is on his way', async () => {
    const next = racesOf(FIRST)

    let letThrough: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      letThrough = resolve
    })
    const server = serverThat((path) =>
      path === `/api/competitors/${FIRST}/results`
        ? held.then(() => Response.json(hisRunsFrom(THE_FILE, FIRST)))
        : null,
    )

    try {
      const { router } = renderAt(`/sr/takmicar/${SECOND}?sezona=sve`)

      await screen.findByRole('table', { name: 'Trke' }, { timeout: SLOW / 2 })
      /* Read off what this page drew, so every race counted below was on the screen before. */
      const onlyHis = drawnRaces().filter((name) => !next.has(name))

      expect(onlyHis.length, 'the first member drew no race the next one did not run, so this measures nothing').toBeGreaterThan(0)

      await act(async () => {
        await router.navigate(`/sr/takmicar/${FIRST}?sezona=sve`)
      })

      for (const name of onlyHis) {
        expect(screen.queryByRole('link', { name }), `${name} of the member before was drawn on the next one`).toBeNull()
      }

      letThrough()

      await waitFor(() => {
        expect(screen.getByRole('table', { name: 'Trke' })).toBeVisible()
      })
      for (const name of onlyHis) {
        expect(screen.queryByRole('link', { name })).toBeNull()
      }
    } finally {
      letThrough()
      server.stop()
    }
  }, SLOW)

  it('answers an address with no number on it with the front page, asking for nobody', async () => {
    const server = serverThat(() => null)

    try {
      renderAt('/sr/takmicar/-bez-broja')

      await expectFrontPage()
      expect(asked(server).filter((path) => path.startsWith('/api/competitors/'))).toEqual([])
    } finally {
      server.stop()
    }
  }, SLOW)
})
