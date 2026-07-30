import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { useModerators } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { EditableCell } from './EditableCell'
import { EntityEditor, NewRecord, OpenRecord } from './EntityEditor'
import { MODERATORS, recordsOf, type Editing } from './entityForms'
import { grantedCount } from './rights'
import { RightsMatrix } from './RightsMatrix'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'
import './Rights.css'

/**
 * Moderators, as an entity among the others, and the matrix that says what each
 * of them may do (PDL P28a, 30.07.2026).
 *
 * This is the one screen a moderator does not reach. Everything else in
 * administration is open to both roles, because the superadmin does nothing a
 * moderator cannot; what he alone does is decide what the moderator may (PDL
 * P21). Without that boundary the difference between the two roles is a word in
 * the code, and a moderator standing in front of his own row of boxes is not a
 * moderator being limited by anything.
 *
 * A moderator is entered and changed the way the other eight entities are, by
 * the one renderer reading one JSON definition. The rights are not on that form
 * on purpose: they are the matrix, and a second place to set them would be a
 * second answer to the same question.
 */
export function AdminModerators() {
  const { t } = useI18n()
  const { role } = useRole()
  const { edits, creations, rights } = useSession()
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = useModerators()

  if (role !== 'superadmin') {
    return <StaffOnly noteKey="admin.moderatorsClosed" />
  }

  return (
    <div className="member">
      <h1>{t('admin.moderators')}</h1>
      <p className="member__note">{t('admin.moderatorsNote')}</p>
      <p className="member__note">{t('admin.editNote')}</p>

      <Resource state={state}>
        {(moderators) => {
          const rows = recordsOf(MODERATORS, moderators, edits, creations)

          if (editing !== null) {
            return (
              <EntityEditor
                entity={MODERATORS}
                editing={editing}
                onDone={() => setEditing(null)}
              />
            )
          }

          return (
            <>
              <NewRecord entity={MODERATORS} onOpen={() => setEditing({ mode: 'new' })} />

              <div className="table-scroll">
                <table className="table moderators">
                  <caption className="visually-hidden">{t('admin.moderators')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.field.firstName')}</th>
                      <th scope="col">{t('admin.field.lastName')}</th>
                      <th scope="col">{t('admin.field.email')}</th>
                      {/* Off the telephone, where four columns are what fits and
                          the number is on every row of the matrix below anyway. */}
                      <th scope="col" className="table__hide-phone">
                        {t('rights.given')}
                      </th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.id}>
                        <td>
                          <EditableCell
                            id={one.id}
                            field="firstName"
                            value={one.firstName}
                            label={t('admin.field.firstName')}
                          />
                        </td>
                        <td>
                          <EditableCell
                            id={one.id}
                            field="lastName"
                            value={one.lastName}
                            label={t('admin.field.lastName')}
                          />
                        </td>
                        <td className="moderators__email">
                          <EditableCell
                            id={one.id}
                            field="email"
                            value={one.email}
                            label={t('admin.field.email')}
                          />
                        </td>
                        <td className="table__hide-phone">
                          {grantedCount(one, rights) === 0
                            ? t('rights.none')
                            : t('rights.granted', { count: grantedCount(one, rights) })}
                        </td>
                        <td>
                          <OpenRecord
                            name={`${one.firstName} ${one.lastName}`}
                            onOpen={() => setEditing({ mode: 'one', record: one })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="entity-heading">{t('rights.title')}</h2>
              <p className="member__note">{t('rights.intro')}</p>
              <p className="member__note">{t('rights.superadminNote')}</p>

              <RightsMatrix moderators={rows} />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
