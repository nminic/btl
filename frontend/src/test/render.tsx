import { render } from '@testing-library/react'
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

/** Mounts the real route table at a real address, in a memory router. */
export function renderAt(
  path: string,
  role: Role = 'visitor',
  memberNumber: string | null = null,
  moderator: Moderator = ANY_MODERATOR,
  /** The day the portal is read as, for the screens that change with it. Left
   *  alone, a test runs on the real one, exactly as the portal does. */
  today: string | null = null,
) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })

  return render(
    <ClockProvider simulatedDay={today}>
      <RoleProvider initialRole={role} initialModerator={role === 'moderator' ? moderator : null}>
        <SessionProvider initialMemberNumber={memberNumber}>
          <RouterProvider router={router} />
        </SessionProvider>
      </RoleProvider>
    </ClockProvider>,
  )
}

/** For components that need translations but no routing. */
export function renderWithI18n(ui: ReactNode, locale: Locale = DEFAULT_LOCALE) {
  return render(
    <ClockProvider>
      <I18nProvider locale={locale}>{ui}</I18nProvider>
    </ClockProvider>,
  )
}
