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

/* One entry in the top navigation: one word, one screen. Order here is the order
 * on screen.
 *
 * There are no groups any more (owner, 04.08.2026). The navigation was two
 * levels deep for four of its six entries, so most of the portal was two clicks
 * and one hidden panel away; it is seven names now, each of them a place. What
 * had been the group "O ligi" is gone with it: the story of the league and the
 * page of prices are deleted, and the ducats have become a section of the
 * rulebook, which is where the rule that awards them already was. */
export type NavSection = RouteDef & {
  /** Stable id, so a test and a stylesheet can name an entry without its words. */
  id: string
  staffOnly?: boolean
}

/* The slugs stay Serbian in every language (ADL A2 writes the English route as
 * /en/kalendar). One address per screen, whichever language is shown. */
export const NAV: NavSection[] = [
  { id: 'rules', labelKey: 'nav.rules', path: 'pravilnik', seoKey: 'rulebook' },
  { id: 'people', labelKey: 'nav.competitors', path: 'takmicari', seoKey: 'competitors' },
  { id: 'table', labelKey: 'nav.table', path: 'tabela', seoKey: 'table' },
  { id: 'boards', labelKey: 'nav.topBoards', path: 'top-liste', seoKey: 'topBoards' },
  { id: 'teams', labelKey: 'nav.teams', path: 'timovi', seoKey: 'teams' },
  /* "Lige", which is what they are. They were called "Takmičenja" while they sat
     inside a group named for ranking, where the plain word would have read as
     the league itself (owner, 04.08.2026). */
  { id: 'leagues', labelKey: 'nav.leagues', path: 'lige', seoKey: 'leagues' },
  { id: 'calendar', labelKey: 'nav.calendar', path: 'kalendar', seoKey: 'calendar' },
  /* The way into administration, and the only entry a visitor never sees. It
     leads to the panel, which is the list of whatever this person may open; the
     screens behind it carry their own navigation down the side of each one
     (SectionNav), so nothing was lost by closing the panel that used to hang
     off this word. */
  { id: 'admin', labelKey: 'nav.admin', staffOnly: true, path: 'administracija', seoKey: 'admin' },
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
  /* Reached from the standing of the teams, by whoever is signed in. Not in the
     navigation: proposing a team is something a member does once, if ever. */
  { path: 'novi-tim', labelKey: 'teams.propose', seoKey: 'proposeTeam' },
  /* The two sections and the price list. They stood in the header while the
     navigation had groups; they are reached from the panel and from the
     navigation beside each screen now (owner, 04.08.2026). */
  { path: 'administracija/entiteti', labelKey: 'nav.entities', seoKey: 'adminEntities' },
  {
    path: 'administracija/verifikacija',
    labelKey: 'nav.verification',
    seoKey: 'adminVerification',
  },
  { path: 'administracija/cenovnik', labelKey: 'admin.pricing', seoKey: 'adminPricing' },
  { path: 'administracija/clanovi', labelKey: 'admin.members', seoKey: 'adminMembers' },
  { path: 'administracija/dogadjaji', labelKey: 'admin.events', seoKey: 'adminEvents' },
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
  /* Reached from the section of records rather than from the navigation of the
     administration, which offered it twice (owner, 01.08.2026). It is still an
     address and still needs a name. */
  /* Before the event, because the static segment has to win: /kalendar/dan/... is
     a day and never a race whose address happens to begin with "dan". */
  { path: 'kalendar/dan/:date', seoKey: 'calendarDay' },
  /* Before the event for the same reason the day is: /kalendar/x/prijava must
     not be read as an event whose address is "x/prijava". */
  { path: 'kalendar/:slug/prijava', seoKey: 'reportResult' },
  { path: 'kalendar/:slug/ocena', seoKey: 'rateEvent' },
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
  ...NAV.map(({ path, labelKey, seoKey }) => ({ path, labelKey, seoKey })),
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
