import { isStaff, type Role } from '../roles/context'

export type RouteDef = {
  /** Path relative to the locale segment, so "kalendar" becomes /sr/kalendar. */
  path: string
  labelKey: string
}

/* One entry in the top navigation: either a single screen, or a group that
 * opens. Order here is the order on screen and comes from PDL P28a.
 *
 * The two halves are a union rather than two optional fields, so an entry that
 * is both, or neither, does not compile. A screen and a group need different
 * markup, and a runtime fallback for a case the type already rules out is a
 * line nothing can ever reach. */
export type NavSection = {
  /** Stable id for the trigger button and the panel it controls. */
  id: string
  labelKey: string
  staffOnly?: boolean
} & (
  | { /** The entry leads straight to one screen, like the calendar. */ path: string; items?: never }
  | { path?: never; items: RouteDef[] }
)

/* The slugs stay Serbian in every language (ADL A2 writes the English route as
 * /en/kalendar). One address per screen, whichever language is shown. */
export const NAV: NavSection[] = [
  {
    id: 'about',
    labelKey: 'nav.about',
    // Two entries for now, on the owner's word (29.07.2026). Badges and the
    // membership price keep their addresses in UNLISTED_ROUTES until he says
    // where in the navigation they belong.
    items: [
      { path: 'pravilnik', labelKey: 'nav.rules' },
      { path: 'istorijat', labelKey: 'nav.history' },
    ],
  },
  { id: 'people', labelKey: 'nav.competitors', path: 'takmicari' },
  { id: 'teams', labelKey: 'nav.teams', path: 'timovi' },
  /* "Statistike" rather than "Tabele", because the group holds three different
     kinds of thing and only one of them is a table. The standing itself is then
     free to be called what it is: the table. */
  {
    id: 'stats',
    labelKey: 'nav.stats',
    items: [
      { path: 'tabela', labelKey: 'nav.table' },
      { path: 'rang-liste', labelKey: 'nav.rankings' },
      { path: 'lige', labelKey: 'nav.competitions' },
    ],
  },
  { id: 'calendar', labelKey: 'nav.calendar', path: 'kalendar' },
  {
    id: 'admin',
    labelKey: 'nav.admin',
    staffOnly: true,
    items: [
      { path: 'administracija/entiteti', labelKey: 'nav.entities' },
      { path: 'administracija/verifikacija', labelKey: 'nav.verification' },
      { path: 'administracija/znacke', labelKey: 'admin.badges' },
    ],
  },
]

/* The member area. It hangs off the picture and the cog in the header, not off
 * the navigation, because it belongs to one person rather than to the league. */
export const ACCOUNT_ROUTES: RouteDef[] = [
  { path: 'moj-profil', labelKey: 'nav.myProfile' },
  { path: 'moji-rezultati', labelKey: 'nav.myResults' },
  { path: 'moja-clanarina', labelKey: 'nav.membership' },
  { path: 'poruke', labelKey: 'nav.messages' },
  { path: 'podesavanja', labelKey: 'nav.settings' },
]

/** Only these three, and Contact is a mailto rather than a screen (PDL P28a). */
export const FOOTER_ROUTES: RouteDef[] = [
  { path: 'politika-privatnosti', labelKey: 'nav.privacy' },
  { path: 'uslovi-koriscenja', labelKey: 'nav.terms' },
]

export const CONTACT_ADDRESS = 'info@balkanskatrkackaliga.net'

/* Screens that have an address but no navigation entry: reached from a button,
 * a link inside a page, or the login symbol. */
const UNLISTED_ROUTES: RouteDef[] = [
  { path: 'o-ligi', labelKey: 'nav.aboutLeague' },
  { path: 'znacke', labelKey: 'nav.badges' },
  { path: 'clanarina', labelKey: 'nav.pricing' },
  { path: 'registracija', labelKey: 'nav.register' },
  { path: 'prijava', labelKey: 'nav.login' },
  { path: 'administracija', labelKey: 'nav.admin' },
  { path: 'administracija/clanovi', labelKey: 'admin.members' },
  { path: 'administracija/dogadjaji', labelKey: 'admin.events' },
  { path: 'administracija/trke', labelKey: 'admin.races' },
  { path: 'administracija/timovi', labelKey: 'admin.teams' },
  { path: 'administracija/lige', labelKey: 'admin.leagues' },
  { path: 'administracija/cenovnik', labelKey: 'admin.pricing' },
  { path: 'administracija/strane', labelKey: 'admin.pages' },
]

/** Every address the router has to know about, navigation entry or not. */
export const ROUTES: RouteDef[] = [
  ...NAV.flatMap((section) =>
    section.path === undefined
      ? section.items
      : [{ path: section.path, labelKey: section.labelKey }],
  ),
  ...ACCOUNT_ROUTES,
  ...FOOTER_ROUTES,
  ...UNLISTED_ROUTES,
]

/** Sections the given role is allowed to see, in navigation order. */
export function navForRole(role: Role): NavSection[] {
  return NAV.filter((section) => !section.staffOnly || isStaff(role))
}
