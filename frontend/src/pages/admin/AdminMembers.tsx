import { categoryLabel } from '../../data/categories'
import { useState } from 'react'
import { Link } from 'react-router'
import { Resource } from '../../components/Resource'
import { categoryOfMember } from '../../data/derive'
import { SEASON } from '../../data/pricing'
import { useCompetitors } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { EditableCell } from './EditableCell'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { MEMBERS, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import { takenMemberNumbers } from './memberNumbers'
import '../member/Member.css'

/* The list of members, with the two things that are not public about them: the
 * year they were born and on what basis their membership is active. Both are kept
 * off every public screen and shown only here, to staff with rights over members
 * (PDL P8, P11, P23). */
export function AdminMembers() {
  const { locale, t } = useI18n()
  const overlay = useOverlay()
  const session = useSession()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = useCompetitors()

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.members')}</h1>

      <Resource state={state}>
        {(competitors) => {
          const all = recordsOf(MEMBERS, competitors, overlay)

          if (editing !== null) {
            return (
              <EntityEditor
                entity={MEMBERS}
                editing={editing}
                /* Every number that is gone, so a new member can be given the
                   first one that is not: the number is handed out rather than
                   typed (PDL P8, 30.07.2026). Worked out by the one module that
                   knows where a number can be spoken for, because this screen is
                   not the only one that gives them out. */
                taken={takenMemberNumbers(competitors, session)}
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
              <EntityBar entity={MEMBERS} onNew={() => setEditing({ mode: 'new' })}>
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
              </EntityBar>

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
                        <td>{categoryLabel(categoryOfMember(one, SEASON), t)}</td>
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
                          <RowActions
                            entity={MEMBERS}
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
            </>
          )
        }}
      </Resource>
    </div>
  )
}
