import { screen, waitFor } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { renderAt } from '../test/render'

/**
 * What a visitor's browser is allowed to ask the server for.
 *
 * A screen reads a resource by fetching the whole of it, so "the words never
 * reach the page" is not the same as "the words never reach the reader". They
 * are in the tab either way, one keystroke of the network panel apart.
 *
 * The moderation queue is the one that matters here. It carries the addresses
 * of people who have registered and are not members yet, and the bodies of
 * comments nobody has approved, one of which is the referral spam this portal
 * exists to keep off itself. It is administration's to read, and administration
 * is behind a sign-in.
 *
 * Written as a sweep rather than as a note on one screen, because this went
 * wrong by accident: a hook the event page calls started reading the queue in
 * order to find approved comments, and nothing said so. The next hook that does
 * it will not say so either.
 */

/* Every public address a visitor can reach without signing in, one of each
   shape. The slugs are records that exist in the generated data. */
const PUBLIC = [
  '/sr',
  '/sr/kalendar',
  '/sr/kalendar/fruskogorski-maraton-2010-05-08',
  '/sr/takmicari',
  '/sr/takmicar/000001',
  '/sr/timovi',
  '/sr/tabela',
  '/sr/top-liste',
  '/sr/lige',
  '/sr/pravilnik',
]

describe('what a visitor downloads', () => {
  it.each(PUBLIC)('never asks for the moderation queue on %s', async (address) => {
    const asked: string[] = []
    const real = globalThis.fetch

    /* The stub in test/setup reads the file off disc; this one writes down what
       was asked for and then hands the question on, so the screen still gets
       its data and renders as it would. */
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      asked.push(String(input))
      return real(input)
    })

    renderAt(address)

    /* Waited for rather than read straight away: a resource is fetched from an
       effect, so a check that runs before the first paint settles sees nothing
       asked for at all and passes on every address. */
    await waitFor(() => {
      expect(asked.length).toBeGreaterThan(0)
    })
    await screen.findByRole('main')

    expect(asked.some((one) => one.includes('verification'))).toBe(false)

    cleanup()
    vi.stubGlobal('fetch', real)
  })

  /* The other half, so the sweep above is known to be looking at something. The
     queue is fetched, by the screen whose queue it is. */
  it('asks for it on the screen that decides on it', async () => {
    const asked: string[] = []
    const real = globalThis.fetch

    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      asked.push(String(input))
      return real(input)
    })

    renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    await waitFor(() => {
      expect(asked.some((one) => one.includes('verification'))).toBe(true)
    })

    cleanup()
    vi.stubGlobal('fetch', real)
  })
})
