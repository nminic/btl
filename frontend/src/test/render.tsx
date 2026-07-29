import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routeObjects } from '../app/routeObjects'
import { DEFAULT_LOCALE, type Locale } from '../i18n/config'
import { I18nProvider } from '../i18n/I18nProvider'
import { RoleProvider } from '../roles/RoleProvider'
import type { Role } from '../roles/context'
import { SessionProvider } from '../session/SessionProvider'

/** Mounts the real route table at a real address, in a memory router. */
export function renderAt(path: string, role: Role = 'visitor', memberNumber: string | null = null) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })

  return render(
    <RoleProvider initialRole={role}>
      <SessionProvider initialMemberNumber={memberNumber}>
        <RouterProvider router={router} />
      </SessionProvider>
    </RoleProvider>,
  )
}

/** For components that need translations but no routing. */
export function renderWithI18n(ui: ReactNode, locale: Locale = DEFAULT_LOCALE) {
  return render(<I18nProvider locale={locale}>{ui}</I18nProvider>)
}
