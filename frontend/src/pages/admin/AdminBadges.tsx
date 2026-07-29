import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { OPERATORS, QUANTITIES, ruleSentence, type BadgeRule, type Operator, type Quantity } from './badgeRule'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

export function AdminBadges() {
  const { t } = useI18n()
  const { role } = useRole()
  const [rule, setRule] = useState<BadgeRule>({
    quantity: 'raceCount',
    operator: 'atLeast',
    value: 10,
    from: '',
    to: '',
  })

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.badges')}</h1>
      <p className="member__note">{t('badges.note')}</p>

      <div className="rankings__filters">
        <label className="rankings__field">
          <span>{t('badges.quantityLabel')}</span>
          <select
            value={rule.quantity}
            onChange={(event) =>
              setRule({ ...rule, quantity: event.target.value as Quantity })
            }
          >
            {QUANTITIES.map((one) => (
              <option key={one} value={one}>
                {t(`badges.quantity.${one}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="rankings__field">
          <span>{t('badges.operatorLabel')}</span>
          <select
            value={rule.operator}
            onChange={(event) =>
              setRule({ ...rule, operator: event.target.value as Operator })
            }
          >
            {OPERATORS.map((one) => (
              <option key={one} value={one}>
                {t(`badges.operator.${one}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="rankings__field">
          <span>{t('badges.valueLabel')}</span>
          <input
            type="number"
            min="1"
            value={rule.value}
            onChange={(event) => setRule({ ...rule, value: Number(event.target.value) })}
          />
        </label>

        <label className="rankings__field">
          <span>{t('badges.from')}</span>
          <input
            type="date"
            value={rule.from}
            onChange={(event) => setRule({ ...rule, from: event.target.value })}
          />
        </label>

        <label className="rankings__field">
          <span>{t('badges.to')}</span>
          <input
            type="date"
            value={rule.to}
            onChange={(event) => setRule({ ...rule, to: event.target.value })}
          />
        </label>
      </div>

      <p className="badges__sentence" role="status">
        {ruleSentence(rule, t)}
      </p>

      <p className="member__note">{t('badges.closedList')}</p>
    </div>
  )
}
