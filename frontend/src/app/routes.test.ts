import { routeObjects } from './routeObjects'
import {
  ACCOUNT_ROUTES,
  CONTACT_ADDRESS,
  EXTRA_ADDRESSES,
  FOOTER_ROUTES,
  NAV,
  navForRole,
  ROUTES,
  seoKeyFor,
} from './routes'

/**
 * Every address the router table serves, in the order it serves them.
 *
 * The children of all the top-level entries rather than of the one at a known
 * position: the redirect at the root has no children of its own, so the table
 * can be read whole and there is no index here to keep in step with the one in
 * routeObjects.
 */
function servedPaths(): string[] {
  /* The children of the locale layout, and only those. A child path is relative
     to its parent, so two layouts could each legitimately serve `dashboard` and
     flattening them into one list would report a clash that is not one, and hand
     `seoKeyFor` a path from a namespace it does not answer for. There is one
     parent with children today; naming it is what keeps that from being a fact
     the test silently depends on. */
  const locale = routeObjects.filter((route) => route.path === '/:locale')

  expect(locale).toHaveLength(1)

  return locale
    .flatMap((route) => route.children ?? [])
    .map((child) => child.path)
    .filter((path): path is string => path !== undefined)
}

describe('navForRole', () => {
  it('shows the seven names the owner fixed, in that order, and administration last', () => {
    /* Owner, 04.08.2026: "samo osnovna navigacija Pravilnik / Takmičari / BTL
       tabele / Top liste / Timovi / Lige / Kalendar". Administration is the
       eighth and is shown to nobody else. */
    expect(navForRole('superadmin').map((section) => section.id)).toEqual([
      'rules',
      'people',
      'table',
      'boards',
      'teams',
      'leagues',
      'calendar',
      'admin',
    ])
  })

  it('hides administration from everyone who is not staff', () => {
    expect(navForRole('visitor').map((section) => section.id)).not.toContain('admin')
    expect(navForRole('competitor').map((section) => section.id)).not.toContain('admin')
    expect(navForRole('moderator').map((section) => section.id)).toContain('admin')
  })

  it('leaves everything except administration in place for a visitor', () => {
    expect(navForRole('visitor')).toEqual(NAV.filter((section) => section.staffOnly !== true))
  })
})

describe('the shape of the navigation', () => {
  it('is one word one screen, with nothing that opens', () => {
    /* Owner, 04.08.2026: "Više neće biti multinivo navigacije". Every entry
       leads somewhere, so there is no panel to open and nothing behind a word
       that a reader has to guess at. */
    expect(NAV.map((section) => section.path)).toEqual([
      'pravilnik',
      'takmicari',
      'tabela',
      'top-liste',
      'timovi',
      'lige',
      'kalendar',
      'administracija',
    ])
  })

  it('serves no address twice, and none of the three that were deleted', () => {
    /* The story of the league and the page of prices went with the group they
       stood in, and the ducats became a section of the rulebook (owner,
       04.08.2026). An address left behind would be a page nothing links to,
       which is the very thing that put those three into a group in the first
       place. Read out of the real router table rather than out of ROUTES,
       because that is what is served. */
    const served = servedPaths()

    expect(new Set(served).size).toBe(served.length)
    expect(served).toContain('pravilnik')
    expect(served).not.toContain('o-ligi')
    expect(served).not.toContain('clanarina')
    expect(served).not.toContain('znacke')
  })

  it('keeps the two administrative sections as addresses, off the navigation', () => {
    /* They are reached from the panel and from the navigation beside each
       screen. Off the header, but still served: a moderator opening the entities
       from the panel must not meet a redirect. */
    const served = servedPaths()

    expect(served).toContain('administracija/entiteti')
    expect(served).toContain('administracija/verifikacija')
    expect(served).toContain('administracija/cenovnik')
    expect(NAV.map((section) => section.path)).not.toContain('administracija/entiteti')
  })
})

describe('ACCOUNT_ROUTES', () => {
  it('holds settings, which no longer hang off a cog of their own (PDL P28a)', () => {
    expect(ACCOUNT_ROUTES.map((route) => route.path)).toContain('podesavanja')
  })
})

describe('ROUTES', () => {
  it('gives every route a unique path and a key that is not empty', () => {
    const paths = ROUTES.map((route) => route.path)

    expect(new Set(paths).size).toBe(paths.length)
    expect(ROUTES.every((route) => route.labelKey.includes('.'))).toBe(true)
    // That each of those keys resolves is guarded in src/i18n/keys.test.ts.
  })

  it('carries an address for every navigation entry, account screen and footer link', () => {
    const paths = ROUTES.map((route) => route.path)

    for (const path of [
      ...NAV.map((section) => section.path),
      ...ACCOUNT_ROUTES.map((route) => route.path),
      ...FOOTER_ROUTES.map((route) => route.path),
    ]) {
      expect(paths).toContain(path)
    }
  })

  it('has no screen for contact, because contact is an address', () => {
    expect(ROUTES.map((route) => route.path)).not.toContain('kontakt')
    expect(FOOTER_ROUTES.map((route) => route.path)).toEqual([
      'statut',
      'politika-privatnosti',
      'uslovi-koriscenja',
    ])
    expect(CONTACT_ADDRESS).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)
  })

  it('no longer serves the old address of the review queue', () => {
    // The queue moved under verification, where the rest of the waiting work is.
    expect(ROUTES.map((route) => route.path)).not.toContain('administracija/red-za-proveru')
    expect(ROUTES.map((route) => route.path)).toContain('administracija/verifikacija')
  })
})

describe('seoKeyFor', () => {
  it('answers for every address the router serves, not only for the listed ones', () => {
    /* Read out of the real router table, so that a route added there without
       words to go with it fails here rather than quietly showing up in a browser
       tab as "Ove strane nema", which is how the detail screens got that name in
       the first place. */
    const served = servedPaths().filter((path) => path !== '*')

    expect(served.length).toBeGreaterThan(30)
    expect(served.filter((path) => seoKeyFor(path) === undefined)).toEqual([])
  })

  it('answers for the home page, which has no path at all', () => {
    expect(seoKeyFor('')).toBe('home')
  })

  it('fills the value in an address that carries one', () => {
    expect(seoKeyFor('takmicar/000001')).toBe('competitor')
    expect(seoKeyFor('kalendar/beogradski-maraton-2027-04-17')).toBe('event')
    expect(seoKeyFor('poruke/msg-1')).toBe('message')
    expect(seoKeyFor('administracija/verifikacija/rezultati')).toBe('verificationQueue')
  })

  it('never lets an address with a value answer for the screen above it', () => {
    expect(seoKeyFor('kalendar')).toBe('calendar')
    expect(seoKeyFor('poruke')).toBe('messages')
  })

  it('answers with nothing for an address the portal does not have', () => {
    expect(seoKeyFor('ovoga-nema')).toBeUndefined()
    expect(seoKeyFor('takmicar/000001/rezultati')).toBeUndefined()
  })

  it('gives every address its own seo entry, so that no two pages share a name', () => {
    const keys = [...ROUTES, ...EXTRA_ADDRESSES].map((address) => address.seoKey)

    expect(new Set(keys).size).toBe(keys.length)
  })
})
