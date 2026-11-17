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
 * THE THREE CARDS OF THE TABLES, beside the heading: Timovi, Muškarci and Žene, in that order (owner,
 * 17.11.2026: „Zelim da se zameni redosled dugmica na BTL tabele tako da uvek idu Predlozi tim (ako
 * postoji), pa Timovi (default), pa Muskarci, pa Zene, pa drop down godine.”). Until that day they went
 * Muškarci, Žene, Timovi (16.11.2026).
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
export function TableCards({ current }: { current: TableCard }) {
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
    ['teams', address(TEAMS_ADDRESS, toTeams), t('teams.title')],
    ['men', address(TABLE_ADDRESS, toTables), t('rankings.men')],
    ['women', address(TABLE_ADDRESS, toTables, 'z'), t('rankings.women')],
  ]

  return (
    <div className="rankings__tabs" role="group" aria-label={t('rankings.title')}>
      {cards.map(([card, to, label]) => (
        <Link key={card} to={to} aria-current={card === current ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </div>
  )
}

/**
 * WHAT STANDS IN THE ROW OF THE HEADING OF THE TABLES, after the heading: „Prijavi tim” where the teams
 * offer it, the three cards, and the season (owner, 17.11.2026). Drawn inside the screen's own row of
 * controls beside its heading, the row every screen with a control shares (`Rankings.css`); this is only
 * what goes in it, so that the men, the women and the teams cannot draw it in two orders.
 *
 * **„Prijavi tim”, and only on the teams** (owner, 17.11.2026, answer 1: „Samo na timovima i treba da se
 * zove dugme zapravo Prijavi tim”). The screen it leads to is still „Predlog tima” on `/novi-tim` (PDL,
 * 01.09.2026 and 03.10.2026, which name the screen): only the button is renamed.
 *
 * **On the men and the women an invisible place of the same width stands where it stands** (answer 3,
 * chosen with my recommendation, from ADL A7: „navigacija se ne sme pomerati tokom klikova, boksovi i
 * naslovi moraju da se gađaju u piksel”). **Its width is the button's because it is the button's words
 * in the button's class**: the same text in `button button--secondary`, so the browser measures it the
 * way it measures the button, in either language and at any size of text, with no number written here
 * and no script measuring anything. **It is hidden with `visibility`, and that is the whole rule**
 * (`.rankings__held`, as `.shell__guest--waiting` hides the links of a visitor while the server has not
 * answered): the box keeps its width, and a box that is not visible is not drawn, takes no press and is
 * not in the reader's tree. `aria-hidden` and `inert` say the same to whoever does not read the sheet.
 * A `span` and not a link, so it has no address to follow and nothing in it to focus.
 *
 * **Only for the reader the teams offer the button** (`offered`, which is `whatTheTeamsOffer`): to
 * anybody else the teams offer no button, so there is nothing for the place to hold, and the cards stand
 * on the same pixel without it.
 *
 * **On a telephone the season comes first, then the button and the cards** (owner, 17.11.2026: „u
 * gornjem redu naslov BTL tabele levo i dropdown sezone desno, a u jednom redu ispod Predlozi tim ako
 * postoji, Timovi (default), Muskarci, Zene”), and the document says it in that order, so the keyboard
 * goes the way the eye does (WCAG 2.2 SC 2.4.3). Asked of `usePhoneHeader`, the width at which the header
 * takes the shape of a telephone, and the stylesheet asks for the shape by the class
 * (`rankings__cards--phone`), never by a width of its own, as the header does.
 */
export function TablesHead({
  current,
  offered,
  seasonPicker,
}: {
  current: TableCard
  /** Whether the teams offer this reader the button: `whatTheTeamsOffer(...) === 'button'`. */
  offered: boolean
  /** The season control of the screen, which each screen works out for itself. */
  seasonPicker: ReactNode
}) {
  const { locale, t } = useI18n()
  const phone = usePhoneHeader()
  let held: ReactNode = null

  /* The key written in each of the two, and not held in a variable: the sweep of the buttons of the
     portal reads the word of a button off the button itself (`components/actionSymbols.test.ts`). */
  if (offered) {
    held =
      current === 'teams' ? (
        <Link className="button button--secondary" to={`/${locale}/novi-tim`}>
          {t('teams.registerTeam')}
        </Link>
      ) : (
        <span className="button button--secondary rankings__held" aria-hidden="true" inert>
          {t('teams.registerTeam')}
        </span>
      )
  }

  const cards = (
    <div className={phone ? 'rankings__cards rankings__cards--phone' : 'rankings__cards'}>
      {held}
      <TableCards current={current} />
    </div>
  )

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
