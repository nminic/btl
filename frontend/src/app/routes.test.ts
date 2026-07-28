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

  it('gives every route a translation key and a unique path', () => {
    const paths = ROUTES.map((route) => route.path)

    expect(new Set(paths).size).toBe(paths.length)
    expect(ROUTES.every((route) => route.labelKey.startsWith('nav.'))).toBe(true)
  })
})
