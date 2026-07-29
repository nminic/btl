import { ROUTES, routesForRole } from './routes'

describe('routesForRole', () => {
  it('shows the public navigation to everyone', () => {
    expect(routesForRole('main', 'visitor').length).toBeGreaterThan(0)
  })

  it('hides member screens from a visitor', () => {
    expect(routesForRole('member', 'visitor')).toEqual([])
    expect(routesForRole('member', 'competitor').length).toBeGreaterThan(0)
  })

  it('hides administration from members', () => {
    expect(routesForRole('staff', 'competitor')).toEqual([])
    expect(routesForRole('staff', 'moderator').length).toBeGreaterThan(0)
  })

  it('shows the footer to everyone', () => {
    expect(routesForRole('footer', 'visitor').length).toBeGreaterThan(0)
  })

  it('gives every route a unique path and a key that is not empty', () => {
    const paths = ROUTES.map((route) => route.path)

    expect(new Set(paths).size).toBe(paths.length)
    expect(ROUTES.every((route) => route.labelKey.includes('.'))).toBe(true)
    // That each of those keys resolves is guarded in src/i18n/keys.test.ts.
  })
})
