import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { useCompetitors } from '../../data/useResource'
import type { Competitor, MembershipBasis } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { paymentKey } from './pending'
import { QUEUE } from './queues'
import { SendBack } from './SendBack'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'
import './Verification.css'

/* Everyone who opened an account and is waiting to become a full member.
 *
 * Registration is approved by itself and then the fee is waited for; the member
 * becomes full the moment somebody records that it arrived (PDL P8). Until then
 * they are nowhere on the portal and can do nothing, so this screen is the whole
 * of their existence in the league.
 *
 * Activation has two grounds, not one. A paid fee is the usual one, and honorary
 * is the second: during the fortnight before registration opens the owner enters
 * the competitors of earlier seasons himself and does not charge them for 2027.
 * An honorary member is a full member, ranked like anybody else, and the ground
 * is only ever a line in the books. It is never shown publicly, anywhere, because
 * it is a fact about money rather than about running.
 *
 * A table, because the work here is comparison down a list rather than reading
 * one thing.
 */
export function Payments() {
  const { t } = useI18n()
  const { role } = useRole()
  const { decisions, settle } = useSession()
  const [open, setOpen] = useState<string | null>(null)
  const state = useCompetitors()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  const queue = QUEUE.payments
  const activate = (key: string, basis: MembershipBasis) =>
    settle(key, { status: 'approved', note: '', basis })

  return (
    <div className="member">
      <h1>{t(queue.labelKey)}</h1>
      <p className="member__note">{t(queue.sourceKey)}</p>
      <p className="member__note">{t('verification.basisNote')}</p>

      <Resource state={state}>
        {(competitors) => {
          const unpaid = competitors.filter((one) => !one.active)
          const decided = (one: Competitor) =>
            decisions[paymentKey(one.memberNumber)] !== undefined
          const waiting = unpaid.filter((one) => !decided(one))
          const settled = unpaid.filter(decided)

          return (
            <>
              <h2 className="profile__section">
                {t('review.waiting')} <span className="profile__count">{waiting.length}</span>
              </h2>

              {waiting.length === 0 ? (
                <p className="profile__empty">{t('verification.empty')}</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <caption className="visually-hidden">{t(queue.labelKey)}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('competitors.columns.member')}</th>
                        <th scope="col">{t('competitors.columns.city')}</th>
                        <th scope="col">{t('review.decision')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waiting.map((one) => (
                        <tr key={one.memberNumber}>
                          <td>
                            {one.firstName} {one.lastName}{' '}
                            <span className="table__member-number">{one.memberNumber}</span>
                          </td>
                          <td>
                            {one.city}
                            <span className="pending__country">{t(`country.${one.country}`)}</span>
                          </td>
                          <td className="review__decide">
                            <button
                              type="button"
                              className="button button--primary"
                              onClick={() => activate(paymentKey(one.memberNumber), 'payment')}
                            >
                              {t('verification.activatePayment')}
                            </button>
                            <button
                              type="button"
                              className="button button--secondary"
                              onClick={() => activate(paymentKey(one.memberNumber), 'honorary')}
                            >
                              {t('verification.activateHonorary')}
                            </button>
                            <button
                              type="button"
                              className="button button--secondary"
                              onClick={() => setOpen(paymentKey(one.memberNumber))}
                            >
                              {t('review.sendBack')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {open !== null && (
                <SendBack
                  onConfirm={(reason) => {
                    settle(open, { status: 'rejected', note: reason, basis: '' })
                    setOpen(null)
                  }}
                  onCancel={() => setOpen(null)}
                />
              )}

              {settled.length > 0 && (
                <>
                  <h2 className="profile__section">{t('review.decided')}</h2>
                  <div className="table-scroll">
                    <table className="table">
                      <caption className="visually-hidden">{t('review.decided')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('competitors.columns.member')}</th>
                          <th scope="col">{t('admin.state')}</th>
                          <th scope="col">{t('admin.basis')}</th>
                          <th scope="col">{t('review.explanation')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settled.map((one) => {
                          const decision = decisions[paymentKey(one.memberNumber)]

                          return (
                            <tr key={one.memberNumber}>
                              <td>
                                {one.firstName} {one.lastName}{' '}
                                <span className="table__member-number">{one.memberNumber}</span>
                              </td>
                              <td>
                                <span className={`tag tag--${decision.status}`}>
                                  {t(`status.${decision.status}`)}
                                </span>
                              </td>
                              <td>
                                {decision.basis === '' ? (
                                  ''
                                ) : (
                                  <span className={`tag tag--${decision.basis}`}>
                                    {t(`admin.basisValue.${decision.basis}`)}
                                  </span>
                                )}
                              </td>
                              <td>{decision.note}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
