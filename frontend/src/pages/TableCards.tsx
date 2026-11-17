import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { usePhoneHeader } from '../app/phoneHeader'
import { TABLE_ADDRESS, TEAMS_ADDRESS } from '../app/routes'
import { useToday } from '../clock/useClock'
import { nextSeasonOnOffer, seasonShown } from '../data/season'
import { useI18n } from '../i18n/useI18n'

/** Which of the three tables is being read. */
export type TableCard = 'men' | 'women' | 'teams'

/**
 * Whether the standing of the people can be read in a season named in an address: any season up to the
 * one shown as running, and the one that has not begun while it is on offer there (`nextSeasonOnOffer`,
 * in the transfer window). The teams offer the one that has not begun all year round (`transfersTakeEffect`),
 * the tables only in that window.
 */
function readOnTheTables(season: number, today: string): boolean {
  return season <= seasonShown(today) || season === nextSeasonOnOffer(today)
}

/**
 * THE THREE CARDS OF THE TABLES, beside the heading: Muškarci, Žene and Timovi, in that order, and the
 * season after them (owner, 16.11.2026: „Timovi prelazi BTL tabele kao treća ravnopravna opcija koja se
 * otvara klikom na Timovi (nakon dugmeta Žene, a pre izbora godine iz dropdown)”; and again 17.11.2026,
 * after a day of Timovi first: „Timovi dugme treba da bude na kraju, nakon Muskarci i Zene, a Muskarci
 * ponovo treba da postanu default.”).
 *
 * **Links, each to the address of its card**, and not buttons that write the address (owner, 16.11.2026,
 * answer 8, chosen with my recommendation: Muškarci on `/tabela`, Žene on `/tabela?pol=z`, Timovi on
 * `/timovi`, which keeps its own address).
 *
 * **THE SEASON BEING READ GOES WITH THE CARD, BUT A FUTURE SEASON OF THE TEAMS DOES NOT** (owner,
 * 16.11.2026, his own words: „Moze svuda da se cuva sezona, osim kad se iz buduce sezone timova prelazi na
 * M ili Z, onda se prebacuje na aktuelnu.”). Carried as the season of the address, which is what the
 * season control writes, and only that: the age category is not carried, because the bands of one gender
 * are not the bands of the other. From the teams to the men or the women the season is left behind when
 * the tables do not offer it, so the card opens on the running one; while the tables offer the season that
 * has not begun too (in the transfer window) it is carried, because then the other card offers it as well
 * (derived, PDL „Pravilnik prelazi u podnožje”). A season the address does not name is the running one on
 * every card, so nothing is carried for it.
 *
 * **Not `components/GenderTabs`**, which the standing of a single league shares and where the owner asked
 * for the men and the women only (07.09.2026). A third card there would be a card of a screen that is not
 * there.
 *
 * The card being read is marked `aria-current="page"`, which is what a reader is told and what the
 * stylesheet paints. It is told by the screen that draws the row, not by the address, so a screen drawn
 * on the wrong address marks the card it really is.
 */
export function TableCards({ current, phone = false }: { current: TableCard; phone?: boolean }) {
  const { locale, t } = useI18n()
  const today = useToday()
  /* Read off the location and not through `useSearchParams`: these cards write nothing into the address,
     and a hook that can write a filter goes through `app/useFilterParams.ts` (`app/filterParams.test.ts`). */
  const asked = new URLSearchParams(useLocation().search).get('sezona')
  const toTeams = asked
  const toTables = asked !== null && (current !== 'teams' || readOnTheTables(Number(asked), today)) ? asked : null
  const address = (path: string, season: string | null, gender?: string) => {
    const query = new URLSearchParams()

    if (gender !== undefined) {
      query.set('pol', gender)
    }

    if (season !== null) {
      query.set('sezona', season)
    }

    const said = query.toString()

    return `/${locale}/${path}${said === '' ? '' : `?${said}`}`
  }
  const cards: [TableCard, string, string][] = [
    ['men', address(TABLE_ADDRESS, toTables), t('rankings.men')],
    ['women', address(TABLE_ADDRESS, toTables, 'z'), t('rankings.women')],
    ['teams', address(TEAMS_ADDRESS, toTeams), t('teams.title')],
  ]

  return (
    <div className={phone ? 'rankings__tabs rankings__tabs--phone' : 'rankings__tabs'} role="group" aria-label={t('rankings.title')}>
      {cards.map(([card, to, label]) => (
        <Link key={card} to={to} aria-current={card === current ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </div>
  )
}

/**
 * WHAT STANDS IN THE ROW OF THE HEADING OF THE TABLES, after the heading: the three cards and the season.
 * Drawn inside the screen's own row of controls beside its heading, the row every screen with a control
 * shares (`Rankings.css`); this is only what goes in it, so that the men, the women and the teams cannot
 * draw it in two orders. Nothing else stands in it, so the cards stand on the same pixel on all three
 * (ADL A7): „Prijavi tim” is under the table of the teams (owner, 17.11.2026, `pages/Teams.tsx`).
 *
 * **On a telephone the season comes first, then the cards** (owner, 17.11.2026: „u gornjem redu naslov BTL
 * tabele levo i dropdown sezone desno, a u jednom redu ispod [...] Muskarci, Zene”), and the document says
 * it in that order, so the keyboard goes the way the eye does (WCAG 2.2 SC 2.4.3). Asked of
 * `usePhoneHeader`, the width at which the header takes the shape of a telephone, and the stylesheet asks
 * for the shape by the class (`rankings__tabs--phone`), never by a width of its own, as the header does.
 */
export function TablesHead({
  current,
  seasonPicker,
}: {
  current: TableCard
  /** The season control of the screen, which each screen works out for itself. */
  seasonPicker: ReactNode
}) {
  const phone = usePhoneHeader()
  const cards = <TableCards current={current} phone={phone} />

  return phone ? (
    <>
      {seasonPicker}
      {cards}
    </>
  ) : (
    <>
      {cards}
      {seasonPicker}
    </>
  )
}
