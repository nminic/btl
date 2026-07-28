import { createBrowserRouter, RouterProvider } from 'react-router'
import { RoleProvider } from '../roles/RoleProvider'
import { routeObjects } from './routeObjects'

const router = createBrowserRouter(routeObjects)

export default function App() {
  return (
    <RoleProvider>
      <RouterProvider router={router} />
    </RoleProvider>
  )
}
