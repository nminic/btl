import { Link } from 'react-router'
import { newestMembers } from '../../data/derive'
import type { Competitor } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'

const NEWEST = 5

/* Works in a preparation year with no results at all, which is the point of it:
 * it shows that people are joining when there is nothing else to show. */
export function CommunityNumbers({ competitors }: { competitors: Competitor[] }) {
  const { locale, t } = useI18n()

  return (
    <section className="card" aria-labelledby="community-heading">
      <h2 className="card__title" id="community-heading">
        {t('home.community')}
      </h2>
      <p className="community__count">
        <strong>{competitors.length}</strong>
        <span>{t('home.membersInSeason')}</span>
      </p>
      <p className="card__note">{t('home.newest')}</p>
      <ul className="community__list">
        {newestMembers(competitors, NEWEST).map((competitor) => (
          <li key={competitor.memberNumber}>
            <Link to={`/${locale}/takmicar/${competitor.memberNumber}`}>
              {competitor.firstName} {competitor.lastName}
            </Link>
            <span className="community__city">{competitor.city}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
