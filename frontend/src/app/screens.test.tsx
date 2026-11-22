import { act, render, screen } from '@testing-library/react'
import { isValidElement, type ReactElement } from 'react'
import { createMemoryRouter, Link, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { Guard } from '../pages/admin/Guard'
import { ClockProvider } from '../clock/ClockProvider'
import { Placeholder } from '../pages/Placeholder'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionProvider } from '../session/SessionProvider'
import { routeObjects } from './routeObjects'
import * as handed from './screens'

/* THE SCREENS, LOADED THE FIRST TIME THEY ARE OPENED (`app/screens.tsx`), measured through the REAL
   `lazyRoute`: every other test file is handed the table with every screen already loaded
   (`test/setup.ts`), so this is the one place the loading itself is read.

   THE AXES:
   - the screen before against the screen next: while the next one is on its way the one before stays,
     whole, and the next one is drawn only when it has arrived; a stand-in drawn in between would be the
     moment the focus and the scroll land on nothing;
   - the door: an address of the administration is handed over behind its `Guard`, and one outside it is
     the bare screen;
   - the table the tests are handed against the real one: the same addresses and, at each, the same
     screen, so the cases of the portal measure the screens it really serves. */

const real = await vi.importActual<typeof import('./screens')>('./screens')

function typeOf(element: unknown): unknown {
  return isValidElement(element) ? element.type : undefined
}

describe('the screens of the portal', () => {
  it('gives every address of the table a screen of its own and not a stand-in', async () => {
    const loads = [...Object.values(real.SCREENS), ...real.DETAILS.map((one) => one.load)]
    const drawn = await Promise.all(loads.map((load) => load()))

    expect(drawn.length).toBe(Object.keys(real.SCREENS).length + real.DETAILS.length)
    expect(drawn.filter((one) => typeof one.type !== 'function')).toEqual([])
    expect(drawn.filter((one) => one.type === Placeholder)).toEqual([])
  })

  it('hands the router a screen only once it is loaded, behind the door its address asks for', async () => {
    const admin = real.lazyRoute('administracija', real.SCREENS.administracija ?? (async () => <p />))
    const calendar = real.lazyRoute('kalendar', real.SCREENS.kalendar ?? (async () => <p />))

    expect(admin.element, 'a screen was handed over before it was loaded').toBeUndefined()
    expect(typeof admin.lazy).toBe('function')

    const behindTheDoor = typeof admin.lazy === 'function' ? await admin.lazy() : undefined
    const open = typeof calendar.lazy === 'function' ? await calendar.lazy() : undefined

    expect(typeOf(Reflect.get(Object(behindTheDoor), 'element'))).toBe(Guard)
    expect(typeOf(Reflect.get(Object(open), 'element'))).toBe(typeOf(await (real.SCREENS.kalendar ?? (async () => <p />))()))
  })

  it('keeps the screen before on the page until the next one has arrived, and then draws it whole', async () => {
    let arrive: (screen: ReactElement) => void = () => undefined
    const next = new Promise<ReactElement>((resolve) => {
      arrive = resolve
    })
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <>
              <h1>Prva strana</h1>
              <Link to="/druga">Dalje</Link>
            </>
          ),
        },
        real.lazyRoute('druga', () => next),
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    act(() => {
      screen.getByRole('link', { name: 'Dalje' }).click()
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Prva strana' })).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1, name: 'Druga strana' })).toBeNull()
    expect(router.state.location.pathname, 'the address moved before its screen had arrived').toBe('/')

    await act(async () => {
      arrive(<h1>Druga strana</h1>)
      await next
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Druga strana' })).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1, name: 'Prva strana' })).toBeNull()
  })

  it('draws nothing while the first screen of a visit is on its way, and says that is meant', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const theLocale = routeObjects.find((route) => route.path === '/:locale')
    let arrive: (screen: ReactElement) => void = () => undefined
    const first = new Promise<ReactElement>((resolve) => {
      arrive = resolve
    })
    const router = createMemoryRouter(
      [{ path: '/', HydrateFallback: theLocale?.HydrateFallback, children: [real.lazyRoute('prva', () => first)] }],
      { initialEntries: ['/prva'] },
    )

    try {
      const { container } = render(<RouterProvider router={router} />)

      expect(theLocale?.HydrateFallback, 'the portal names no first moment').toBeDefined()
      expect(container).toBeEmptyDOMElement()

      await act(async () => {
        arrive(<h1>Prva strana</h1>)
        await first
      })

      expect(await screen.findByRole('heading', { level: 1, name: 'Prva strana' })).toBeVisible()
      expect(warned.mock.calls.flat().filter((one) => String(one).includes('HydrateFallback'))).toEqual([])
    } finally {
      warned.mockRestore()
    }
  })

  it('hands the other tests the real table, with every screen it serves', async () => {
    expect(Object.keys(handed.SCREENS)).toEqual(Object.keys(real.SCREENS))
    expect(handed.DETAILS.map((one) => one.path)).toEqual(real.DETAILS.map((one) => one.path))

    for (const [path, load] of [
      ...Object.entries(real.SCREENS),
      ...real.DETAILS.map((one) => [one.path, one.load] as const),
    ]) {
      const route = handed.lazyRoute(path, load)
      const element = Reflect.get(Object(route), 'element')
      const screen = await load()

      expect(route.path).toBe(path)
      expect(typeOf(element), `${path} was handed no screen at once`).not.toBeUndefined()
      expect(element, `${path} was handed another screen than the one the portal serves there`).toEqual(
        real.guarded(path, screen),
      )
    }
  })

  /* A PIECE THAT DOES NOT ARRIVE: the router's error, not the tree's, so the boundary in `Shell` never sees
     it. The portal's header and navigation stay and the portal's own message stands in the place of the
     screen; the router's English page with a stack is what stood there before. */
  async function openAScreenWhoseModuleIs(module: () => Promise<unknown>) {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const theLocale = routeObjects.find((route) => route.path === '/:locale')
    const failing = real.lazyRoute('kalendar', real.of(async () => module(), () => <h1>Kalendar</h1>))
    /* The real routes of the portal, the screens' own group (the one with no address) given the one screen
       that fails; the front page and the answer for an address the portal does not have stay as they are. */
    const children = (theLocale?.children ?? []).map((one) =>
      one.path === undefined && one.index !== true ? { ErrorBoundary: one.ErrorBoundary, children: [failing] } : one,
    )
    const router = createMemoryRouter([{ path: theLocale?.path, element: theLocale?.element, HydrateFallback: theLocale?.HydrateFallback, children }], { initialEntries: ['/sr'] })

    render(
      <ClockProvider simulatedDay={null}>
        <RoleProvider initialRole="visitor" initialModerator={null}>
          <SessionProvider initialMemberNumber={null}>
            <RouterProvider router={router} />
          </SessionProvider>
        </RoleProvider>
      </ClockProvider>,
    )

    await screen.findAllByRole('navigation')
    const navigationBefore = screen.getAllByRole('navigation').length
    const headingsBefore = screen.getAllByRole('heading', { level: 1 }).map((one) => one.textContent)

    /* Not awaited: a navigation that waits for a page that is being replaced does not end, which is the point. */
    await act(async () => {
      void router.navigate('/sr/kalendar')
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    return { errors, warns, navigationBefore, headingsBefore }
  }

  it('keeps the portal around a piece that does not arrive, and says so in its own words', async () => {
    const { errors, warns, navigationBefore } = await openAScreenWhoseModuleIs(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module')),
    )

    try {
      expect(screen.getAllByRole('navigation').length, 'the navigation went with the screen').toBe(navigationBefore)
      expect(screen.getByRole('alert')).toHaveTextContent('Nešto je puklo')
      expect(screen.getByRole('heading', { level: 1, name: 'Nešto je puklo' })).toBeVisible()
      expect(document.body.textContent).not.toContain('Unexpected Application Error')
    } finally {
      errors.mockRestore()
      warns.mockRestore()
    }
  })

  it('waits, without an error and without the router’s page, when the piece was stopped for a reload', async () => {
    const { errors, warns, navigationBefore, headingsBefore } = await openAScreenWhoseModuleIs(() => Promise.resolve(undefined))

    try {
      expect(errors.mock.calls, 'something was thrown while the page waits for its reload').toEqual([])
      expect(screen.getAllByRole('navigation').length).toBe(navigationBefore)
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.queryByRole('heading', { level: 1, name: 'Kalendar' })).toBeNull()
      /* THE SCREEN THE READER WAS ON STAYS: waiting for the reload is not an empty page. */
      expect(headingsBefore.length, 'the screen the reader was on has a title').toBeGreaterThan(0)
      expect(screen.getAllByRole('heading', { level: 1 }).map((one) => one.textContent)).toEqual(headingsBefore)
      expect(document.body.textContent).not.toContain('Unexpected Application Error')
    } finally {
      errors.mockRestore()
      warns.mockRestore()
    }
  })
})
