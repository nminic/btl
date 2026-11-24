import type { ReactElement } from 'react'
import type { RouteObject } from 'react-router'
import { Guard } from '../pages/admin/Guard'
import { needFor } from '../pages/admin/needs'
import { QUEUE } from '../pages/admin/queues'
import { AdminSections } from '../pages/admin/SectionNav'
import { Placeholder } from '../pages/Placeholder'
import { UNNUMBERED_DATA_ADDRESS, type RouteDef } from './routes'

/**
 * EVERY SCREEN OF THE PORTAL, LOADED THE FIRST TIME IT IS OPENED (inkrement „Poboljšanje performansi”,
 * korak 2, owner, 21.11.2026: „Kod se deli po stranama (lenjo učitavanje ruta: administracija, kalendar i
 * ostalo tek kad se otvore)”). Measured on 22.11.2026: the portal was one piece of 1038 KB, 312 KB over the
 * wire, and a visitor opening a profile downloaded the administration with it.
 *
 * <p><b>Through the router's own `lazy`, and not `React.lazy` under a `Suspense`.</b> The router waits for
 * the screen before it moves to it, so the screen that was there stays until the next one can be drawn
 * whole: the focus is moved to it (`useNewScreen`) and the scroll is put back (`ScrollRestoration`) onto a
 * screen that exists, as they were before. A `Suspense` would commit the address first and draw a stand-in,
 * and both would land on the stand-in.
 *
 * <p><b>What is NOT here and is loaded with the portal itself</b>: the front page, which is where most visits
 * start and would otherwise wait for a second request (the coordinator's reasoning, 22.11.2026, reported to
 * the owner), and the screen for an address the portal does not have (`app/routeObjects.tsx`).
 *
 * <p><b>One table, read twice.</b> The portal reads it through {@link lazyRoute}; the tests read the same
 * table with every screen already loaded (`test/setup.ts`, the shape `components/TextEditor.tsx` set), so
 * the cases written against a screen that is drawn at once go on measuring the screen and not the loading,
 * and `app/screens.test.tsx` measures the loading itself through the real {@link lazyRoute}.
 */

/** How one screen is had: its module, asked for the first time the screen is opened. */
export type Load = () => Promise<ReactElement>

/** A screen out of a module, written once so that every row of the tables below is one line. */
export function of<M>(module: () => Promise<M>, draw: (loaded: M) => ReactElement): Load {
  return async () => {
    /* Vite's wrapper around a piece answers `undefined` when `staleChunks` has stopped the failure to read
       the page again (`vite:preloadError`, `event.preventDefault()`). The page is on its way to being
       replaced, so the screen waits for it: nothing is drawn from a module that does not exist and nothing
       is thrown, and the screen before stays until the reload arrives. */
    const loaded: M | undefined = await module()

    return loaded === undefined ? new Promise<ReactElement>(() => undefined) : draw(loaded)
  }
}

/* Screens that already exist, which is every address in ROUTES since the ducats
 * arrived. Anything else in ROUTES renders a placeholder, so the navigation can
 * be walked end to end from the day an address is added. */
export const SCREENS: Record<string, Load> = {
  kalendar: of(() => import('../pages/Calendar'), (m) => <m.Calendar />),
  tabela: of(() => import('../pages/Rankings'), (m) => <m.Rankings />),
  'top-liste': of(() => import('../pages/TopBoards'), (m) => <m.TopBoards />),
  takmicari: of(() => import('../pages/Competitors'), (m) => <m.Competitors />),
  timovi: of(() => import('../pages/Teams'), (m) => <m.Teams />),
  'novi-tim': of(() => import('../pages/member/ProposeTeam'), (m) => <m.ProposeTeam />),
  lige: of(() => import('../pages/Leagues'), (m) => <m.Leagues />),
  registracija: of(() => import('../pages/Registration'), (m) => <m.Registration />),
  prijava: of(() => import('../pages/member/SignIn'), (m) => <m.SignIn />),
  'nova-lozinka': of(() => import('../pages/account/NewPassword'), (m) => <m.NewPassword />),
  'potvrda-adrese': of(() => import('../pages/account/ConfirmAddress'), (m) => <m.ConfirmAddress />),
  'zaboravljena-lozinka': of(() => import('../pages/account/ForgottenPassword'), (m) => <m.ForgottenPassword />),
  'moj-profil': of(() => import('../pages/member/MyProfile'), (m) => <m.MyProfile />),
  'moji-podaci': of(() => import('../pages/member/MyData'), (m) => <m.MyData />),
  'moji-rezultati': of(() => import('../pages/member/MyResults'), (m) => <m.MyResults />),
  'moja-clanarina': of(() => import('../pages/member/Membership'), (m) => <m.Membership />),
  poruke: of(() => import('../pages/member/Messages'), (m) => <m.Messages />),
  podesavanja: of(() => import('../pages/member/Settings'), (m) => <m.Settings />),
  administracija: of(() => import('../pages/admin/Admin'), (m) => <m.Admin />),
  'administracija/entiteti': of(() => import('../pages/admin/Entities'), (m) => <m.Entities />),
  'administracija/verifikacija': of(() => import('../pages/admin/Verification'), (m) => <m.Verification />),
  'administracija/clanovi': of(() => import('../pages/admin/AdminMembers'), (m) => <m.AdminMembers />),
  'administracija/dogadjaji': of(() => import('../pages/admin/AdminEvents'), (m) => <m.AdminEvents />),
  'administracija/cenovnik': of(() => import('../pages/admin/AdminPricing'), (m) => <m.AdminPricing />),
  'administracija/timovi': of(() => import('../pages/admin/AdminTeams'), (m) => <m.AdminTeams />),
  'administracija/lige': of(() => import('../pages/admin/AdminLeagues'), (m) => <m.AdminLeagues />),
  'administracija/sponzori': of(() => import('../pages/admin/AdminSponsors'), (m) => <m.AdminSponsors />),
  'administracija/strane': of(() => import('../pages/admin/AdminPages'), (m) => <m.AdminPages />),
  'administracija/moderatori': of(() => import('../pages/admin/AdminModerators'), (m) => <m.AdminModerators />),
  'administracija/unos-rezultata': of(() => import('../pages/event/EnterResults'), (m) => <m.EnterForAnEvent />),
  pravilnik: of(() => import('../pages/Rulebook'), (m) => <m.Rulebook />),
  'politika-privatnosti': of(() => import('../pages/StaticPage'), (m) => <m.StaticPage slug="politika-privatnosti" />),
  'uslovi-koriscenja': of(() => import('../pages/StaticPage'), (m) => <m.StaticPage slug="uslovi-koriscenja" />),
}

/**
 * The screen at an address, or a stand-in for one.
 *
 * Every address in ROUTES has a screen of its own today. The stand-in is what a
 * newly added address answers with on the day it is added and before its screen
 * exists, so the navigation can always be walked end to end.
 */
export function screenFor(route: RouteDef): Load {
  return SCREENS[route.path] ?? (async () => <Placeholder labelKey={route.labelKey} />)
}

/* Detail screens. They are addresses, not navigation entries, so they are not
 * in ROUTES. */
export const DETAILS: { path: string; load: Load }[] = [
  { path: 'kalendar/dan/:date', load: of(() => import('../pages/CalendarDay'), (m) => <m.CalendarDay />) },
  { path: 'kalendar/:slug', load: of(() => import('../pages/EventDetail'), (m) => <m.EventDetail />) },
  /* Reported from the event it was run at, so the form does not begin by asking
     which event it was (owner, 03.08.2026). Under the event's own address,
     because that is what it is about and where the way back leads. */
  { path: 'kalendar/:slug/prijava', load: of(() => import('../pages/event/ReportResult'), (m) => <m.ReportResult />) },
  { path: 'kalendar/:slug/rezultati', load: of(() => import('../pages/event/EnterResults'), (m) => <m.EnterResults />) },
  { path: 'kalendar/:slug/ocena', load: of(() => import('../pages/event/RateEvent'), (m) => <m.RateEvent />) },
  { path: 'takmicar/:memberNumber', load: of(() => import('../pages/CompetitorProfile'), (m) => <m.CompetitorProfile />) },
  { path: 'takmicar/:memberNumber/priznanja', load: of(() => import('../pages/CompetitorAwards'), (m) => <m.CompetitorAwards />) },
  /* The card „Podaci", which only the administration opens (owner, 22.10.2026 and 07.11.2026); the member
     himself is sent to „Moji podaci" (`CompetitorData.tsx`). */
  { path: 'takmicar/:memberNumber/podaci', load: of(() => import('../pages/CompetitorData'), (m) => <m.CompetitorData />) },
  /* The same form for somebody who registered and has no member number, from the pencil on the screen
     Uplate (owner, 10.11.2026). Behind the door of the screen of the members (`needs.ts`). */
  { path: UNNUMBERED_DATA_ADDRESS, load: of(() => import('../pages/admin/UnnumberedMemberData'), (m) => <m.UnnumberedMemberData />) },
  { path: 'tim/:slug', load: of(() => import('../pages/TeamDetail'), (m) => <m.TeamDetail />) },
  /* Changing a team is the team's own address plus a word, the way reporting a
     result sits under the event it was run at: it is about that team, and the way
     back leads there (owner, 04.09.2026). */
  { path: 'tim/:slug/izmena', load: of(() => import('../pages/member/EditTeam'), (m) => <m.EditTeam />) },
  { path: 'liga/:slug', load: of(() => import('../pages/LeagueDetail'), (m) => <m.LeagueDetail />) },
  { path: 'rezultat/novi', load: of(() => import('../pages/member/NewResult'), (m) => <m.NewResult />) },
  { path: 'poruke/:id', load: of(() => import('../pages/member/MessageDetail'), (m) => <m.MessageDetail />) },
  /* The registration page with the code of whoever brought the reader in it (owner, 22.10.2026:
     „Link preporuke nosi samo šifru u adresi strane za registraciju"). The same screen as
     `registracija`, which reads the segment itself (`pages/Registration.tsx`). */
  { path: 'registracija/:code', load: of(() => import('../pages/Registration'), (m) => <m.Registration />) },
  /* The five verification queues (PDL P28a). The addresses live in QUEUES, which
     is also what the list of queues links with, so a queue cannot end up with a
     row that points nowhere. */
  { path: QUEUE.results.path, load: of(() => import('../pages/admin/ReviewQueue'), (m) => <m.ReviewQueue />) },
  { path: QUEUE.payments.path, load: of(() => import('../pages/admin/Payments'), (m) => <m.Payments />) },
  { path: QUEUE.teams.path, load: of(() => import('../pages/admin/PendingQueue'), (m) => <m.PendingQueue queue={QUEUE.teams} />) },
  { path: QUEUE.profiles.path, load: of(() => import('../pages/admin/PendingQueue'), (m) => <m.PendingQueue queue={QUEUE.profiles} />) },
  { path: QUEUE.comments.path, load: of(() => import('../pages/admin/PendingQueue'), (m) => <m.PendingQueue queue={QUEUE.comments} />) },
]

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
export function guarded(path: string, screen: ReactElement): ReactElement {
  const need = needFor(path)
  const inside = inSection(path, screen)

  return need === undefined ? inside : <Guard need={need}>{inside}</Guard>
}

/** An address whose screen is loaded the first time it is opened, behind its door (see the head of this file). */
export function lazyRoute(path: string, load: Load): RouteObject {
  return { path, lazy: async () => ({ element: guarded(path, await load()) }) }
}
