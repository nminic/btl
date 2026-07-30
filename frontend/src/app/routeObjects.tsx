import type { ReactElement } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { DEFAULT_LOCALE } from '../i18n/config'
import { Badges } from '../pages/Badges'
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
import { Rulebook } from '../pages/Rulebook'
import { TopBoards } from '../pages/TopBoards'
import { Teams } from '../pages/Teams'
import { NotFound } from '../pages/NotFound'
import { Placeholder } from '../pages/Placeholder'
import { Registration } from '../pages/Registration'
import { StaticPage } from '../pages/StaticPage'
import { Admin } from '../pages/admin/Admin'
import { Entities } from '../pages/admin/Entities'
import { Verification } from '../pages/admin/Verification'
import { AdminBadges } from '../pages/admin/AdminBadges'
import { AdminEvents } from '../pages/admin/AdminEvents'
import { AdminMembers } from '../pages/admin/AdminMembers'
import { AdminLeagues } from '../pages/admin/AdminLeagues'
import { AdminPages } from '../pages/admin/AdminPages'
import { AdminPricing } from '../pages/admin/AdminPricing'
import { AdminRaces } from '../pages/admin/AdminRaces'
import { AdminTeams } from '../pages/admin/AdminTeams'
import { Payments } from '../pages/admin/Payments'
import { PendingQueue } from '../pages/admin/PendingQueue'
import { QUEUE } from '../pages/admin/queues'
import { ReviewQueue } from '../pages/admin/ReviewQueue'
import { Membership } from '../pages/member/Membership'
import { MessageDetail } from '../pages/member/MessageDetail'
import { Messages } from '../pages/member/Messages'
import { Settings } from '../pages/member/Settings'
import { MyProfile } from '../pages/member/MyProfile'
import { MyResults } from '../pages/member/MyResults'
import { NewResult } from '../pages/member/NewResult'
import { SignIn } from '../pages/member/SignIn'
import { LocaleLayout } from './LocaleLayout'
import { ROUTES, type RouteDef } from './routes'

/* Screens that already exist, which is every address in ROUTES since the badges
 * arrived. Anything else in ROUTES renders a placeholder, so the navigation can
 * be walked end to end from the day an address is added. */
const SCREENS: Record<string, ReactElement> = {
  kalendar: <Calendar />,
  tabela: <Rankings />,
  'top-liste': <TopBoards />,
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
  podesavanja: <Settings />,
  administracija: <Admin />,
  'administracija/entiteti': <Entities />,
  'administracija/verifikacija': <Verification />,
  'administracija/clanovi': <AdminMembers />,
  'administracija/dogadjaji': <AdminEvents />,
  'administracija/znacke': <AdminBadges />,
  'administracija/cenovnik': <AdminPricing />,
  'administracija/trke': <AdminRaces />,
  'administracija/timovi': <AdminTeams />,
  'administracija/lige': <AdminLeagues />,
  'administracija/strane': <AdminPages />,
  znacke: <Badges />,
  'o-ligi': <StaticPage slug="o-ligi" />,
  pravilnik: <Rulebook />,
  istorijat: <StaticPage slug="istorijat" />,
  'politika-privatnosti': <StaticPage slug="politika-privatnosti" />,
  'uslovi-koriscenja': <StaticPage slug="uslovi-koriscenja" />,
}

/**
 * The screen at an address, or a stand-in for one.
 *
 * Every address in ROUTES has a screen of its own today. The stand-in is what a
 * newly added address answers with on the day it is added and before its screen
 * exists, so the navigation can always be walked end to end.
 */
export function screenFor(route: RouteDef): ReactElement {
  return SCREENS[route.path] ?? <Placeholder labelKey={route.labelKey} />
}

/* Detail screens. They are addresses, not navigation entries, so they are not
 * in ROUTES. */
const DETAILS: RouteObject[] = [
  { path: 'kalendar/:slug', element: <EventDetail /> },
  { path: 'takmicar/:memberNumber', element: <CompetitorProfile /> },
  { path: 'tim/:slug', element: <TeamDetail /> },
  { path: 'liga/:slug', element: <LeagueDetail /> },
  { path: 'rezultat/novi', element: <NewResult /> },
  { path: 'poruke/:id', element: <MessageDetail /> },
  /* The eight verification queues (PDL P28a). The addresses live in QUEUES,
     which is also what the list of queues links with, so a queue cannot end up
     with a row that points nowhere. */
  { path: QUEUE.results.path, element: <ReviewQueue /> },
  { path: QUEUE.payments.path, element: <Payments /> },
  { path: QUEUE.leagues.path, element: <PendingQueue queue={QUEUE.leagues} /> },
  { path: QUEUE.teams.path, element: <PendingQueue queue={QUEUE.teams} /> },
  { path: QUEUE.bios.path, element: <PendingQueue queue={QUEUE.bios} /> },
  { path: QUEUE.photos.path, element: <PendingQueue queue={QUEUE.photos} /> },
  { path: QUEUE.comments.path, element: <PendingQueue queue={QUEUE.comments} /> },
  { path: QUEUE.schedule.path, element: <PendingQueue queue={QUEUE.schedule} /> },
]

/* Kept apart from App so tests can mount the same routes in a memory router. */
export const routeObjects: RouteObject[] = [
  { path: '/', element: <Navigate to={`/${DEFAULT_LOCALE}`} replace /> },
  {
    path: '/:locale',
    element: <LocaleLayout />,
    children: [
      { index: true, element: <Home /> },
      ...ROUTES.map((route) => ({ path: route.path, element: screenFor(route) })),
      ...DETAILS,
      { path: '*', element: <NotFound /> },
    ],
  },
]
