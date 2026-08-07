import { act, cleanup, screen } from '@testing-library/react'
import { EXTRA_ADDRESSES, ROUTES } from '../app/routes'
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
 *
 * Read as production reads: the two development controls are switched off here.
 * They fetch the moderators on every screen they are drawn on, and they are
 * drawn on none in production (src/dev/tools.ts). A sweep that left them on
 * would have to allow that file everywhere, and it is the one thing on this
 * list besides the queue that carries staff names, addresses and rights.
 */

vi.mock('../dev/tools', () => ({ devToolsEnabled: () => false }))

/** What no public screen may ask for, by the name in the address. */
const DENIED = ['verification', 'moderators']

/**
 * Every address a signed-out visitor can reach, one for each entry of the route
 * table.
 *
 * Held against the table below rather than trusted as written. A list typed out
 * by hand stops being every address the moment somebody adds a screen, and this
 * one had already missed eight when it was first written.
 *
 * The addresses of an account are here too, and not excluded as "behind a sign
 * in": nothing guards them. Each of those screens runs its hooks and only then
 * decides to draw `SignedOut`, so a visitor who types one has already fetched
 * whatever it reads.
 */
const PUBLIC = [
  '/sr',
  '/sr/kalendar',
  '/sr/kalendar/dan/2027-05-08',
  '/sr/kalendar/fruskogorski-maraton-2010-05-08',
  '/sr/kalendar/fruskogorski-maraton-2010-05-08/ocena',
  '/sr/kalendar/fruskogorski-maraton-2010-05-08/prijava',
  '/sr/takmicari',
  '/sr/takmicar/000001',
  '/sr/takmicar/000001/priznanja',
  '/sr/timovi',
  '/sr/tim/dunavski-trkaci',
  '/sr/novi-tim',
  '/sr/tabela',
  '/sr/top-liste',
  '/sr/lige',
  '/sr/liga/btl-2027',
  '/sr/liga/btl-2027/rezultati',
  '/sr/pravilnik',
  '/sr/politika-privatnosti',
  '/sr/uslovi-koriscenja',
  '/sr/registracija',
  '/sr/prijava',
  '/sr/moj-profil',
  '/sr/moji-rezultati',
  '/sr/moja-clanarina',
  '/sr/podesavanja',
  '/sr/poruke',
  '/sr/poruke/msg-1',
  '/sr/rezultat/novi',
]

/**
 * A route pattern as what it matches: `takmicar/:memberNumber` against
 * `/sr/takmicar/000001`.
 *
 * Whole segments and anchored at both ends, because the first attempt compared
 * first segments only: `kalendar` then stood for the month, the day, an event,
 * the report of a result and the rating alike, and a new screen under any of
 * them joined the portal without joining this sweep.
 */
function matcher(path: string): RegExp {
  return new RegExp(`^/sr${path === '' ? '' : `/${path.replaceAll(/:[^/]+/g, '[^/]+')}`}$`)
}

/**
 * Waits until the screen has stopped asking for things.
 *
 * Not "until something was asked for", which is what this did and was the whole
 * of its weakness: the shell fetches before any screen does, and a screen that
 * reads a second resource inside a `Resource` of the first only mounts once the
 * first has arrived. Measured on the event page, the old check fired while four
 * files had been asked for and the comments had not been reached at all, so the
 * one leak this file exists to catch walked straight past it.
 */
async function quiet(asked: string[]): Promise<void> {
  for (let still = 0; still < 3; ) {
    const before = asked.length

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 5)
      })
    })

    still = asked.length === before ? still + 1 : 0
  }
}

/** What was in place before a case wrapped it, so it can be put back exactly.
 *  `vi.unstubAllGlobals` is the wrong tool here: it reverts to what stood before
 *  the setup file installed its own reader of the disc, which leaves every
 *  later case in this file with no fetch at all. */
let unwrapped: typeof globalThis.fetch | null = null

/** Writes down every address asked for, and hands the question on so the screen
 *  renders exactly as it would. */
function watch(): string[] {
  const asked: string[] = []
  const real = globalThis.fetch

  unwrapped = real
  globalThis.fetch = async (input: RequestInfo | URL) => {
    asked.push(String(input))
    return real(input)
  }

  return asked
}

describe('what a visitor downloads', () => {
  it('visits every address the route table has, administration aside', () => {
    const every = [...ROUTES, ...EXTRA_ADDRESSES]
      .map((route) => route.path)
      .filter((path) => !path.startsWith('administracija'))
    const missing = every.filter((path) => !PUBLIC.some((one) => matcher(path).test(one)))

    expect(missing).toEqual([])
  })

  it.each(PUBLIC)('asks for nothing of anybody else on %s', async (address) => {
    const asked = watch()

    renderAt(address)

    await quiet(asked)

    /* The screen is really there. Without this the sweep would pass on an
       address that fell through to the page saying there is none, and six of
       these read nothing at all, so counting what was asked for proves nothing
       about them. */
    expect(await screen.findByRole('heading', { level: 1 })).toBeVisible()
    expect(asked.filter((one) => DENIED.some((name) => one.includes(name)))).toEqual([])
  })

  /* The other half, so the sweep above is known to be looking at something: the
     queue is fetched, by the screen whose queue it is. */
  it('asks for it on the screen that decides on it', async () => {
    const asked = watch()

    renderAt('/sr/administracija/verifikacija/komentari', 'superadmin')

    await quiet(asked)

    expect(asked.some((one) => one.includes('verification'))).toBe(true)
  })

  /* And that the waiting is long enough to see a screen's second wave: the
     comments under an event are read inside the `Resource` of the event, so
     they are asked for only after it has arrived. */
  it('waits long enough to see what a screen reads second', async () => {
    const asked = watch()

    renderAt('/sr/kalendar/fruskogorski-maraton-2010-05-08')

    await quiet(asked)

    expect(asked.some((one) => one.includes('comments'))).toBe(true)
  })
})

afterEach(() => {
  cleanup()

  if (unwrapped !== null) {
    globalThis.fetch = unwrapped
    unwrapped = null
  }
})
