import { Link } from 'react-router'
import { Resource } from '../components/Resource'
import { useLeagues } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import './Leagues.css'

export function Leagues() {
  const { locale, t } = useI18n()
  const state = useLeagues()

  return (
    <div className="leagues">
      <h1>{t('leagues.title')}</h1>

      <Resource state={state}>
        {(leagues) => (
          <ul className="leagues__list">
            {leagues.map((league) => (
              <li key={league.id} className="leagues__item">
                <h2>
                  <Link to={`/${locale}/liga/${league.slug}`}>{league.name}</Link>
                </h2>
                <p>
                  {t('leagues.season', { season: league.season })}
                  {' · '}
                  {t('leagues.events')}
                  {': '}
                  {league.eventIds.length}
                </p>
                <p className="leagues__grouping">
                  {league.groupsByCategory ? t('leagues.byCategory') : t('leagues.byGenderOnly')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Resource>
    </div>
  )
}
