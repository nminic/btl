import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { resultsOf } from '../../data/derive'
import { useResults } from '../../data/useResource'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
import './Member.css'

/* Everything a member has sent in, in one place: what is still waiting, what
 * was sent back and why, and what has been counted. A result does not appear
 * in any table until it is approved (PDL P9), so this screen is the only place
 * where a pending one is visible at all. */
export function MyResults() {
  const { locale, t } = useI18n()
  const { memberNumber, submissions } = useSession()
  const state = useResults()

  if (memberNumber === null) {
    return <SignedOut />
  }

  const mine = submissions.filter((one) => one.memberNumber === memberNumber)

  return (
    <div className="member">
      <div className="member__head">
        <h1>{t('myResults.title')}</h1>
        <Link className="button button--primary" to={`/${locale}/rezultat/novi`}>
          {t('myResults.add')}
        </Link>
      </div>

      <section aria-labelledby="my-pending">
        <h2 className="profile__section" id="my-pending">
          {t('myResults.sentIn')} <span className="profile__count">{mine.length}</span>
        </h2>

        {mine.length === 0 ? (
          <p className="profile__empty">{t('myResults.noneSent')}</p>
        ) : (
          <ul className="submissions">
            {mine.map((one) => (
              <li key={one.id} className={`submissions__item submissions__item--${one.status}`}>
                <div className="submissions__head">
                  <strong>{one.eventName}</strong>
                  <span className={`tag tag--${one.status}`}>{t(`status.${one.status}`)}</span>
                </div>
                <p className="submissions__meta">
                  {formatShortDate(one.date, locale)}
                  {' · '}
                  {formatNumber(one.distanceKm, locale, 2)} km
                  {' · '}
                  {formatDuration(one.seconds)}
                  {' · '}
                  {formatPoints(one.points, locale)} BTL points
                </p>
                {one.note !== '' && <p className="submissions__note">{one.note}</p>}

                {/* And the way back in, on the one that was refused. A refusal
                    is not the end of a result: the member is told why, corrects
                    it and sends the same race again (owner, 06.08.2026). The
                    name of the race is in the accessible name, because a list of
                    six refusals is six buttons a screen reader cannot tell
                    apart. */}
                {one.status === 'rejected' && (
                  <p className="submissions__again">
                    <Link
                      className="button button--secondary"
                      aria-label={t('myResults.sendAgainNamed', { name: one.eventName })}
                      to={`/${locale}/rezultat/novi?ponovo=${one.id}`}
                    >
                      {t('myResults.sendAgain')}
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="profile__section">{t('myResults.counted')}</h2>

      <Resource state={state}>
        {(results) => {
          const counted = resultsOf(results, memberNumber)

          if (counted.length === 0) {
            return <p className="profile__empty">{t('profile.noResults')}</p>
          }

          return (
            <div className="table-scroll">
              <table className="table">
                <caption className="visually-hidden">{t('myResults.counted')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('profile.columns.date')}</th>
                    <th scope="col">{t('profile.columns.event')}</th>
                    <th scope="col">{t('rankings.columns.category')}</th>
                    <th scope="col" className="table__hide-phone">
                      {t('profile.columns.time')}
                    </th>
                    <th scope="col">{t('profile.columns.points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {counted.map((result) => (
                    <tr key={result.id}>
                      <td>{formatShortDate(result.date, locale)}</td>
                      <td>{result.eventName}</td>
                      <td>{t(`category.${result.category}`)}</td>
                      <td className="table__hide-phone">{formatDuration(result.seconds)}</td>
                      <td className="table__points">{formatPoints(result.points, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }}
      </Resource>
    </div>
  )
}
