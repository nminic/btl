import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import {
  OPERATORS,
  QUANTITIES,
  ruleSentence,
  type BadgeRule,
  type Operator,
  type Quantity,
} from './badgeRule'
import { EntityEditor, NewRecord, OpenRecord } from './EntityEditor'
import { BADGES, recordsOf, type Editing } from './entityForms'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/** A badge as it is stored: what it is called, what it says, and the rule that
 *  awards it. The rule half is the closed set from badgeRule. */
type Badge = BadgeRule & { id: string; name: string; description: string }

export function AdminBadges() {
  const { t } = useI18n()
  const { role } = useRole()
  const { edits, creations } = useSession()
  const [editing, setEditing] = useState<Editing | null>(null)
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

  if (editing !== null) {
    return (
      <div className="member">
        <h1>{t('admin.badges')}</h1>
        <EntityEditor entity={BADGES} editing={editing} onDone={() => setEditing(null)} />
      </div>
    )
  }

  /* No badge has been written down anywhere yet, so the list holds exactly what
   * this visit created. Everything else on the portal reads generated data; a
   * badge has none, and inventing some would put rules on screen that the owner
   * never agreed to. */
  const rows = recordsOf(BADGES, [] as Badge[], edits, creations)

  return (
    <div className="member">
      <h1>{t('admin.badges')}</h1>
      <p className="member__note">{t('badges.note')}</p>

      <NewRecord entity={BADGES} onOpen={() => setEditing({ mode: 'new' })} />

      {rows.length === 0 ? (
        <p className="member__note">{t('admin.form.noBadges')}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <caption className="visually-hidden">{t('admin.badges')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('admin.field.badgeName')}</th>
                <th scope="col">{t('admin.field.rule')}</th>
                <th scope="col">{t('admin.form.record')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((badge) => (
                <tr key={badge.id}>
                  <td>{badge.name}</td>
                  <td>{ruleSentence(badge, t)}</td>
                  <td>
                    <OpenRecord
                      name={badge.name}
                      onOpen={() => setEditing({ mode: 'one', record: badge })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="entity-heading">{t('admin.form.tryRule')}</h2>

      <div className="rankings__filters">
        <label className="rankings__field">
          <span>{t('badges.quantityLabel')}</span>
          <select
            value={rule.quantity}
            onChange={(event) => setRule({ ...rule, quantity: event.target.value as Quantity })}
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
            onChange={(event) => setRule({ ...rule, operator: event.target.value as Operator })}
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
