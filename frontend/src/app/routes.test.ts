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
  it('shows the sections in the order the design fixes', () => {
    expect(navForRole('superadmin').map((section) => section.id)).toEqual([
      'about',
      'people',
      'teams',
      'stats',
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

describe('the group "O ligi"', () => {
  it('holds the five screens the owner named, in that order (PDL P28a)', () => {
    const about = NAV.find((section) => section.id === 'about')

    expect((about?.items ?? []).map((item) => item.path)).toEqual([
      'o-ligi',
      'pravilnik',
      'clanarina',
      'znacke',
      'istorijat',
    ])
  })

  it('serves no address twice, now that two of them moved into it', () => {
    /* The story of the league and the badges had an address and no link anywhere
       pointing at it. They joined the group on 30.07.2026 and left the unlisted
       list on the same day: an entry in both would be one address with two router
       entries, and the second would never be reached. Read out of the real router
       table rather than out of ROUTES, because that is what is served. */
    const served = servedPaths()

    expect(new Set(served).size).toBe(served.length)
    expect(served).toContain('o-ligi')
    expect(served).toContain('znacke')
  })
})

describe('the shape of the navigation', () => {
  it('gives every section either one screen or a group, never both and never neither', () => {
    for (const section of NAV) {
      const single = section.path !== undefined
      const group = (section.items ?? []).length > 0

      expect(single).not.toBe(group)
    }
  })

  it('opens a group only where there is more than one screen behind it', () => {
    // A menu that opens onto a single choice is a link with an extra click, so
    // an entry with one screen behind it stays a plain link.
    expect(NAV.filter((section) => section.path !== undefined).map((section) => section.path)).toEqual([
      'takmicari',
      'timovi',
      'kalendar',
    ])
    expect(
      NAV.filter((section) => section.path === undefined).every(
        (section) => (section.items ?? []).length > 1,
      ),
    ).toBe(true)
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
    const inNavigation = NAV.flatMap((section) =>
      section.path === undefined ? (section.items ?? []).map((item) => item.path) : [section.path],
    )

    for (const path of [
      ...inNavigation,
      ...ACCOUNT_ROUTES.map((route) => route.path),
      ...FOOTER_ROUTES.map((route) => route.path),
    ]) {
      expect(paths).toContain(path)
    }
  })

  it('has no screen for contact, because contact is an address', () => {
    expect(ROUTES.map((route) => route.path)).not.toContain('kontakt')
    expect(FOOTER_ROUTES.map((route) => route.path)).toEqual([
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
