import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { resultsOf } from '../../data/derive'
import { RESULTS, useResults } from '../../data/useResource'
import { formatDuration, formatNumber, formatPoints, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { DeleteRecord } from '../admin/EntityEditor'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
import './Member.css'

/* Everything a member has sent in, in one place: what is still waiting, what
 * was sent back and why, and what has been counted. A result does not appear
 * in any table until it is approved (PDL P9), so this screen is the only place
 * where a pending one is visible at all. */
export function MyResults() {
  const { locale, t } = useI18n()
  const { memberNumber, submissions, withdraw, remove } = useSession()
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
                  <strong>{one.raceName}</strong>
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

                {/* What a member may do with a result that is still theirs to
                    act on, which is one that has not been decided or has been
                    sent back.

                    The way back in was here first, on the refused one alone: a
                    refusal is not the end of a result, the member is told why,
                    corrects it and sends the same race again (owner,
                    06.08.2026). Owner, 27.08.2026, on the rest of it: „član ga
                    ili briše (ima pravo na to) ili menja i dostavlja dokaz za tu
                    izmenu", and asked what may be changed: „sve osim trke", so
                    somebody who picked the wrong race deletes this and enters
                    another.

                    The words differ because the two moments do: one that was
                    sent back is sent again, one that is still waiting is simply
                    changed. The road is the same and so is the form.

                    The name of the race is in the accessible name of every
                    control here, because a list of six waiting results is six
                    buttons a screen reader cannot otherwise tell apart. */}
                {one.status !== 'approved' && (
                  <p className="submissions__again">
                    <Link
                      className="button button--secondary"
                      aria-label={t(
                        one.status === 'rejected' ? 'myResults.sendAgainNamed' : 'myResults.changeNamed',
                        { name: one.raceName },
                      )}
                      to={`/${locale}/rezultat/novi?ponovo=${one.id}`}
                    >
                      {t(one.status === 'rejected' ? 'myResults.sendAgain' : 'myResults.change')}
                    </Link>
                    {/* Asked twice before it happens, which is the portal's one
                        way of asking about something nothing brings back
                        (`DeleteRecord`). Dressed as the button beside it rather
                        than as a row of a table, which is the only difference. */}
                    <DeleteRecord
                      name={one.raceName}
                      look="button button--secondary"
                      onDelete={() => {
                        withdraw(one.id)
                      }}
                    />
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
                    {/* „Trka" and not „Događaj": what stands in this column is the name of
                      the race (owner, 23.08.2026), and a heading that says otherwise
                      is read out with every cell under it. */}
                  <th scope="col">{t('profile.columns.race')}</th>
                    <th scope="col">{t('rankings.columns.category')}</th>
                    <th scope="col" className="table__hide-phone">
                      {t('profile.columns.time')}
                    </th>
                    <th scope="col">{t('profile.columns.points')}</th>
                    {/* Named, because two controls in a cell with no heading are
                        two buttons a screen reader meets with nothing saying what
                        column they are in. */}
                    <th scope="col">{t('myResults.own')}</th>
                  </tr>
                </thead>
                <tbody>
                  {counted.map((result) => (
                    <tr key={result.id}>
                      <td>{formatShortDate(result.date, locale)}</td>
                      <td>
                        {/* The race and not the event it belonged to (owner,
                            23.08.2026): „u listi rezultata treba da se prikazuju
                            nazivi trka na kojima je čovek učestvovao, a ne
                            događaja." */}
                        {result.raceName}
                      </td>
                      <td>{t(`category.${result.category}`)}</td>
                      <td className="table__hide-phone">{formatDuration(result.seconds)}</td>
                      <td className="table__points">{formatPoints(result.points, locale)}</td>
                      {/* What a member may still do with a result that has been
                          counted. Owner, 27.08.2026: „član ga ili briše (ima
                          pravo na to, iako je verifikovan) ili menja i dostavlja
                          dokaz za tu izmenu (ponovo)."

                          That overturned an older decision, which said a member
                          may delete their own result only while it is waiting.
                          Verification is a check of what is true, not a transfer
                          of ownership: the result is the member's own record and
                          the right to withdraw it does not end because a
                          moderator agreed with it.

                          Changing it is not an edit in place. It leaves the
                          standings, goes back to the queue carrying new proof,
                          and returns only when somebody has agreed with it again;
                          anything else would let a member move their own points
                          after they were counted. */}
                      <td className="my-results__own">
                        <Link
                          className="button button--secondary"
                          aria-label={t('myResults.changeNamed', { name: result.raceName })}
                          to={`/${locale}/rezultat/novi?ispravka=${result.id}`}
                        >
                          {t('myResults.change')}
                        </Link>
                        <DeleteRecord
                          name={result.raceName}
                          look="button button--secondary"
                          onDelete={() => {
                            remove(RESULTS, result.id)
                          }}
                        />
                      </td>
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
