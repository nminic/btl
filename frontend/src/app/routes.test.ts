import {
  accountRoutesForRole,
  ACCOUNT_ROUTES,
  CONTACT_ADDRESS,
  FOOTER_ROUTES,
  NAV,
  navForRole,
  ROUTES,
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

describe('accountRoutesForRole', () => {
  it('gives a visitor nothing, because there is no account to open', () => {
    expect(accountRoutesForRole('visitor')).toEqual([])
  })

  it('gives a member the whole of their own area', () => {
    expect(accountRoutesForRole('competitor')).toEqual(ACCOUNT_ROUTES)
    expect(accountRoutesForRole('superadmin')).toEqual(ACCOUNT_ROUTES)
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
