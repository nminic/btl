/**
 * Where the case for each screen that confirms a sending lives, and what it walks.
 *
 * **Why this is its own module.** It used to sit inside `pages/backAfterSending.test.tsx`,
 * which is the file five of its six values name. Asked whether that file mentions the
 * address, the answer was yes even with every case deleted, because the row of this very
 * map says it: the guard was satisfied by its own subject and measured nothing (review,
 * 06.09.2026). Moved out, the file being read can no longer contain the claim about itself.
 *
 * The keys have a floor of their own in that test: they are exactly the modules that import
 * `useSend` from `pages/sent.ts`, read off the sources, so a sixth screen that starts
 * confirming a sending cannot be left out of this map.
 */
export const BACK_CASES: Record<string, [file: string, address: string]> = {
  'pages/event/RateEvent.tsx': ['pages/backAfterSending.test.tsx', '/ocena'],
  'pages/event/ReportResult.tsx': ['pages/backAfterSending.test.tsx', '/prijava?trka='],
  'pages/member/EditTeam.tsx': [
    'pages/backAfterSending.test.tsx',
    '/sr/tim/dunavski-trkaci/izmena',
  ],
  'pages/member/NewResult.tsx': ['pages/backAfterSending.test.tsx', '/sr/rezultat/novi'],
  'pages/member/ProposeTeam.tsx': ['pages/backAfterSending.test.tsx', '/sr/novi-tim'],
  /* Its own file, because filling this form takes forty lines that already live there. */
  'pages/Registration.tsx': ['pages/Registration.test.tsx', '/sr/registracija'],
}
