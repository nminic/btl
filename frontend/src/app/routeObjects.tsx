import type { ReactElement } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { DEFAULT_LOCALE } from '../i18n/config'
import { Calendar } from '../pages/Calendar'
import { Competitors } from '../pages/Competitors'
import { CompetitorAwards } from '../pages/CompetitorAwards'
import { CompetitorProfile } from '../pages/CompetitorProfile'
import { CalendarDay } from '../pages/CalendarDay'
import { EventDetail } from '../pages/EventDetail'
import { RateEvent } from '../pages/event/RateEvent'
import { ReportResult } from '../pages/event/ReportResult'
import { LeagueDetail } from '../pages/LeagueDetail'
import { TeamDetail } from '../pages/TeamDetail'
import { Home } from '../pages/Home'
import { Leagues } from '../pages/Leagues'
import { Rankings } from '../pages/Rankings'
import { Rulebook } from '../pages/Rulebook'
import { TopBoards } from '../pages/TopBoards'
import { ProposeTeam } from '../pages/member/ProposeTeam'
import { Teams } from '../pages/Teams'
import { NotFound } from '../pages/NotFound'
import { Placeholder } from '../pages/Placeholder'
import { Registration } from '../pages/Registration'
import { StaticPage } from '../pages/StaticPage'
import { Admin } from '../pages/admin/Admin'
import { Entities } from '../pages/admin/Entities'
import { Guard } from '../pages/admin/Guard'
import { needFor } from '../pages/admin/needs'
import { AdminSections } from '../pages/admin/SectionNav'
import { Verification } from '../pages/admin/Verification'
import { AdminEvents } from '../pages/admin/AdminEvents'
import { AdminMembers } from '../pages/admin/AdminMembers'
import { AdminLeagues } from '../pages/admin/AdminLeagues'
import { AdminModerators } from '../pages/admin/AdminModerators'
import { AdminPages } from '../pages/admin/AdminPages'
import { AdminPricing } from '../pages/admin/AdminPricing'
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

/* Screens that already exist, which is every address in ROUTES since the ducats
 * arrived. Anything else in ROUTES renders a placeholder, so the navigation can
 * be walked end to end from the day an address is added. */
const SCREENS: Record<string, ReactElement> = {
  kalendar: <Calendar />,
  tabela: <Rankings />,
  'top-liste': <TopBoards />,
  takmicari: <Competitors />,
  timovi: <Teams />,
  'novi-tim': <ProposeTeam />,
  lige: <Leagues />,
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
  'administracija/cenovnik': <AdminPricing />,
  'administracija/timovi': <AdminTeams />,
  'administracija/lige': <AdminLeagues />,
  'administracija/strane': <AdminPages />,
  'administracija/moderatori': <AdminModerators />,
  pravilnik: <Rulebook />,
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

/** The screen with the administration's navigation beside it (owner,
 *  30.07.2026, in two sectors since 06.08.2026). Everything else is handed
 *  through untouched. */
function inSection(path: string, screen: ReactElement): ReactElement {
  return path === 'administracija' || path.startsWith('administracija/') ? (
    <AdminSections>{screen}</AdminSections>
  ) : (
    screen
  )
}

/**
 * The screen at an address, with the door its address asks for and the section
 * it belongs to.
 *
 * Here rather than inside the screens, so that adding a fifteenth administrative
 * screen cannot mean adding a fifteenth check and forgetting what it should ask
 * for. Every address outside administration asks for nothing and is handed
 * through untouched (needs.ts).
 *
 * The door is outside the section: somebody who may not open a screen is not
 * shown the section it is in either. A refusal that came with a working
 * navigation would be an inventory of the rooms somebody is being kept out of.
 */
function guarded(path: string, screen: ReactElement): ReactElement {
  const need = needFor(path)
  const inside = inSection(path, screen)

  return need === undefined ? inside : <Guard need={need}>{inside}</Guard>
}

/* Detail screens. They are addresses, not navigation entries, so they are not
 * in ROUTES. */
const DETAILS: RouteObject[] = [
  { path: 'kalendar/dan/:date', element: <CalendarDay /> },
  { path: 'kalendar/:slug', element: <EventDetail /> },
  /* Reported from the event it was run at, so the form does not begin by asking
     which event it was (owner, 03.08.2026). Under the event's own address,
     because that is what it is about and where the way back leads. */
  { path: 'kalendar/:slug/prijava', element: <ReportResult /> },
  { path: 'kalendar/:slug/ocena', element: <RateEvent /> },
  { path: 'takmicar/:memberNumber', element: <CompetitorProfile /> },
  { path: 'takmicar/:memberNumber/priznanja', element: <CompetitorAwards /> },
  { path: 'tim/:slug', element: <TeamDetail /> },
  { path: 'liga/:slug', element: <LeagueDetail /> },
  { path: 'liga/:slug/rezultati', element: <LeagueDetail part="results" /> },
  { path: 'rezultat/novi', element: <NewResult /> },
  { path: 'poruke/:id', element: <MessageDetail /> },
  /* The six verification queues (PDL P28a). The addresses live in QUEUES, which
     is also what the list of queues links with, so a queue cannot end up with a
     row that points nowhere.

     Seven until 24.08.2026, when the proposed leagues left: a league is not
     proposed by anybody, the Administrator makes it (owner, 23.08.2026), so a
     queue for deciding on proposals had nothing that could ever reach it. */
  { path: QUEUE.results.path, element: <ReviewQueue /> },
  { path: QUEUE.payments.path, element: <Payments /> },
  { path: QUEUE.teams.path, element: <PendingQueue queue={QUEUE.teams} /> },
  { path: QUEUE.profiles.path, element: <PendingQueue queue={QUEUE.profiles} /> },
  { path: QUEUE.comments.path, element: <PendingQueue queue={QUEUE.comments} /> },
  { path: QUEUE.schedule.path, element: <PendingQueue queue={QUEUE.schedule} /> },
].map((route) => ({ ...route, element: guarded(route.path, route.element) }))

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
        element: guarded(route.path, screenFor(route)),
      })),
      ...DETAILS,
      { path: '*', element: <NotFound /> },
    ],
  },
]
