import { Link, useSearchParams } from 'react-router'
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
 * otvara klikom na Timovi (nakon dugmeta Žene, a pre izbora godine iz dropdown)”).
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
  const [params] = useSearchParams()
  const asked = params.get('sezona')
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
    <div className="rankings__tabs" role="group" aria-label={t('rankings.title')}>
      {cards.map(([card, to, label]) => (
        <Link key={card} to={to} aria-current={card === current ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </div>
  )
}
