import { createBrowserRouter, RouterProvider } from 'react-router'
import { RoleProvider } from '../roles/RoleProvider'
import { SessionProvider } from '../session/SessionProvider'
import { routeObjects } from './routeObjects'

const router = createBrowserRouter(routeObjects)

export default function App() {
  return (
    <RoleProvider>
      <SessionProvider>
        <RouterProvider router={router} />
      </SessionProvider>
    </RoleProvider>
  )
}
