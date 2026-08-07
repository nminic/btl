import { cleanup, screen, waitFor } from '@testing-library/react'
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
 */

/** Named by what is in them rather than one by one, so a new resource of the
 *  same kind is caught by the name it is given. */
const DENIED = ['verification', 'submissions']

/**
 * Every public address, one of each shape.
 *
 * Anchored to the route table below rather than trusted as written: a list of
 * addresses typed out by hand is a list that stops being every address the
 * moment somebody adds a screen, and this one had already missed eight when it
 * was first written.
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
  '/sr/znacke',
  '/sr/cenovnik',
  '/sr/pravilnik',
  '/sr/politika-privatnosti',
  '/sr/uslovi-koriscenja',
  '/sr/registracija',
  '/sr/prijava',
]

/** The first segment of an address, which is what one shape of screen is. */
const shapeOf = (path: string) => path.replace(/^\//, '').split('/')[1] ?? ''

describe('what a visitor downloads', () => {
  it('covers every shape of public screen the route table has', () => {
    /* The anchor. Every address in the table that is not administration and not
       somebody's own account has a screen of its shape in the sweep, so a new
       public screen either joins the list or fails here. */
    const shapes = new Set(PUBLIC.map(shapeOf))
    /* The whole table, the addresses with a record in them included: those are
       the ones a sweep written by hand forgets, because they cannot be typed
       without a record to point at. */
    const every = [...ROUTES, ...EXTRA_ADDRESSES].map((route) => route.path)
    const missing = every.filter((path) => {
      const shape = path.split('/')[0] ?? ''

      return shape !== 'administracija' && !ACCOUNT.includes(shape) && !shapes.has(shape)
    })

    expect(missing).toEqual([])
    expect(PUBLIC.length).toBeGreaterThan(20)
  })

  it.each(PUBLIC)('asks for no queue of anybody else on %s', async (address) => {
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

    expect(asked.filter((one) => DENIED.some((name) => one.includes(name)))).toEqual([])
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
  })
})

/**
 * The addresses of somebody's own account, which are not public and are not
 * administration either.
 *
 * Left out of the sweep rather than swept: they are behind a sign-in, so what
 * they fetch is a question about what one member may read about themselves,
 * which is a different question from this one.
 */
const ACCOUNT = [
  'moj-profil',
  'moji-rezultati',
  'moja-clanarina',
  'poruke',
  'podesavanja',
  'rezultat',
]

/* Every case installs a wrapper around fetch, and a failed assertion must not
   leave it installed for the next one: the wrapper closes over that case's own
   list, so a leak would be written down against the wrong address. */
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
