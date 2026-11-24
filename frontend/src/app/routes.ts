import { isStaff, type Role } from '../roles/context'
import { NAV_SYMBOL, type NavSymbol } from './navSymbol'

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
   * Drawn in the menu behind the account picture to somebody who registered and has not paid as
   * well. Left out, the entry is drawn to every account except him.
   *
   * An entry of his is also an address the router serves, so the list stays one list: it is what
   * the router is built from and `accountMenuFor` is the one place that says who sees which of
   * them (PDL 22.10.2026, „Član koji još nije platio: bez reči nalog, samo Članarina").
   */
  unpaidToo?: true
  /**
   * NOT drawn in that menu to a member whose fee has lapsed. Owner, 07.11.2026 (PDL, „nema stavku
   * „Moji podaci” u meniju”): „Član kome je istekla članarina nema stavku „Moji podaci” u meniju, a
   * adresa ga šalje na „Moja članarina”, kao do sada (pravilo od 19.09.2026).”
   */
  notToTheLapsed?: true
  /**
   * The name the entry carries for a member whose profile has not both a picture and words about
   * himself yet, instead of `labelKey` (owner, 07.11.2026, PDL „Član svojim podacima pristupa iz
   * glavnog menija”: „Stavka menija se zove „Dopuni podatke” [...] dok član nema i sliku i tekst o
   * sebi, a posle toga „Moji podaci”").
   */
  unfinishedLabelKey?: string
  /**
   * THE ENTRY IS HIS OWN PUBLIC PROFILE, the address he can share (owner, 16.11.2026, PDL P11, „Moj
   * profil vodi na javnu adresu člana”): „Ne treba mi da postoji moj-profil adresa, nego da uvek otvori
   * onu koju moze lako da share-uje drugima”. So the menu links it to `/takmicar/<number>-<name>`
   * rather than to its own path, and draws it only to a reader the league keeps a competitor record
   * for: an account of the administration with none has no profile for it to lead to (`accountMenuFor`).
   *
   * Its own path stays an address the router serves, and only leads on to that profile
   * (`member/MyProfile.tsx`).
   */
  hisPublicProfile?: true
}

/**
 * The four readers the menu behind the account picture tells apart: somebody who registered and has
 * not paid, a member whose fee has lapsed, a member whose fee stands, and an account of the
 * administration that races for nobody and so has no competitor record (PDL P21).
 *
 * The last two were one reader, `anybodyElse`, until 16.11.2026, when „Moj profil" became a link to
 * his public profile: an account with no record has none (`hisPublicProfile`).
 */
export type MenuReader = 'neverPaid' | 'lapsed' | 'standing' | 'account'

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
  /**
   * Other addresses on which this entry is the one marked as the screen being read, beside its own
   * and the ones below it.
   *
   * „BTL tabele" is marked on the teams as well (owner, 16.11.2026, PDL „Pravilnik prelazi u
   * podnožje, a Timovi postaju treća kartica BTL tabela", answer 8, chosen with my recommendation:
   * „BTL tabele" in the navigation lights on all three cards), because the teams are its third card
   * and no longer an entry of their own.
   */
  alsoMarkedOn?: string[]
  /**
   * What the entry is drawn as on a telephone, where the header has a row of symbols and no words
   * (owner, 16.11.2026, answers 5 and 6; `app/navSymbol.ts`). Asked of every entry, so an entry that
   * comes without a symbol is refused by the compiler and not found on a telephone.
   */
  symbol: NavSymbol
}

/* WHERE THE STANDING OF THE TEAMS IS SERVED, as a name: the third card of the tables links to it and
 * the entry of the tables is marked on it, and a second spelling of an address is the first thing a
 * rename leaves behind. Its own address, as it always was (owner, 16.11.2026, answer 8). */
export const TEAMS_ADDRESS = 'timovi'

/** Where the standing of the people is served, which is the first two cards of the tables. */
export const TABLE_ADDRESS = 'tabela'

/** Where the boards of the season are served (Top liste), named for the strip under the header, which stands
 *  on this address and on the front page and the tables (`app/NoticeBar.tsx`). */
export const TOP_BOARDS_ADDRESS = 'top-liste'

/* The slugs stay Serbian in every language
 * (PDL P18, „Adrese nose **jezički prefiks za sve jezike, uključujući srpski**"),
 * which is why the decision writes the English route as /en/kalendar rather than
 * /en/calendar. One address per screen, whichever language is shown. */
export const NAV: NavSection[] = [
  { id: 'people', labelKey: 'nav.competitors', path: 'takmicari', seoKey: 'competitors', symbol: NAV_SYMBOL.people },
  {
    id: 'table',
    labelKey: 'nav.table',
    path: TABLE_ADDRESS,
    seoKey: 'table',
    alsoMarkedOn: [TEAMS_ADDRESS],
    symbol: NAV_SYMBOL.ranking,
  },
  { id: 'boards', labelKey: 'nav.topBoards', path: TOP_BOARDS_ADDRESS, seoKey: 'topBoards', symbol: NAV_SYMBOL.steps },
  /* "Lige", which is what they are. They were called "Takmičenja" while they sat
     inside a group named for ranking, where the plain word would have read as
     the league itself (owner, 04.08.2026). */
  { id: 'leagues', labelKey: 'nav.leagues', path: 'lige', seoKey: 'leagues', symbol: NAV_SYMBOL.trophy },
  { id: 'calendar', labelKey: 'nav.calendar', path: 'kalendar', seoKey: 'calendar', symbol: NAV_SYMBOL.calendar },
  /* The rulebook and the teams are not here since 16.11.2026, on any width (owner: „1. Pravilnik
     prelazi na dno, footer, pre Politike privatnosti” and „2. Timovi prelazi BTL tabele kao treća
     ravnopravna opcija koja se otvara klikom na Timovi”): the rulebook is the first link of the
     footer, and the teams are the third card of the tables (`pages/TableCards.tsx`). */
  /* The way into administration, and the only entry a visitor never sees. What
     it leads to draws nothing of its own since 06.08.2026: the navigation of two
     sectors stands down the side of every screen behind it (SectionNav), so a
     landing page listing the same entries was the list said twice. */
  {
    id: 'admin',
    labelKey: 'nav.admin',
    staffOnly: true,
    path: 'administracija',
    seoKey: 'admin',
    symbol: NAV_SYMBOL.sliders,
  },
]

/* WHERE A MEMBER PAYS AND CHOOSES HIS CATEGORY, as a name and not only as a row of the list
 * below. The part of the portal that sends somebody who cannot use a screen yet to the one he can
 * (`pages/member/SentToTheFee.tsx`) has to point here, and a second spelling of an address is the
 * first thing a rename leaves behind. */
export const MEMBERSHIP_ADDRESS = 'moja-clanarina'

/* WHERE A MEMBER CHANGES HIS DATA, HIS PICTURE AND HIS WORDS ABOUT HIMSELF, and where somebody who
 * has not paid changes his data (owner, 07.11.2026, PDL „Član svojim podacima pristupa iz glavnog
 * menija”: „Takmicari vide samo u glavnom meniju i tu pristupaju, a administratori vide na stranici
 * takmicara i tu pristupaju”). */
export const MY_DATA_ADDRESS = 'moji-podaci'

/**
 * Where the pencil on the screen Uplate leads for somebody who registered and has no member number yet
 * (owner, 10.11.2026): the form of his data by the key the screen lists him under
 * (`pages/admin/UnnumberedMemberData.tsx`). It has the door of the screen of the members (`needs.ts`),
 * and stands outside `clanovi/`, because the section's own link to that screen would read as a way up
 * a level from it (`pages/publicData.test.tsx`).
 */
export const UNNUMBERED_DATA_ADDRESS = 'administracija/podaci-clana/:competitorId'

/** That address for one registrant, with the language. */
export function unnumberedDataPath(locale: string, competitorId: number): string {
  return `/${locale}/${UNNUMBERED_DATA_ADDRESS.replace(':competitorId', String(competitorId))}`
}

/* The member area. It hangs off the picture and the cog in the header, not off
 * the navigation, because it belongs to one person rather than to the league.
 *
 * IN THE ORDER THE OWNER NAMES THEM (07.11.2026: „Moj profil”, „Moji podaci”, „Moji rezultati”,
 * „Moja članarina”), which keeps „Moji podaci" above „Moja članarina" for somebody who has not paid
 * (owner, 22.10.2026: „Neka ima u navigaciji stranu Moji Podaci dok nije odobren koja je iznad Moja
 * Članarina."). */
export const ACCOUNT_ROUTES: RouteDef[] = [
  /* Linked to his public profile and not to this path, and drawn only to a reader who has one
     (`hisPublicProfile`). */
  { path: 'moj-profil', labelKey: 'nav.myProfile', seoKey: 'myProfile', hisPublicProfile: true },
  /* Drawn to every reader but a member whose fee has lapsed, and named „Dopuni podatke" to a member
     whose profile lacks the picture or the words (`AccountMenu.tsx` asks which). */
  {
    path: MY_DATA_ADDRESS,
    labelKey: 'nav.myData',
    seoKey: 'myData',
    unpaidToo: true,
    notToTheLapsed: true,
    unfinishedLabelKey: 'nav.completeData',
  },
  { path: 'moji-rezultati', labelKey: 'nav.myResults', seoKey: 'myResults' },
  { path: MEMBERSHIP_ADDRESS, labelKey: 'nav.membership', seoKey: 'membership', unpaidToo: true },
  /* Not drawn in the menu behind the picture (owner, 23.08.2026): the envelope
     in the header opens the inbox and „Sve poruke" stands at the foot of it,
     which is one press fewer than the menu. It stays in this list because the
     router is built from it too, so leaving would take the address with it. */
  { path: 'poruke', labelKey: 'nav.messages', seoKey: 'messages', notInMenu: true },
  { path: 'podesavanja', labelKey: 'nav.settings', seoKey: 'settings' },
]

/** The rulebook, the privacy policy and the terms, and Contact is a mailto rather than a screen
 *  (PDL P28a). The rulebook is the first of them since 16.11.2026 (owner: „Pravilnik prelazi na
 *  dno, footer, pre Politike privatnosti”), on every width.
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
 * (dakle sve osim Članarine) ne treba da mu uopšte budu dostupne"). A member whose fee has lapsed is
 * drawn the list without „Moji podaci" (owner, 07.11.2026). An account with no competitor record is
 * drawn the list without „Moj profil", which would lead to a profile he does not have (owner,
 * 16.11.2026, PDL P11, „Moj profil vodi na javnu adresu člana”). A member whose fee stands is drawn the
 * whole list. Nobody is drawn the entries that have a shorter way in of their own. The sign out button
 * is not in this list for any of them and stays for all.
 */
export function accountMenuFor(reader: MenuReader): RouteDef[] {
  return ACCOUNT_ROUTES.filter((route) =>
    reader === 'neverPaid'
      ? route.unpaidToo === true
      : route.notInMenu !== true &&
        !(reader === 'lapsed' && route.notToTheLapsed === true) &&
        !(reader === 'account' && route.hisPublicProfile === true),
  )
}

export const FOOTER_ROUTES: RouteDef[] = [
  { path: 'pravilnik', labelKey: 'nav.rules', seoKey: 'rulebook' },
  { path: 'politika-privatnosti', labelKey: 'nav.privacy', seoKey: 'privacy' },
  { path: 'uslovi-koriscenja', labelKey: 'nav.terms', seoKey: 'terms' },
]

export const CONTACT_ADDRESS = 'info@balkanskatrkackaliga.net'

/* Screens that have an address but no navigation entry: reached from a button,
 * a link inside a page, or the login symbol. */
const UNLISTED_ROUTES: RouteDef[] = [
  /* The standing of the teams, reached from the third card of the tables since 16.11.2026. Its name
     is still „Timovi", which is what the portal says aloud when the screen opens and what the card
     is called; the heading on the screen is „BTL tabele" (owner, 16.11.2026, answer 9). */
  { path: TEAMS_ADDRESS, labelKey: 'nav.teams', seoKey: 'teams' },
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
  { path: 'administracija/sponzori', labelKey: 'admin.sponsors', seoKey: 'adminSponsors' },
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
  /* The same form for somebody with no number. Words of its own, because no two addresses share a name. */
  { path: UNNUMBERED_DATA_ADDRESS, seoKey: 'unnumberedMemberData' },
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
