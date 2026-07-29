import type { ReactElement } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { DEFAULT_LOCALE } from '../i18n/config'
import { Calendar } from '../pages/Calendar'
import { Competitors } from '../pages/Competitors'
import { CompetitorProfile } from '../pages/CompetitorProfile'
import { EventDetail } from '../pages/EventDetail'
import { LeagueDetail } from '../pages/LeagueDetail'
import { TeamDetail } from '../pages/TeamDetail'
import { Home } from '../pages/Home'
import { Leagues } from '../pages/Leagues'
import { Pricing } from '../pages/Pricing'
import { Rankings } from '../pages/Rankings'
import { Teams } from '../pages/Teams'
import { NotFound } from '../pages/NotFound'
import { Placeholder } from '../pages/Placeholder'
import { Registration } from '../pages/Registration'
import { LocaleLayout } from './LocaleLayout'
import { ROUTES } from './routes'

/* Screens that already exist. Everything else in ROUTES renders a placeholder,
 * so the navigation can be walked end to end from the first day. */
const SCREENS: Record<string, ReactElement> = {
  kalendar: <Calendar />,
  'rang-liste': <Rankings />,
  takmicari: <Competitors />,
  timovi: <Teams />,
  lige: <Leagues />,
  clanarina: <Pricing />,
  registracija: <Registration />,
}

/* Detail screens. They are addresses, not navigation entries, so they are not
 * in ROUTES. */
const DETAILS: RouteObject[] = [
  { path: 'kalendar/:slug', element: <EventDetail /> },
  { path: 'takmicar/:memberNumber', element: <CompetitorProfile /> },
  { path: 'tim/:slug', element: <TeamDetail /> },
  { path: 'liga/:slug', element: <LeagueDetail /> },
]

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
        element: SCREENS[route.path] ?? <Placeholder labelKey={route.labelKey} />,
      })),
      ...DETAILS,
      { path: '*', element: <NotFound /> },
    ],
  },
]
