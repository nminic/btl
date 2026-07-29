import { JUNIOR, PRICES } from '../../data/pricing'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/* The price list as it is actually stored: rows with a period of validity. It
 * is shown here rather than edited, because a price is a promise to a member
 * and changing one mid-season is a decision, not an administrative action. */
export function AdminPricing() {
  const { t } = useI18n()
  const { role } = useRole()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.pricing')}</h1>
      <p className="member__note">{t('admin.pricingNote')}</p>

      <div className="table-scroll">
        <table className="table">
          <caption className="visually-hidden">{t('admin.pricing')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('admin.from')}</th>
              <th scope="col">{t('admin.to')}</th>
              <th scope="col">EUR</th>
              <th scope="col">RSD</th>
              <th scope="col">{t('admin.ranking')}</th>
            </tr>
          </thead>
          <tbody>
            {PRICES.map((row) => (
              <tr key={row.key}>
                <td>{row.from}</td>
                <td>{row.to}</td>
                <td>{row.eur}</td>
                <td>{row.rsd.toLocaleString('sr-Latn')}</td>
                <td>{row.ranking ? t('admin.yes') : t('admin.no')}</td>
              </tr>
            ))}
            <tr>
              <td>{t('pricing.rows.junior')}</td>
              <td>{'-'}</td>
              <td>{JUNIOR.eur}</td>
              <td>{JUNIOR.rsd.toLocaleString('sr-Latn')}</td>
              <td>{t('admin.yes')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
