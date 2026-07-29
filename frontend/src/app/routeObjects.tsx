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
import { StaticPage } from '../pages/StaticPage'
import { Admin } from '../pages/admin/Admin'
import { AdminBadges } from '../pages/admin/AdminBadges'
import { AdminEvents } from '../pages/admin/AdminEvents'
import { AdminMembers } from '../pages/admin/AdminMembers'
import { AdminPricing } from '../pages/admin/AdminPricing'
import { ReviewQueue } from '../pages/admin/ReviewQueue'
import { Membership } from '../pages/member/Membership'
import { Messages } from '../pages/member/Messages'
import { MyProfile } from '../pages/member/MyProfile'
import { MyResults } from '../pages/member/MyResults'
import { NewResult } from '../pages/member/NewResult'
import { SignIn } from '../pages/member/SignIn'
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
  prijava: <SignIn />,
  'moj-profil': <MyProfile />,
  'moji-rezultati': <MyResults />,
  'moja-clanarina': <Membership />,
  poruke: <Messages />,
  administracija: <Admin />,
  'administracija/red-za-proveru': <ReviewQueue />,
  'administracija/clanovi': <AdminMembers />,
  'administracija/dogadjaji': <AdminEvents />,
  'administracija/znacke': <AdminBadges />,
  'administracija/cenovnik': <AdminPricing />,
  'o-ligi': <StaticPage slug="o-ligi" />,
  pravilnik: <StaticPage slug="pravilnik" />,
  kontakt: <StaticPage slug="kontakt" />,
  'politika-privatnosti': <StaticPage slug="politika-privatnosti" />,
  'uslovi-koriscenja': <StaticPage slug="uslovi-koriscenja" />,
}

/* Detail screens. They are addresses, not navigation entries, so they are not
 * in ROUTES. */
const DETAILS: RouteObject[] = [
  { path: 'kalendar/:slug', element: <EventDetail /> },
  { path: 'takmicar/:memberNumber', element: <CompetitorProfile /> },
  { path: 'tim/:slug', element: <TeamDetail /> },
  { path: 'liga/:slug', element: <LeagueDetail /> },
  { path: 'rezultat/novi', element: <NewResult /> },
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
