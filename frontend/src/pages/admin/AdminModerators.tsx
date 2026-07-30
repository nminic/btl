import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { useModerators } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { EditableCell } from './EditableCell'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { MODERATORS, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import { grantedCount } from './rights'
import { RightsMatrix } from './RightsMatrix'
import '../member/Member.css'
import './Rights.css'

/**
 * Moderators, as an entity among the others, and the matrix that says what each
 * of them may do (PDL P28a, 30.07.2026).
 *
 * This is the one screen a moderator does not reach, and the door on it is
 * fitted by the route table like every other (needs.ts, Guard.tsx). What he
 * alone does is decide what the moderator may (PDL P21). Without that boundary
 * the difference between the two roles is a word in the code, and a moderator
 * standing in front of his own row of boxes is not a moderator being limited by
 * anything.
 *
 * A moderator is entered and changed the way the other eight entities are, by
 * the one renderer reading one JSON definition. The rights are not on that form
 * on purpose: they are the matrix, and a second place to set them would be a
 * second answer to the same question.
 */
export function AdminModerators() {
  const { t } = useI18n()
  const overlay = useOverlay()
  const { rights } = useSession()
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = useModerators()

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the browser
          tab. Here it was a heading and a sentence or two above the work, and the
          moderator arrives having just read the name in the list he came from
          (owner, 30.07.2026). It stays in the markup so the page has a name for
          anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.moderators')}</h1>

      <Resource state={state}>
        {(moderators) => {
          const rows = recordsOf(MODERATORS, moderators, overlay)

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
              <EntityBar entity={MODERATORS} onNew={() => setEditing({ mode: 'new' })} />

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
                          <RowActions
                            entity={MODERATORS}
                            record={one}
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
