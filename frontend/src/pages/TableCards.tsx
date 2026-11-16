import { Link } from 'react-router'
import { TABLE_ADDRESS, TEAMS_ADDRESS } from '../app/routes'
import { useI18n } from '../i18n/useI18n'

/** Which of the three tables is being read. */
export type TableCard = 'men' | 'women' | 'teams'

/**
 * THE THREE CARDS OF THE TABLES, beside the heading: Muškarci, Žene and Timovi, in that order, and the
 * season after them (owner, 16.11.2026: „Timovi prelazi BTL tabele kao treća ravnopravna opcija koja se
 * otvara klikom na Timovi (nakon dugmeta Žene, a pre izbora godine iz dropdown)”).
 *
 * **Links, each to the address of its card**, and not buttons that write the address (owner, 16.11.2026,
 * answer 8, chosen with my recommendation: Muškarci on `/tabela`, Žene on `/tabela?pol=z`, Timovi on
 * `/timovi`, which keeps its own address). **None of them carries the season**, so every card opens on
 * the running one (owner, answer 10, his own words: „Default svakako treba da bude trenutna sezona, a
 * clan na timovima moze odabrati narednu ako pozeli”), and a season chosen on one card is not taken to
 * another.
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
  const cards: [TableCard, string, string][] = [
    ['men', `/${locale}/${TABLE_ADDRESS}`, t('rankings.men')],
    ['women', `/${locale}/${TABLE_ADDRESS}?pol=z`, t('rankings.women')],
    ['teams', `/${locale}/${TEAMS_ADDRESS}`, t('teams.title')],
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
