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

export type RouteDef = Address & {
  labelKey: string
  /**
   * Kept out of the menu behind the account picture, while staying an address
   * the router serves and a screen the portal names.
   *
   * Here rather than in the menu, because the two lists this file exports are
   * read by two different things: the router builds every address out of them,
   * and the menu draws some of them. A screen reached by a shorter way of its
   * own is still a screen.
   */
  notInMenu?: boolean
  /**
   * Whom the entry in the menu behind the account picture is drawn to, when that is not "every
   * account": `unpaid` is somebody who registered and has not paid and NOBODY ELSE, `unpaidToo` is
   * everybody and him as well. Left out, the entry is drawn to every account except him.
   *
   * An entry of his is also an address the router serves, so the list stays one list: it is what
   * the router is built from and `accountMenuFor` is the one place that says who sees which of
   * them (PDL 22.10.2026, „Član koji još nije platio: bez reči nalog, samo Članarina").
   */
  menuFor?: 'unpaid' | 'unpaidToo'
}

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

/* The slugs stay Serbian in every language
 * (PDL P18, „Adrese nose **jezički prefiks za sve jezike, uključujući srpski**"),
 * which is why the decision writes the English route as /en/kalendar rather than
 * /en/calendar. One address per screen, whichever language is shown. */
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
  /* The way into administration, and the only entry a visitor never sees. What
     it leads to draws nothing of its own since 06.08.2026: the navigation of two
     sectors stands down the side of every screen behind it (SectionNav), so a
     landing page listing the same entries was the list said twice. */
  { id: 'admin', labelKey: 'nav.admin', staffOnly: true, path: 'administracija', seoKey: 'admin' },
]

/* WHERE A MEMBER PAYS AND CHOOSES HIS CATEGORY, as a name and not only as a row of the list
 * below. The part of the portal that sends somebody who cannot use a screen yet to the one he can
 * (`pages/member/SentToTheFee.tsx`) has to point here, and a second spelling of an address is the
 * first thing a rename leaves behind. */
export const MEMBERSHIP_ADDRESS = 'moja-clanarina'

/* WHERE SOMEBODY WHO HAS NOT PAID CHANGES HIS DATA, until the fee is recorded. After that the data
 * are on the card „Podaci" of his profile. */
export const MY_DATA_ADDRESS = 'moji-podaci'

/* The member area. It hangs off the picture and the cog in the header, not off
 * the navigation, because it belongs to one person rather than to the league. */
export const ACCOUNT_ROUTES: RouteDef[] = [
  /* HIS, UNTIL HE IS APPROVED, and above the page he pays on (owner, 22.10.2026: „Neka ima u
     navigaciji stranu Moji Podaci dok nije odobren koja je iznad Moja Članarina."). Nobody else is
     drawn it: the member whose fee stands changes his data on the card „Podaci" of his profile. */
  { path: MY_DATA_ADDRESS, labelKey: 'nav.myData', seoKey: 'myData', menuFor: 'unpaid' },
  { path: 'moj-profil', labelKey: 'nav.myProfile', seoKey: 'myProfile' },
  { path: 'moji-rezultati', labelKey: 'nav.myResults', seoKey: 'myResults' },
  { path: MEMBERSHIP_ADDRESS, labelKey: 'nav.membership', seoKey: 'membership', menuFor: 'unpaidToo' },
  /* Not drawn in the menu behind the picture (owner, 23.08.2026): the envelope
     in the header opens the inbox and „Sve poruke" stands at the foot of it,
     which is one press fewer than the menu. It stays in this list because the
     router is built from it too, so leaving would take the address with it. */
  { path: 'poruke', labelKey: 'nav.messages', seoKey: 'messages', notInMenu: true },
  { path: 'podesavanja', labelKey: 'nav.settings', seoKey: 'settings' },
]

/** Only these three, and Contact is a mailto rather than a screen (PDL P28a).
 *
 *  The statute is not among them and it is not in the footer at all. It was a page of
 *  twenty sections until 20.08.2026, when the owner asked that it not be put in front of
 *  members; a review then found that taking it off the portal breaks član 34 stav 6 of
 *  the statute itself, so on 21.08.2026 it became a file linked beside Contact. On
 *  22.08.2026 the owner asked for that button to go as well („ne želim ga tu") and for
 *  the name of the statute in the first section of the terms to be the link instead.
 *  The obligation is met there: one published copy is a published copy, and it is the
 *  document a member accepts on joining, which is where somebody looking for it goes. */
/**
 * The entries of the menu behind the account picture, for one kind of reader.
 *
 * Somebody who registered and has not paid is drawn two of them, „Moji podaci" and then „Moja
 * članarina", and nothing else (owner, 22.10.2026: „Sve opcije koje mu nisu dostupne privremeno
 * (dakle sve osim Članarine) ne treba da mu uopšte budu dostupne"). Everybody else is drawn the
 * list as it was, without „Moji podaci" and without the entries that have a shorter way in of their
 * own. The sign out button is not in this list for either of them and stays for both.
 */
export function accountMenuFor(unpaid: boolean): RouteDef[] {
  return ACCOUNT_ROUTES.filter((route) =>
    unpaid
      ? route.menuFor !== undefined
      : route.notInMenu !== true && route.menuFor !== 'unpaid',
  )
}

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
  /* The two addresses the SERVER writes, and the only two on this list that are
     not ours to rename: `WhatTheMessageSays.Message` hangs `/nova-lozinka` and
     `/potvrda-adrese` on the portal's own address and posts them, so every message
     already sent carries one of them. Reached from a link in a message and from
     nowhere on the portal, which is why they are here and not in the navigation.

     What holds the two sides together is not this sentence but two cases that meet on
     `postedAddresses.json`: `APostedAddressHasAScreenTest` asks `Message.values()` what
     goes out and pins that file to it, and `routes.test.ts` requires every address in it
     to be among the paths `routeObjects` actually serves. Removing, commenting out or
     moving a row below is therefore loud, and so is editing the file to match.

     The link in a message carries no language, because the server does not know
     which one the reader wants. `LocaleLayout` is what makes that work: a first
     segment that is not a language is sent on to `/sr` with the query intact. */
  { path: 'nova-lozinka', labelKey: 'nav.newPassword', seoKey: 'newPassword' },
  { path: 'potvrda-adrese', labelKey: 'nav.confirmAddress', seoKey: 'confirmAddress' },
  /* Where a forgotten password is asked about, which is the near end of the road the
     two addresses above are the far end of. Unlike them, THIS ONE IS OURS TO NAME: the
     server posts no link to it, so nothing already sent carries it and it is not in
     `postedAddresses.json`. Reached from the sign in page, by the name the messages
     themselves already use for it - „zatražite novu sa strane za prijavu, na
     „Zaboravljena lozinka"" (backend/src/main/resources/mail/sr.properties) - which is
     why it is unlisted rather than in the navigation: somebody who can sign in has no
     use for it. */
  { path: 'zaboravljena-lozinka', labelKey: 'nav.forgottenPassword', seoKey: 'forgottenPassword' },
  /* Reached from the standing of the teams, by whoever is signed in. Not in the
     navigation: proposing a team is something a member does once, if ever. */
  { path: 'novi-tim', labelKey: 'teams.propose', seoKey: 'proposeTeam' },
  /* The two sectors. They stood in the header while the navigation had groups;
     they are reached from the navigation beside every administrative screen now
     (owner, 04.08.2026). */
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
  /* An entity like the six beside it, reached from the same list,
     and shown there to the superadmin alone (PDL P21, P28a). */
  { path: 'administracija/moderatori', labelKey: 'admin.moderators', seoKey: 'adminModerators' },
  /* „Unos rezultata za događaj”, the moderator's own screen (PDL P9, 19.10.2026), reached from the
     navigation beside the queues for whoever checks results; named for the search as the event page's
     entry is, since it is the same work. */
  { path: 'administracija/unos-rezultata', labelKey: 'leagueResults.menu', seoKey: 'leagueResultsForAnEvent' },
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
  { path: 'takmicar/:memberNumber/podaci', seoKey: 'competitorData' },
  /* Before the event, because the static segment has to win: /kalendar/dan/... is
     a day and never a race whose address happens to begin with "dan". */
  { path: 'kalendar/dan/:date', seoKey: 'calendarDay' },
  /* Before the event for the same reason the day is: /kalendar/x/prijava must
     not be read as an event whose address is "x/prijava". */
  { path: 'kalendar/:slug/prijava', seoKey: 'reportResult' },
  /* The league's own entry of results from the event page (PDL P9, 18.10.2026), before the event
     for the reason the report stands there. */
  { path: 'kalendar/:slug/rezultati', seoKey: 'leagueResults' },
  { path: 'kalendar/:slug/ocena', seoKey: 'rateEvent' },
  { path: 'kalendar/:slug', seoKey: 'event' },
  /* Before the team's own address, as the report of a result stands before the
     event's: the longer address is the more particular one. */
  { path: 'tim/:slug/izmena', seoKey: 'editTeam' },
  { path: 'tim/:slug', seoKey: 'team' },
  { path: 'liga/:slug', seoKey: 'league' },
  /* Generic on purpose: the subject of a message is personal data and must not
   * end up in a browser tab, in history or in a shared link (PDL P23). */
  { path: 'poruke/:id', seoKey: 'message' },
  /* The registration page with a referral code in it, named as the registration page is: the
     code is not part of what the page is (`app/useRouteChrome.ts` gives it the same canonical
     address too). */
  { path: 'registracija/:code', seoKey: 'register' },
  { path: 'rezultat/novi', seoKey: 'newResult' },
  /* One entry for every queue under verification, because they are all the same
   * kind of screen and the queues themselves are defined in QUEUES, next to the
   * verification screen. An eighth queue added there gets a name from here on the
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
