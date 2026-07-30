import { createBrowserRouter, RouterProvider } from 'react-router'
import { ClockProvider } from '../clock/ClockProvider'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionProvider } from '../session/SessionProvider'
import { routeObjects } from './routeObjects'

const router = createBrowserRouter(routeObjects)

/* The clock is outermost because everything below it can ask what day it is,
 * including the role and the session, and nothing above it exists. */
export default function App() {
  return (
    <ClockProvider>
      <RoleProvider>
        <SessionProvider>
          <RouterProvider router={router} />
        </SessionProvider>
      </RoleProvider>
    </ClockProvider>
  )
}
