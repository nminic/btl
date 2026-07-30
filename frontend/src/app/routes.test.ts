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
    const served = (routeObjects[1].children ?? [])
      .map((child) => child.path)
      .filter((path): path is string => path !== undefined && path !== '*')

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
