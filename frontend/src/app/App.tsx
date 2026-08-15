import { createBrowserRouter, RouterProvider } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { Analytics } from '../consent/Analytics'
import { ConsentProvider } from '../consent/ConsentProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionProvider } from '../session/SessionProvider'
import { routeObjects } from './routeObjects'

const router = createBrowserRouter(routeObjects)

/* The clock is outermost because everything below it can ask what day it is,
 * including the role and the session, and nothing above it exists.
 *
 * Consent wraps the router rather than sitting inside it, because the answer is
 * about the visit and not about the screen: the bar is drawn at the foot of
 * whatever page is open, the footer's control is on every one of them, and what
 * is loaded on the strength of the answer is loaded once for the whole visit. */
export default function App() {
  return (
    <ClockProvider>
      <RoleProvider>
        <SessionProvider>
          <ConsentProvider>
            {/* Draws nothing. It is here, above the router, so that agreeing
                loads the scripts once rather than on every change of screen. */}
            <Analytics />
            <RouterProvider router={router} />
          </ConsentProvider>
        </SessionProvider>
      </RoleProvider>
    </ClockProvider>
  )
}
