import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { categoryOfMember } from '../../data/derive'
import { SEASON } from '../../data/pricing'
import { useCompetitors } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { isStaff } from '../../roles/context'
import { useRole } from '../../roles/useRole'
import { useSession } from '../../session/useSession'
import { EditableCell } from './EditableCell'
import { EntityEditor, NewRecord, OpenRecord } from './EntityEditor'
import { MEMBERS, recordsOf, type Editing } from './entityForms'
import { StaffOnly } from './StaffOnly'
import '../member/Member.css'

/* The list of members, with the two things that are not public about them: the
 * year they were born and on what basis their membership is active. Both are kept
 * off every public screen and shown only here, to staff with rights over members
 * (PDL P8, P11, P23). */
export function AdminMembers() {
  const { locale, t } = useI18n()
  const { role } = useRole()
  const { edits, creations } = useSession()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = useCompetitors()

  if (!isStaff(role)) {
    return <StaffOnly />
  }

  return (
    <div className="member">
      <h1>{t('admin.members')}</h1>
      <p className="member__note">{t('admin.editNote')}</p>

      <Resource state={state}>
        {(competitors) => {
          const all = recordsOf(MEMBERS, competitors, edits, creations)

          if (editing !== null) {
            return (
              <EntityEditor
                entity={MEMBERS}
                editing={editing}
                /* A member number is unique (PDL P8), so the form has to know
                   which ones are gone. Without it two members answered to one
                   number and one change reached both. */
                taken={all.map((one) => String(one.memberNumber))}
                onDone={() => setEditing(null)}
              />
            )
          }

          const needle = search.trim().toLowerCase()
          const rows = all.filter((one) =>
            `${one.firstName} ${one.lastName} ${one.memberNumber} ${one.city}`
              .toLowerCase()
              .includes(needle),
          )

          return (
            <>
              <NewRecord entity={MEMBERS} onOpen={() => setEditing({ mode: 'new' })} />

              <div className="rankings__filters">
                <label className="rankings__field rankings__field--wide">
                  <span>{t('competitors.search')}</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>

              <p className="rankings__count">{t('competitors.count', { count: rows.length })}</p>

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.members')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('competitors.columns.member')}</th>
                      <th scope="col">{t('competitors.columns.category')}</th>
                      <th scope="col">{t('admin.field.birthYear')}</th>
                      <th scope="col">{t('competitors.columns.city')}</th>
                      <th scope="col">{t('admin.basis')}</th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.memberNumber}>
                        <td>
                          <Link to={`/${locale}/takmicar/${one.memberNumber}`}>
                            {one.firstName} {one.lastName}
                          </Link>{' '}
                          <span className="table__member-number">{one.memberNumber}</span>
                        </td>
                        <td>{categoryOfMember(one, SEASON)}</td>
                        <td>{one.birthYear}</td>
                        <td>
                          <EditableCell
                            id={one.memberNumber}
                            field="city"
                            value={one.city}
                            label={t('competitors.columns.city')}
                          />
                        </td>
                        <td>
                          <span className={`tag tag--${one.membershipBasis}`}>
                            {t(`admin.basisValue.${one.membershipBasis}`)}
                          </span>
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
            </>
          )
        }}
      </Resource>
    </div>
  )
}
