import type { Role } from '../roles/context'
import { inLeague } from './leagueSeasons'

/* Every address the portal answers outside administration, written once and read by two cases.
 *
 * It lived inside `pages/publicData.test.tsx` until 07.09.2026, when a second sweep needed the
 * same list: the walk that hides a member and asks every screen whether it still leads to their
 * profile (`pages/profilePrivacy.test.tsx`). Two copies of this table would be two answers to
 * „what addresses does the portal have", and the one below already carries a floor against the
 * route table, which a copy would not.
 *
 * `src/test/` is outside the coverage sweep and outside `sources()`, which is where a table read
 * by cases belongs.
 */

/**
 * The day the table is read on.
 *
 * Inside the season the generated calendar lives in: what a screen draws can depend on the day,
 * and one of the addresses below still changes with it — a profile, whose owner has to be a
 * member on the day it is read. The registration screen used to be a second one, before its own
 * ban on a date came off (PDL, „Zabrana registracije pre 01.10.2026 se SKIDA", owner 27.09.2026);
 * this is no longer pinned before that date for its sake, only for the profile's.
 *
 * Beside the table since 07.09.2026, because two sweeps read it: the one that watches what a
 * browser downloads, and the one that hides a member and asks every address whether it still leads
 * to their profile. Written out in both, the day would part from the table the moment somebody
 * moved one of them.
 */
export const DAY = '2026-08-07'

/**
 * Every address outside administration, with the heading each one is supposed
 * to draw.
 *
 * Held against the route table below rather than trusted as written: a list
 * typed out by hand stops being every address the moment somebody adds a
 * screen, and this one had already missed eight when it was first written.
 *
 * The heading is here because without it the sweep swept whatever it happened
 * to land on. A slug that stops matching the generated data does not fail: the
 * portal answers an address it does not have by going to the front page, which
 * has a heading like everything else, and the sweep went on passing while the
 * screen it names was never drawn. Three of these are records looked up by a
 * hand-written slug, and those are exactly the ones that would rot quietly.
 *
 * Two headings, because half of these screens say something different once
 * somebody has signed in, and both readings have to be swept: a leak below a
 * sign-in guard is invisible to a visitor and is still a leak.
 *
 * Four of these are one part of a screen whose other part carries the same
 * heading, so the heading alone cannot tell them apart: swapping the awards for
 * the overview left the sweep green. Those four name the part they are, which
 * the screen marks as the one being read.
 */
export const PUBLIC: [address: string, asVisitor: string, asMember: string, part?: string][] = [
  ['/sr', 'Balkanska trkačka liga', 'Balkanska trkačka liga'],
  ['/sr/kalendar', 'Kalendar', 'Kalendar'],
  ['/sr/kalendar/dan/2027-05-08', 'Trke, 8. maj 2027.', 'Trke, 8. maj 2027.'],
  [
    '/sr/kalendar/fruskogorski-maraton-2010',
    'Fruškogorski maraton',
    'Fruškogorski maraton',
  ],
  [
    '/sr/kalendar/fruskogorski-maraton-2010/ocena',
    'Za ovo treba prijava',
    'Fruškogorski maraton',
  ],
  [
    /* With the race in it, which is the only address this form answers since
       23.08.2026: it is written by the button in the row of the race, and one
       typed without it says where the way in is instead of drawing a form. The
       id is written out because this list is read before anything is rendered;
       it is the one race of that event. */
    '/sr/kalendar/fruskogorski-maraton-2010/prijava?trka=396',
    'Za ovo treba prijava',
    'Prijava rezultata',
  ],
  /* The league's own entry of results (PDL P9, 18.10.2026), which only the right that checks
     results opens: a visitor and a member are both sent to the front page, as from every other
     screen they may not open. Drawn for the superadmin in `BEHIND`. */
  [
    '/sr/kalendar/fruskogorski-maraton-2010/rezultati?trka=396',
    'Balkanska trkačka liga',
    'Balkanska trkačka liga',
  ],
  ['/sr/takmicari', 'Takmičari', 'Takmičari'],
  ['/sr/takmicar/000001', 'Vladan Đurišić', 'Vladan Đurišić', 'Svojim rečima'],
  /* Nought since 17.10.2026: every place he took is in the imported history, and no season before
     2027 is a trophy (PDL P27). The count is still the sign that the part has been worked out. */
  ['/sr/takmicar/000001/priznanja', 'Vladan Đurišić', 'Vladan Đurišić', 'Pehari 0'],
  /* THE CARD „PODACI" (PDL 22.10.2026), which only the member himself and the administration open: a
     visitor is sent to the front page, as from every profile he may not read, and the member these walks
     sign in as (000021) is drawn HIS OWN card, under the head of his profile. No part is named, because a
     part is asked of both readers and the visitor is drawn the front page; the panel itself is read by
     `profile/competitorData.test.tsx`. */
  ['/sr/takmicar/000021/podaci', 'Balkanska trkačka liga', 'Ksenija Vasiljević'],
  ['/sr/timovi', 'Timovi', 'Timovi'],
  ['/sr/tim/dunavski-trkaci', 'Dunavski trkači', 'Dunavski trkači'],
  /* The front page, to a member, and that is the screen this address answers with
     for them: `ME` has a team and `DAY` is outside the transfer window, and either
     one alone sends them to the front (PDL, increment 133, 05.09.2026) — sent away,
     not told why, which is the owner's own words. A visitor still meets the sign-in,
     because that is asked before anything else.

     **The form's own heading is held elsewhere**, by `member/headingFirst.test.tsx`,
     which signs in as a member with no team on a day inside the window; measured
     05.09.2026 by moving `titleKey` in the definition, which fails there and not
     here. What this row is worth is the other half of this file's question: even the
     redirect must not ask the server for anything a member may not have. */
  ['/sr/novi-tim', 'Za ovo treba prijava', 'Balkanska trkačka liga'],
  /* And the same rule on the way into a team's own data: `ME` does not administer
     Dunav, so the address is not a page for them either and answers with the front.
     The form's own heading is read by `member/editTeam.test.tsx`, which signs in as
     the member who does administer it. */
  ['/sr/tim/dunavski-trkaci/izmena', 'Za ovo treba prijava', 'Balkanska trkačka liga'],
  ['/sr/tabela', 'BTL tabele', 'BTL tabele'],
  ['/sr/top-liste', 'Top liste', 'Top liste'],
  ['/sr/lige', 'Lige', 'Lige'],
  /* One address since 07.09.2026, and no part to name. It was two, and the second
     (`/liga/:slug/rezultati`) named the same page as the first once the owner took the terms,
     the prizes and the events off this screen; two addresses for one page is what the portal
     refuses everywhere else (P11), so it is gone rather than kept as an alias. Asked again on
     12.09.2026, answered the same way on the 13th, and still one address. */
  ['/sr/liga/runtrace-2027', 'RunTrace liga 2027', 'RunTrace liga 2027'],
  ['/sr/pravilnik', 'Opšti pravilnik Balkanske trkačke lige za sezonu 2027', 'Opšti pravilnik Balkanske trkačke lige za sezonu 2027'],
  ['/sr/politika-privatnosti', 'Politika privatnosti', 'Politika privatnosti'],
  ['/sr/uslovi-koriscenja', 'Uslovi korišćenja', 'Uslovi korišćenja'],
  /* The heading here no longer turns over on 15 October: the ban that used to close this
     screen before that date is gone (PDL, „Zabrana registracije pre 01.10.2026 se SKIDA",
     owner 27.09.2026), and the form is what both a visitor and a member meet on any day.
     `DAY` still holds this table to one day, for the profile row below rather than this one. */
  ['/sr/registracija', 'Registracija', 'Registracija'],
  ['/sr/prijava', 'Prijava', 'Prijava'],
  /* Where a forgotten password is asked about. No token on the address, unlike the two
     below: nothing is ever posted that points here, so it is reached by typing or by the
     link on the sign-in page. It asks the server nothing until the button is pressed,
     which is the same shape the two rows above have, and its heading does not move with
     any answer. */
  ['/sr/zaboravljena-lozinka', 'Zaboravljena lozinka', 'Zaboravljena lozinka'],
  /* The two screens a link out of a message lands on, read WITH a token on the address,
     because that is the only state in which they speak to the server at all: opened
     without one they draw a sentence and ask for nothing, which is a row that would
     sweep an empty room. The token is any string; what these rows are worth is that
     whatever these screens fetch, it is not somebody else's.

     Their heading does not move with what the server answered, and that is on purpose
     rather than convenient: under this sweep there is no server, every request is a 404
     off the disc reader in `test/setup.ts`, and a screen whose name changed with the
     answer would make this row a reading of one failure. What the answer changes is the
     sentence under the heading, which `pages/account` reads case by case. */
  ['/sr/nova-lozinka?token=nesto', 'Nova lozinka', 'Nova lozinka'],
  ['/sr/potvrda-adrese?token=nesto', 'Potvrda adrese', 'Potvrda adrese'],
  ['/sr/moj-profil', 'Za ovo treba prijava', 'Ksenija Vasiljević'],
  /* „Moji podaci" (PDL 22.10.2026) is HIS WHO HAS NOT PAID, and the member these walks sign in as pays:
     he is sent to the card „Podaci" of his own profile, where his data are, and is drawn his own head
     there. Drawn as itself to the one reader this walk does not sign in as, in
     `pages/member/myData.test.tsx`. */
  ['/sr/moji-podaci', 'Za ovo treba prijava', 'Ksenija Vasiljević'],
  ['/sr/moji-rezultati', 'Za ovo treba prijava', 'Moji rezultati'],
  ['/sr/moja-clanarina', 'Za ovo treba prijava', 'Moja članarina'],
  ['/sr/podesavanja', 'Za ovo treba prijava', 'Podešavanja'],
  ['/sr/poruke', 'Za ovo treba prijava', 'Poruke'],
  /* A message the SERVER kept, since 28.09.2026. It named `msg-1` until that day, one of the
     two records the bundle seeded into every session (`data/seedMessages.ts`); PDL 34 („NECU
     MOCK PODATKE NIGDE", owner) took them out, so the only message a sweep can open without
     writing one first is a row `GET /api/inbox` answers - here the harness's own
     `test/mock/inbox.json`, whose first row is `41`. The heading is that row's subject, which
     is what makes this line worth a row at all: read as „any heading", an address that fell
     through to the front page would pass. */
  ['/sr/poruke/41', 'Za ovo treba prijava', 'Fotografija je prihvaćena'],
  ['/sr/rezultat/novi', 'Za ovo treba prijava', 'Unos rezultata'],
]

/**
 * Administration and the two member forms the walk over `PUBLIC` cannot reach, each with who reads
 * it and the heading it is supposed to draw.
 *
 * It lived inside `pages/publicData.test.tsx` until 16.10.2026, where the reasons for every row are
 * still written, and moved here when a second sweep needed the same list: the one that hands every
 * screen of the portal to axe (`pages/accessibility.test.tsx`). Two copies would be two answers to
 * „what administration has", and only one of them would carry the floor against the route table.
 */
const ADMIN = '000001'

/** The day `BEHIND` is read on: inside the transfer window, so the two member forms are really
 *  drawn (a member with no team may propose one only inside it). Beside the table for the reason
 *  `DAY` is beside `PUBLIC`: two sweeps read it, and written out in both it would part from the
 *  table the moment somebody moved one of them. */
export const BEHIND_DAY = '2026-10-15'

export const BEHIND: [string, Role, string | null, string][] = [
  ['/sr/administracija', 'superadmin', ADMIN, 'Administracija'],
  ['/sr/administracija/entiteti', 'superadmin', ADMIN, 'Članovi'],
  ['/sr/administracija/verifikacija', 'superadmin', ADMIN, 'Red za proveru rezultata'],
  ['/sr/administracija/verifikacija/rezultati', 'superadmin', ADMIN, 'Red za proveru rezultata'],
  ['/sr/administracija/verifikacija/uplate', 'superadmin', ADMIN, 'Uplate i aktivacija članova'],
  ['/sr/administracija/verifikacija/timovi', 'superadmin', ADMIN, 'Novi timovi'],
  ['/sr/administracija/verifikacija/trkacki-profil', 'superadmin', ADMIN, 'Trkački profil'],
  ['/sr/administracija/verifikacija/komentari', 'superadmin', ADMIN, 'Komentari'],
  ['/sr/administracija/cenovnik', 'superadmin', ADMIN, 'Cenovnik'],
  ['/sr/administracija/clanovi', 'superadmin', ADMIN, 'Članovi'],
  ['/sr/administracija/dogadjaji', 'superadmin', ADMIN, 'Događaji'],
  ['/sr/administracija/timovi', 'superadmin', ADMIN, 'Timovi'],
  ['/sr/administracija/lige', 'superadmin', ADMIN, 'Lige'],
  ['/sr/administracija/strane', 'superadmin', ADMIN, 'Statične strane'],
  ['/sr/administracija/moderatori', 'superadmin', ADMIN, 'Moderatori'],
  /* The moderator's own screen, „Unos rezultata za događaj” (PDL P9, 19.10.2026). */
  ['/sr/administracija/unos-rezultata', 'superadmin', ADMIN, 'Unos rezultata za događaj'],
  /* A member with no team, inside the window, so the form is really drawn. */
  ['/sr/novi-tim', 'competitor', '000002', 'Predlog tima'],
  /* And the one who administers this team, likewise. */
  ['/sr/tim/dunavski-trkaci/izmena', 'competitor', '000001', 'Izmena tima'],
  /* The league's own entry of results on the one race of that event, as whoever checks results. */
  [
    '/sr/kalendar/fruskogorski-maraton-2010/rezultati?trka=396',
    'superadmin',
    ADMIN,
    'Unos rezultata: Fruškogorski maraton 2010. (57,7 km)',
  ],
]


/**
 * The three screens of `PUBLIC` that draw ROWS, read in a season that has some.
 *
 * **Why they are here and not only above.** Since 16.10.2026 the table and the top boards open on
 * the league's first season and offer nothing before it, and since 17.10.2026 a member's trophies
 * are the places he took in a season of the league (PDL P27). The history `test/mock` serves ends
 * in 2026, so read as it is served, on `DAY`, those three screens are drawn with no row in them:
 * a table says nobody has raced, the boards say the same, and the trophies are nought. Every walk
 * over `PUBLIC` still goes through all three and still passes, having read the heading and an
 * empty room. Measured 17.10.2026 on `DAY`, both roles: 0 cells on `/sr/tabela`, 0 on
 * `/sr/top-liste`, 0 on `/sr/takmicar/000001/priznanja`, and an `<img>` without `alt` put into the
 * cell of a row of each (`Rankings.tsx`, `TopBoards.tsx`, `CompetitorAwards.tsx`) passed
 * `pages/accessibility.test.tsx`, 87 of 87 (the review of PR 538 reports the same three fall on `main`).
 *
 * **What a walk reads these with.** The same history moved forward into league seasons
 * (`test/leagueSeasons.ts`, `playTheHistoryAsLeagueSeasons`), on `DAY`, with the season named in
 * the address where the screen takes one: `inLeague(2019)` is 2035 and has the same people and the
 * same figures 2019 had. Measured the same day: 153 cells on the table, 146 on the boards, 20 on
 * the trophies. The trophies need no season in the address, because they are read over every
 * season there is, and the history moved has five places in it.
 *
 * **They are the same addresses as three rows above and not three new screens**, so the floor
 * against the route table stays where it was and each walk that reads this table also asks that
 * the path of every row is one `PUBLIC` has. The heading is the same for a visitor and for a
 * member, and the part (where two parts share a heading) is named as `PUBLIC` names it.
 *
 * A walk that reads this table must serve the moved history, or the rows are empty again and it
 * says so: each of them asks for a cell before it asks for anything else.
 */
export const WITH_ROWS: [address: string, heading: string, part?: string][] = [
  [`/sr/tabela?sezona=${String(inLeague(2019))}`, 'BTL tabele'],
  [`/sr/top-liste?sezona=${String(inLeague(2019))}`, 'Top liste'],
  ['/sr/takmicar/000001/priznanja', 'Vladan Đurišić', 'Pehari 5'],
]
