import { TABLE_ADDRESS, TEAMS_ADDRESS, TOP_BOARDS_ADDRESS } from './routes'

/* What the gold strip under the header is held to (`app/NoticeBar.tsx`), in a module of its own so that the
 * file that draws it exports a component and nothing else, and the editor can refresh it in place. */

/** The one key the strip keeps in the browser's local store (owner, 21.11.2026: „Zatvaranje krstićem pregledač
 *  pamti do 1.1.2027"). The privacy policy has to name it, and `pages/writtenPages.test.tsx` holds the stores
 *  the code writes against the stores the policy names. */
export const NOTICE_STORAGE_KEY = 'btl-notice-closed'

/** The addresses the strip stands on, as the part of the path after the language (`canonicalPath`): the front
 *  page, the Top lists and the three cards of the BTL tables, which are Muškarci and Žene at the table's address
 *  and Timovi at its own (owner, 21.11.2026, answer 1, and „„BTL tabela” znači sve tri kartice”, the same day:
 *  the strip's height must not move the cards when one of them is pressed, ADL A7). */
export const NOTICE_SHOWN_ON: readonly string[] = ['', TOP_BOARDS_ADDRESS, TABLE_ADDRESS, TEAMS_ADDRESS]
