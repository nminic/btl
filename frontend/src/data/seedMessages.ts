import type { Message } from '../session/context'

/**
 * Two messages the inbox starts with, so it is not judged empty.
 *
 * **Records, not the portal's own words.** They are the kind of thing the portal
 * really sends — one about a result, one about the season — but they stand in for
 * rows a database will hold, exactly as `public/mock/*.json` does for everything
 * else. That is why they live here and not in the dictionary: nothing draws them
 * from a key, and the screen that shows them shows whatever the record says.
 *
 * They were written into `session/SessionProvider.tsx` until 05.09.2026. A component
 * carrying Serbian prose is the one thing `styles/writtenInCode.test.ts` refuses, and
 * the reason is worth keeping apart from these two: a sentence written into a screen
 * cannot be corrected by whoever the words belong to, while a seeded record is data
 * somebody will replace with a row.
 *
 * Both are the league talking to everybody, which is what an empty `to` means.
 */
export const FIRST_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    from: 'Balkanska trkačka liga',
    to: '',
    subject: 'Dobro došao u pripremu sezone 2027',
    body: 'Portal je otvoren za razgledanje. Kalendar se puni, a učlanjenje kreće 1. oktobra po ceni od 35 EUR.',
    date: '2026-07-20',
    read: false,
  },
  {
    id: 'msg-2',
    from: 'Balkanska trkačka liga',
    to: '',
    subject: 'Rezultat je odobren',
    body: 'Tvoj rezultat sa Jadovničkog ultramaratona je proveren i ušao je u rang listu.',
    date: '2026-07-12',
    read: true,
  },
]
