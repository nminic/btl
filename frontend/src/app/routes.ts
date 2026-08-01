import { isStaff, type Role } from '../roles/context'

export type Address = {
  /** Path relative to the locale segment, so "kalendar" becomes /sr/kalendar. */
  path: string
  /**
   * Name of the entry under `seo` in the dictionary, which holds the two texts
   * every address needs: the words that name the page and the sentence that
   * says what it is for.
   *
   * Kept apart from labelKey because a navigation label is read with the rest
   * of the portal around it, and a browser tab, a search result and a shared
   * link are read without it. "Tabela" on its own says nothing.
   */
  seoKey: string
}

export type RouteDef = Address & { labelKey: string }

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
  | {
      /** The entry leads straight to one screen, like the calendar. */
      path: string
      seoKey: string
      items?: never
    }
  | { path?: never; seoKey?: never; items: RouteDef[] }
)

/* The slugs stay Serbian in every language (ADL A2 writes the English route as
 * /en/kalendar). One address per screen, whichever language is shown. */
export const NAV: NavSection[] = [
  {
    id: 'about',
    labelKey: 'nav.about',
    /* Five, in this order, and all five settled on 30.07.2026 (PDL P28a).
     *
     * Membership is second because it is the page that leads to joining. The
     * story of the league and the badges are the other two that joined: both had
     * an address and not one link anywhere on the portal pointed at it, so they
     * were pages a person could only reach by typing the address. They are here
     * now and nowhere else; leaving them in UNLISTED_ROUTES as well would be the
     * same address served twice. */
    items: [
      { path: 'o-ligi', labelKey: 'nav.aboutLeague', seoKey: 'aboutLeague' },
      { path: 'pravilnik', labelKey: 'nav.rules', seoKey: 'rulebook' },
      { path: 'clanarina', labelKey: 'nav.pricing', seoKey: 'pricing' },
      { path: 'znacke', labelKey: 'nav.badges', seoKey: 'badges' },
      { path: 'istorijat', labelKey: 'nav.history', seoKey: 'history' },
    ],
  },
  { id: 'people', labelKey: 'nav.competitors', path: 'takmicari', seoKey: 'competitors' },
  { id: 'teams', labelKey: 'nav.teams', path: 'timovi', seoKey: 'teams' },
  /* "Rangiranje" (owner, 30.07.2026). It was briefly "Statistike", but the group
     holds three ways of ranking people rather than statistics about them, and the
     word says what a visitor came for. The standing inside it is free to be
     called what it is: the table. */
  {
    id: 'stats',
    labelKey: 'nav.stats',
    items: [
      { path: 'tabela', labelKey: 'nav.table', seoKey: 'table' },
      /* One name in the navigation and in the rulebook, Article 56 (PDL P28a).
         "Rang liste" and "top liste" are no longer used for the same thing. */
      { path: 'top-liste', labelKey: 'nav.topBoards', seoKey: 'topBoards' },
      { path: 'lige', labelKey: 'nav.competitions', seoKey: 'leagues' },
    ],
  },
  { id: 'calendar', labelKey: 'nav.calendar', path: 'kalendar', seoKey: 'calendar' },
  {
    id: 'admin',
    labelKey: 'nav.admin',
    staffOnly: true,
    items: [
      { path: 'administracija/entiteti', labelKey: 'nav.entities', seoKey: 'adminEntities' },
      {
        path: 'administracija/verifikacija',
        labelKey: 'nav.verification',
        seoKey: 'adminVerification',
      },
      { path: 'administracija/znacke', labelKey: 'admin.badges', seoKey: 'adminBadges' },
      /* Beside the two sections rather than inside one: the price list has four
         fixed rows, and nothing is created or removed on it (owner,
         30.07.2026), which is what the section of entities is for. */
      { path: 'administracija/cenovnik', labelKey: 'admin.pricing', seoKey: 'adminPricing' },
    ],
  },
]

/* The member area. It hangs off the picture and the cog in the header, not off
 * the navigation, because it belongs to one person rather than to the league. */
export const ACCOUNT_ROUTES: RouteDef[] = [
  { path: 'moj-profil', labelKey: 'nav.myProfile', seoKey: 'myProfile' },
  { path: 'moji-rezultati', labelKey: 'nav.myResults', seoKey: 'myResults' },
  { path: 'moja-clanarina', labelKey: 'nav.membership', seoKey: 'membership' },
  { path: 'poruke', labelKey: 'nav.messages', seoKey: 'messages' },
  { path: 'podesavanja', labelKey: 'nav.settings', seoKey: 'settings' },
]

/** Only these three, and Contact is a mailto rather than a screen (PDL P28a). */
export const FOOTER_ROUTES: RouteDef[] = [
  { path: 'politika-privatnosti', labelKey: 'nav.privacy', seoKey: 'privacy' },
  { path: 'uslovi-koriscenja', labelKey: 'nav.terms', seoKey: 'terms' },
]

export const CONTACT_ADDRESS = 'info@balkanskatrkackaliga.net'

/* Screens that have an address but no navigation entry: reached from a button,
 * a link inside a page, or the login symbol. */
const UNLISTED_ROUTES: RouteDef[] = [
  { path: 'registracija', labelKey: 'nav.register', seoKey: 'register' },
  { path: 'prijava', labelKey: 'nav.login', seoKey: 'signIn' },
  { path: 'administracija', labelKey: 'nav.admin', seoKey: 'admin' },
  { path: 'administracija/clanovi', labelKey: 'admin.members', seoKey: 'adminMembers' },
  { path: 'administracija/dogadjaji', labelKey: 'admin.events', seoKey: 'adminEvents' },
  { path: 'administracija/trke', labelKey: 'admin.races', seoKey: 'adminRaces' },
  { path: 'administracija/timovi', labelKey: 'admin.teams', seoKey: 'adminTeams' },
  { path: 'administracija/lige', labelKey: 'admin.leagues', seoKey: 'adminLeagues' },
  { path: 'administracija/strane', labelKey: 'admin.pages', seoKey: 'adminPages' },
  /* The ninth entity, reached from the list of entities like the other eight,
     and shown there to the superadmin alone (PDL P21, P28a). */
  { path: 'administracija/moderatori', labelKey: 'admin.moderators', seoKey: 'adminModerators' },
]

/* Addresses the router serves that the navigation never names: the home page,
 * the screens reached from a button, and the detail screens, where ':' stands
 * for one segment of any value.
 *
 * They are deliberately not in ROUTES, because ROUTES is what routeObjects
 * turns into router entries and these already have entries of their own. They
 * still need words for the tab, the search result and the shared link, and
 * before this table they had none: every one of them was named "Ove strane
 * nema", including the competitor profile, which is the most shared page on the
 * portal.
 *
 * What is written here is the name of the address, not of the record behind it.
 * The screen itself replaces both texts with the record once it has loaded it
 * (see PageMeta), and these stay as the answer while it loads and when the
 * record turns out not to exist. */
export const EXTRA_ADDRESSES: Address[] = [
  { path: '', seoKey: 'home' },
  { path: 'takmicar/:memberNumber', seoKey: 'competitor' },
  { path: 'takmicar/:memberNumber/priznanja', seoKey: 'competitorAwards' },
  /* Before the event, because the static segment has to win: /kalendar/dan/... is
     a day and never a race whose address happens to begin with "dan". */
  { path: 'kalendar/dan/:date', seoKey: 'calendarDay' },
  { path: 'kalendar/:slug', seoKey: 'event' },
  { path: 'tim/:slug', seoKey: 'team' },
  { path: 'liga/:slug', seoKey: 'league' },
  { path: 'liga/:slug/rezultati', seoKey: 'leagueResults' },
  /* Generic on purpose: the subject of a message is personal data and must not
   * end up in a browser tab, in history or in a shared link (PDL P23). */
  { path: 'poruke/:id', seoKey: 'message' },
  { path: 'rezultat/novi', seoKey: 'newResult' },
  /* One entry for every queue under verification, because they are all the same
   * kind of screen and the queues themselves are defined in QUEUES, next to the
   * verification screen. A ninth queue added there gets a name from here on the
   * day it is added, instead of being called "Ove strane nema" until somebody
   * notices. */
  { path: 'administracija/verifikacija/:queue', seoKey: 'verificationQueue' },
]

/** Every address the router has to know about, navigation entry or not. */
export const ROUTES: RouteDef[] = [
  ...NAV.flatMap((section) =>
    section.path === undefined
      ? section.items
      : [{ path: section.path, labelKey: section.labelKey, seoKey: section.seoKey }],
  ),
  ...ACCOUNT_ROUTES,
  ...FOOTER_ROUTES,
  ...UNLISTED_ROUTES,
]

/** Sections the given role is allowed to see, in navigation order. */
export function navForRole(role: Role): NavSection[] {
  return NAV.filter((section) => !section.staffOnly || isStaff(role))
}

function matches(pattern: string, path: string): boolean {
  const wanted = pattern.split('/')
  const given = path.split('/')

  return (
    wanted.length === given.length &&
    wanted.every((part, index) => part.startsWith(':') || part === given[index])
  )
}

/**
 * The seo entry for a path below the language, or undefined when the portal has
 * no such address, which is the not found page.
 *
 * Static addresses are tried before the ones that carry a value, so /kalendar
 * can never be answered by /kalendar/:slug.
 */
export function seoKeyFor(path: string): string | undefined {
  return [...ROUTES, ...EXTRA_ADDRESSES].find((address) => matches(address.path, path))?.seoKey
}
