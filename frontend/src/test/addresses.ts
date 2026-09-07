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
    '/sr/kalendar/fruskogorski-maraton-2010/prijava?trka=evt-fruskogorski-maraton-2010-05-08-5768',
    'Za ovo treba prijava',
    'Prijava rezultata',
  ],
  ['/sr/takmicari', 'Takmičari', 'Takmičari'],
  ['/sr/takmicar/000001', 'Vladan Đurišić', 'Vladan Đurišić', 'Svojim rečima'],
  ['/sr/takmicar/000001/priznanja', 'Vladan Đurišić', 'Vladan Đurišić', 'Pehari 5'],
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
  [
    '/sr/liga/runtrace-2027',
    'RunTrace liga 2027',
    'RunTrace liga 2027',
    'Propozicije',
  ],
  /* The results carry no heading of their own, so the part is named by what
     the other part has and this one must not: a table of standings instead of
     the terms of the competition. */
  [
    '/sr/liga/runtrace-2027/rezultati',
    'RunTrace liga 2027',
    'RunTrace liga 2027',
    '',
  ],
  ['/sr/pravilnik', 'Opšti pravilnik Balkanske trkačke lige za sezonu 2027', 'Opšti pravilnik Balkanske trkačke lige za sezonu 2027'],
  ['/sr/politika-privatnosti', 'Politika privatnosti', 'Politika privatnosti'],
  ['/sr/uslovi-koriscenja', 'Uslovi korišćenja', 'Uslovi korišćenja'],
  /* Read on a fixed day, because this heading changes on 01.10.2026 when
     registration opens (pricing.ts). A row that turns over on a date is a row
     that breaks the build on a date. */
  [
    '/sr/registracija',
    'Registracija još nije otvorena',
    'Registracija još nije otvorena',
  ],
  ['/sr/prijava', 'Prijava', 'Prijava'],
  ['/sr/moj-profil', 'Za ovo treba prijava', 'Ksenija Vasiljević'],
  ['/sr/moji-rezultati', 'Za ovo treba prijava', 'Moji rezultati'],
  ['/sr/moja-clanarina', 'Za ovo treba prijava', 'Moja članarina'],
  ['/sr/podesavanja', 'Za ovo treba prijava', 'Podešavanja'],
  ['/sr/poruke', 'Za ovo treba prijava', 'Poruke'],
  ['/sr/poruke/msg-1', 'Za ovo treba prijava', 'Dobro došao u pripremu sezone 2027'],
  ['/sr/rezultat/novi', 'Za ovo treba prijava', 'Unos rezultata'],
]
