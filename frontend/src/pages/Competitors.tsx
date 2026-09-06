import { ProfileLink } from './profile/ProfileLink'
import { categoryLabel } from '../data/categories'
import { useMemo } from 'react'
import { monogramFor } from '../app/monogram'
import { Resource } from '../components/Resource'
import { hueFor } from './competitorFace'
import { activeOnly, categoryOfMember, EMPTY_TOTALS, totalsByMember } from '../data/derive'
import { SEASON } from '../data/pricing'
import type { Competitor, Result } from '../data/types'
import { combinePair, useCompetitors, useResults } from '../data/useResource'
import { MEMBERS, recordsOf } from './admin/entityForms'
import { useOverlay } from './admin/overlay'
import { formatNumber, formatPoints } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'
import './Competitors.css'
import { useFilterParams } from '../app/useFilterParams'

/* Cards, not a table (PDL P28a). The league is about people, and a row in a
 * table does not show a person. The picture is the point of the card, so the
 * layout is built around it; until the database holds real pictures, the
 * initials stand in the same space a photograph will take. */
function CompetitorCards({
  competitors,
  results,
  search,
  onSearch,
}: {
  competitors: Competitor[]
  results: Result[]
  search: string
  onSearch: (value: string) => void
}) {
  const { locale, t } = useI18n()
  const totals = useMemo(() => totalsByMember(results), [results])

  const cards = useMemo(() => {
    const needle = search.trim().toLowerCase()

    /* Members, not everybody who ever was one: a card leads to a profile, and an
       inactive member has none (PDL P11). It put the newest inactive member on
       this list and on the front page, both linking to "Ovog profila nema." */
    return activeOnly(competitors)
      .filter((competitor) =>
        `${competitor.firstName} ${competitor.lastName} ${competitor.memberNumber} ${competitor.city}`
          .toLowerCase()
          .includes(needle),
      )
      .map((competitor) => ({
        competitor,
        totals: totals.get(competitor.memberNumber) ?? EMPTY_TOTALS,
      }))
  }, [competitors, totals, search])

  return (
    <>
      <div className="rankings__head-tool">
        <label className="rankings__field rankings__field--wide">
          <span>{t('competitors.search')}</span>
          <input
            type="search"
            value={search}
            placeholder={t('competitors.searchPlaceholder')}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
      </div>

      {cards.length === 0 ? (
        <p className="rankings__empty">{t('competitors.empty')}</p>
      ) : (
        <ul className="cards">
          {cards.map(({ competitor, totals: own }) => (
            <li key={competitor.memberNumber} className="cards__item">
              <ProfileLink competitor={competitor} className="card">
                <span
                  className="card__face"
                  style={{ '--face-hue': hueFor(competitor.memberNumber) }}
                  aria-hidden="true"
                >
                  {monogramFor(competitor, competitor.memberNumber)}
                </span>

                <span className="card__name">
                  {competitor.firstName} {competitor.lastName}
                </span>
                <span className="card__number">{competitor.memberNumber}</span>

                <span className="card__meta">
                  <span className="card__chip">{categoryLabel(categoryOfMember(competitor, SEASON), t)}</span>
                  <span className="card__city">{competitor.city}</span>
                </span>

                {/* The word above the number, never after it. Serbian declines
                    the noun by the number in front of it (1 trka, 3 trke, 5 trka),
                    so a label glued to the end of a figure is wrong for most
                    values. Above it, the label is a heading and stays in the
                    nominative (owner, 30.07.2026). */}
                <span className="card__figures">
                  <span className="card__figure">
                    <span className="card__label">{t('competitors.columns.races')}</span>
                    <span className="card__value">{formatNumber(own.races, locale)}</span>
                  </span>
                  <span className="card__figure">
                    <span className="card__label">{t('competitors.columns.points')}</span>
                    <span className="card__value">{formatPoints(own.points, locale)}</span>
                  </span>
                </span>
              </ProfileLink>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function Competitors() {
  const { t } = useI18n()
  const [params, setParams] = useFilterParams()
  const search = params.get('trazi') ?? ''
  /* Only what the cards show. Waiting on the teams as well meant the whole page
   * turned into an error message if that one file failed, over data no card on
   * it has ever read. */
  const state = combinePair(useCompetitors(), useResults())
  /* Through the overlay, like the profile page and the message that carries an invitation: a
     member who ticked „sakrij moj profil" a moment ago lives there and nowhere else, so read off
     the file this list would go on offering the way in that the profile itself refuses. */
  const overlay = useOverlay()

  return (
    <div className="rankings rankings--tooled">
      <h1>{t('competitors.title')}</h1>

      <Resource state={state}>
        {([everybody, results]) => (
          <CompetitorCards
            competitors={recordsOf(MEMBERS, everybody, overlay)}
            results={results}
            search={search}
            onSearch={(value) => setParams(value === '' ? {} : { trazi: value })}
          />
        )}
      </Resource>
    </div>
  )
}
