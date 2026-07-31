import type { ReactElement } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { DEFAULT_LOCALE } from '../i18n/config'
import { Badges } from '../pages/Badges'
import { Calendar } from '../pages/Calendar'
import { Competitors } from '../pages/Competitors'
import { CompetitorAwards } from '../pages/CompetitorAwards'
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
import { ENTITY_FORMS } from '../pages/admin/entityForms'
import { Guard } from '../pages/admin/Guard'
import { needFor } from '../pages/admin/needs'
import { EntitiesSection, VerificationSection } from '../pages/admin/SectionNav'
import { Verification } from '../pages/admin/Verification'
import { AdminBadges } from '../pages/admin/AdminBadges'
import { AdminEvents } from '../pages/admin/AdminEvents'
import { AdminMembers } from '../pages/admin/AdminMembers'
import { AdminLeagues } from '../pages/admin/AdminLeagues'
import { AdminModerators } from '../pages/admin/AdminModerators'
import { AdminPages } from '../pages/admin/AdminPages'
import { AdminPricing } from '../pages/admin/AdminPricing'
import { AdminRaces } from '../pages/admin/AdminRaces'
import { AdminTeams } from '../pages/admin/AdminTeams'
import { Payments } from '../pages/admin/Payments'
import { PendingQueue } from '../pages/admin/PendingQueue'
import { QUEUE, QUEUES } from '../pages/admin/queues'
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
  'administracija/moderatori': <AdminModerators />,
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

/* Which administrative section an address belongs to, read off the same two
 * lists the guards and the rights matrix are read off. A tenth entity or a
 * ninth queue therefore appears inside its section on the day it is added,
 * rather than on the day somebody remembers a third list. */
const VERIFICATION_PATHS = new Set([
  'administracija/verifikacija',
  ...QUEUES.map((queue) => queue.path),
])

/* A fixed entity is not in the section: nothing is created or removed there,
   which is what the section is (entityForms.ts). */
const ENTITY_PATHS = new Set([
  'administracija/entiteti',
  ...ENTITY_FORMS.filter((one) => one.fixed !== true).map((one) => one.path),
])

/** The screen with its section standing beside it, where it is in one (owner,
 *  30.07.2026). Everything else is handed through untouched. */
function inSection(path: string, screen: ReactElement): ReactElement {
  if (VERIFICATION_PATHS.has(path)) {
    return <VerificationSection>{screen}</VerificationSection>
  }

  if (ENTITY_PATHS.has(path)) {
    return <EntitiesSection>{screen}</EntitiesSection>
  }

  return screen
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
  { path: 'kalendar/:slug', element: <EventDetail /> },
  { path: 'takmicar/:memberNumber', element: <CompetitorProfile /> },
  { path: 'takmicar/:memberNumber/priznanja', element: <CompetitorAwards /> },
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
