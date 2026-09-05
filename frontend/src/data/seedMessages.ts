import type { Message } from '../session/context'
import { priceOn, REGISTRATION_OPENS } from './pricing'

/**
 * What the first message says the fee is, and when it starts, read off the price list
 * rather than written out.
 *
 * ADL A12 says an amount is never a number written into code, and the price list
 * exists so that „the screen that sets prices and the page that publishes them" cannot
 * say different things. This message publishes both, so it reads both: the fee of the
 * first period and the day registration opens. Written out, the two moved in
 * `pricing.ts` and the inbox went on announcing the old one, with the whole gate green
 * (review, 05.09.2026).
 *
 * **The day is written out, and that is on purpose.** Serbian writes a day inside a
 * sentence in the genitive — „kreće 1. oktobra" — and the portal has no formatter that
 * produces one: `formatDate` answers „1. oktobar 2026.", which is the nominative and is
 * ungrammatical here. Read off the price list, this sentence said exactly that for the
 * length of one commit (review, 05.09.2026). The portal writes the same day by hand in a
 * dozen sentences of its own (`membership.notYetSold` among them), so this one does too,
 * and what holds it to the price list is a case in the guard: the day the price list
 * opens on is still the first of October, and the moment it is not, that case fails and
 * whoever moved it rewrites the sentence.
 */
/* Asked as „what does it cost on the day it opens", which is the question the
   sentence answers and the one `priceOn` is written for. Looked up in the list by
   name it would need an „or nothing" for a row that is always there, and that is a
   branch no case can reach. */
const FEE = priceOn(REGISTRATION_OPENS).eur

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
    body: `Portal je otvoren za razgledanje. Kalendar se puni, a učlanjenje kreće 1. oktobra po ceni od ${FEE} EUR.`,
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
