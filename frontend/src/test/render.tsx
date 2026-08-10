import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routeObjects } from '../app/routeObjects'
import { ClockProvider } from '../clock/ClockProvider'
import type { Moderator } from '../data/types'
import { DEFAULT_LOCALE, type Locale } from '../i18n/config'
import { I18nProvider } from '../i18n/I18nProvider'
import { RIGHTS } from '../pages/admin/rights'
import { RoleProvider } from '../roles/RoleProvider'
import type { Role } from '../roles/context'
import { SessionProvider } from '../session/SessionProvider'

/**
 * A moderator holding exactly the rights given, for the tests that care which.
 *
 * Not one of the four in the data file: those are what the matrix is drawn from
 * and a test that changed one of them would change what the matrix screen shows.
 */
export function moderatorWith(rights: string[]): Moderator {
  return {
    id: 'mod-proba',
    firstName: 'Probni',
    lastName: 'Moderator',
    email: 'probni@primer.rs',
    rights,
  }
}

/**
 * Who a test gets when it asks for the role of a moderator and names nobody.
 *
 * Somebody holding every right there is, which is what "moderator" meant on
 * every screen before the matrix was enforced. Tests about a screen doing its
 * work therefore go on asking for the role and get an unrestricted one; a test
 * about what a limited moderator runs into names the rights it means.
 */
const ANY_MODERATOR = moderatorWith(RIGHTS.map((right) => right.key))

/**
 * Mounts the real route table at a real address, in a memory router.
 *
 * The router comes back with the render result, and any test that says something
 * about the address has to read it there. `window.location` is the wrong place
 * to look: a memory router never writes to it, so `expect(window.location.search)
 * .toBe('')` passes whatever the screen does, and one such assertion had been
 * sitting in the profile tests proving nothing.
 */
export function renderAt(
  path: string,
  role: Role = 'visitor',
  memberNumber: string | null = null,
  moderator: Moderator = ANY_MODERATOR,
  /** The day the portal is read as, for the screens that change with it. Left
   *  alone, a test runs on the real one, exactly as the portal does. */
  today: string | null = null,
  /**
   * Something drawn beside the portal, inside the same session.
   *
   * For what the session holds and no screen shows. The queues used to draw a
   * table of what had been decided, and tests read the decision off it; the
   * table is gone (owner, 06.08.2026), because what is settled is not work
   * standing before a moderator. What was decided is still the thing to hold, so
   * it is read where it lives rather than where it used to be drawn.
   */
  probe: ReactNode = null,
) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })

  return {
    ...render(
      <ClockProvider simulatedDay={today}>
        <RoleProvider initialRole={role} initialModerator={role === 'moderator' ? moderator : null}>
          <SessionProvider initialMemberNumber={memberNumber}>
            <RouterProvider router={router} />
            {probe}
          </SessionProvider>
        </RoleProvider>
      </ClockProvider>,
    ),
    router,
  }
}

/**
 * Waits until the front page is what is on screen.
 *
 * Where a closed door and an address the portal does not have both end up
 * (owner, 30.07.2026). Its own heading is the thing to look for: it is the only
 * level one heading on the portal that carries the name of the league, and it is
 * there precisely so the page has a name at all.
 */
export async function expectFrontPage(): Promise<void> {
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Balkanska trkačka liga' }),
  ).toBeInTheDocument()
}

/** For components that need translations but no routing. */
export function renderWithI18n(ui: ReactNode, locale: Locale = DEFAULT_LOCALE) {
  return render(
    <ClockProvider>
      <I18nProvider locale={locale}>{ui}</I18nProvider>
    </ClockProvider>,
  )
}
