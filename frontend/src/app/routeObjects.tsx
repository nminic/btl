import { Navigate, type RouteObject } from 'react-router'
import { DEFAULT_LOCALE } from '../i18n/config'
import { Home } from '../pages/Home'
import { NotFound } from '../pages/NotFound'
import { Placeholder } from '../pages/Placeholder'
import { LocaleLayout } from './LocaleLayout'
import { ROUTES } from './routes'

/* Kept apart from App so tests can mount the same routes in a memory router. */
export const routeObjects: RouteObject[] = [
  { path: '/', element: <Navigate to={`/${DEFAULT_LOCALE}`} replace /> },
  {
    path: '/:locale',
    element: <LocaleLayout />,
    children: [
      { index: true, element: <Home /> },
      ...ROUTES.map((route) => ({
        path: route.path,
        element: <Placeholder labelKey={route.labelKey} />,
      })),
      { path: '*', element: <NotFound /> },
    ],
  },
]
