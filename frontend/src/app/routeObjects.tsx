import { Navigate, type RouteObject } from 'react-router'
import { DEFAULT_LOCALE } from '../i18n/config'
import { Home } from '../pages/Home'
import { NotFound } from '../pages/NotFound'
import { LocaleLayout } from './LocaleLayout'
import { PortalError } from './PortalError'
import { ROUTES } from './routes'
import { DETAILS, lazyRoute, screenFor } from './screens'

/* EVERY SCREEN BUT TWO IS LOADED THE FIRST TIME IT IS OPENED (`app/screens.tsx`, inkrement „Poboljšanje
 * performansi”, korak 2). The two that come with the portal itself are the front page, where most visits
 * start, and the answer to an address the portal does not have. */
const SCREENS_OF_ROUTES: RouteObject[] = ROUTES.map((route) => lazyRoute(route.path, screenFor(route)))

const DETAIL_SCREENS: RouteObject[] = DETAILS.map((one) => lazyRoute(one.path, one.load))

/** The first moment of a visit, before its first screen has been loaded. */
function NothingYet() {
  return null
}

/* Kept apart from App so tests can mount the same routes in a memory router. */
export const routeObjects: RouteObject[] = [
  { path: '/', element: <Navigate to={`/${DEFAULT_LOCALE}`} replace /> },
  {
    path: '/:locale',
    element: <LocaleLayout />,
    /* WHILE THE FIRST SCREEN OF A VISIT IS ON ITS WAY, NOTHING, which is what the page was before the
       portal's code arrived at all: `index.html` draws nothing in `#root`. Named rather than left out, so
       the router is told the empty moment is meant. */
    HydrateFallback: NothingYet,
    children: [
      { index: true, element: <Home /> },
      /* A PIECE THAT DOES NOT ARRIVE (a weak connection, a deploy under a tab that has already been read
         again once) is an error of the router and not of the tree under it, so the boundary around the
         outlet in `Shell` never sees it, and the router's own English page, with the stack, would replace
         the whole portal. The boundary stands on a route of its own, with no address and with no `lazy`:
         the router draws nothing below a route that is still waiting for its piece, so a boundary on the
         screen's own route would be drawn as nothing. Here the portal's own message takes the place of the
         screen, inside the outlet, and the header and the navigation stay. */
      { ErrorBoundary: PortalError, children: [...SCREENS_OF_ROUTES, ...DETAIL_SCREENS] },
      { path: '*', element: <NotFound /> },
    ],
  },
]
