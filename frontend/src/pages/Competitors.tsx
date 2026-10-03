import { ProfileLink } from './profile/ProfileLink'
import { categoryLabel } from '../data/categories'
import { useMemo } from 'react'
import { Portrait } from '../components/Portrait'
import { Resource } from '../components/Resource'
import { categoryOfMember } from '../data/derive'
import type { Competitor } from '../data/types'
import { useCompetitors } from '../data/useResource'
import { MEMBERS, recordsOf } from './admin/entityForms'
import { useOverlay } from './admin/overlay'
import { useI18n } from '../i18n/useI18n'
import './Rankings.css'
import './Competitors.css'
import { useFilterParams } from '../app/useFilterParams'

/* Cards, not a table (PDL P28a). The league is about people, and a row in a
 * table does not show a person. The picture is the point of the card, so the
 * layout is built around it, and since 26.09.2026 it really is a picture for
 * every member who has sent one and had it approved (PDL P28f). The initials
 * stand in the same space for everybody else, which is most of the league and
 * is not a state waiting to end.
 *
 * **A card ends at the town since 03.10.2026.** What stood under it, the count of
 * races and the points, went with the data that fed it. Owner: „Na strani
 * Takmičari, na pločici takmičara ceo donji deo nije potreban da se vidi. Dakle
 * bez Trke i bodova, visina pločice treba da bude kraća, više nalik kvadratu."
 * It went from every card and not from some of them, since all of them are the
 * same card (PDL P28, 31.07.2026), and the stylesheet says what the height is
 * now (`Competitors.css`). */
function CompetitorCards({
  competitors,
  search,
  onSearch,
}: {
  competitors: Competitor[]
  search: string
  onSearch: (value: string) => void
}) {
  const { t } = useI18n()

  const cards = useMemo(() => {
    const needle = search.trim().toLowerCase()

    /* Members, not everybody who ever was one: a card leads to a profile, and an
       inactive member has none (PDL P11). It put the newest inactive member on
       this list and on the front page, both linking to "Ovog profila nema."

       **`activeOnly` stood here until 21.09.2026 and is gone rather than moved.**
       It filtered on `competitor.active`, and the switch to `/api` left it an
       identity: a member whose fee has lapsed is not in this list to be filtered
       out of (owner, 13.09.2026). A function that answers everything it is asked
       is a sentence dressed as a guard, so the sentence is written here. */
    return competitors.filter((competitor) =>
      `${competitor.firstName} ${competitor.lastName} ${competitor.memberNumber} ${competitor.city}`
        .toLowerCase()
        .includes(needle),
    )
  }, [competitors, search])

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
          {cards.map((competitor) => (
            <li key={competitor.memberNumber} className="cards__item">
              <ProfileLink competitor={competitor} className="card">
                {/* The same circle every other screen draws, since 27.09.2026. This card kept
                    its own until then - `card__face`, with its own monogram and its own copy
                    of the colour recipe - and it is the reason a photograph would not have
                    arrived here: PDL P28f of 26.09.2026 required that an approved picture „tog
                    trenutka pocinje da se vidi na svim avatar mestima", and a sweep for the
                    shared class name could not see this one, because it did not wear it.

                    The size is the card's and stays the card's, said in the stylesheet with
                    the widget in the selector, which is how `Portrait.css` asks to be
                    resized. */}
                <Portrait competitor={competitor} />

                <span className="card__name">
                  {competitor.firstName} {competitor.lastName}
                </span>
                <span className="card__number">{competitor.memberNumber}</span>

                <span className="card__meta">
                  <span className="card__chip">{categoryLabel(categoryOfMember(competitor), t)}</span>
                  <span className="card__city">{competitor.city}</span>
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
  /* Only what the cards show, which is the members. Waiting on the teams as well
   * meant the whole page turned into an error message if that one file failed,
   * over data no card on it has ever read, and the results went the same way on
   * 03.10.2026: the count of races and the points were the one thing this page
   * read them for (`pages/resourceScope.test.tsx` holds both). */
  const state = useCompetitors()
  /* Through the overlay, like the profile page and the message that carries an invitation: a
     member who ticked „sakrij moj profil" a moment ago lives there and nowhere else, so read off
     the file this list would go on offering the way in that the profile itself refuses. */
  const overlay = useOverlay()

  return (
    <div className="rankings rankings--tooled">
      <h1>{t('competitors.title')}</h1>

      <Resource state={state}>
        {(everybody) => (
          <CompetitorCards
            competitors={recordsOf(MEMBERS, everybody, overlay)}
            search={search}
            onSearch={(value) => setParams(value === '' ? {} : { trazi: value })}
          />
        )}
      </Resource>
    </div>
  )
}
