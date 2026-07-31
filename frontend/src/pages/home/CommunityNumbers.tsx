import { activeOnly, newestMembers } from '../../data/derive'
import type { Competitor } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { CompetitorName } from '../../components/CompetitorName'

const NEWEST = 5

/* Works in a preparation year with no results at all, which is the point of it:
 * it shows that people are joining when there is nothing else to show. */
export function CommunityNumbers({ competitors }: { competitors: Competitor[] }) {
  const { t } = useI18n()
  /* "Članova u ligi" is how many there are now, not how many there have ever
     been: a member whose fee has run out is in no list of this season (PDL
     P11). The number counted them and the list beside it named the newest of
     them, linking to a profile that is not there. */
  const members = activeOnly(competitors)

  return (
    <section className="card" aria-labelledby="community-heading">
      <h2 className="card__title" id="community-heading">
        {t('home.community')}
      </h2>
      <p className="community__count">
        <strong>{members.length}</strong>
        <span>{t('home.membersInSeason')}</span>
      </p>
      <p className="card__note">{t('home.newest')}</p>
      <ul className="community__list">
        {newestMembers(members, NEWEST).map((competitor) => (
          <li key={competitor.memberNumber}>
            <CompetitorName competitor={competitor} />
            <span className="community__city">{competitor.city}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
