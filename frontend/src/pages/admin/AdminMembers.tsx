import { ProfileLink } from '../profile/ProfileLink'
import { categoryLabel } from '../../data/categories'
import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { categoryOfMember } from '../../data/derive'
import { useCompetitors } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { EditableCell } from './EditableCell'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { MEMBERS, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import { takenMemberNumbers } from './memberNumbers'
import '../member/Member.css'

/* The list of members, with the one thing that is not public about them: on what
 * basis their membership is active, which is kept off every public screen and
 * shown only here, to staff with rights over members (PDL P8, P11, P23).
 *
 * **It was two until 13.09.2026**, the other being the year each member was born.
 * That sentence was true about the screen and false about the portal, and the
 * difference is the whole reason the column is gone: this screen reads the same
 * `competitors` file as every public one, and that file is served to anybody who
 * asks for its address, signed in or not (ADL A8). Drawing a field only behind a
 * sign-in does not make it private when the record carrying it is public, so the
 * year has left the record and not merely this table (`data/types.ts`). */
export function AdminMembers() {
  const { t } = useI18n()
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
                      {/* The category, and no column of years beside it. This table
                          printed the year of birth of every member until 13.09.2026,
                          and it was drawn from the same public file every other screen
                          reads (ADL A8): administration was where it was shown, not
                          where it was kept. Član 74 allows the category and nothing
                          finer, so the category is the whole of what stands here. */}
                      <th scope="col">{t('competitors.columns.category')}</th>
                      <th scope="col">{t('competitors.columns.city')}</th>
                      <th scope="col">{t('admin.basis')}</th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.memberNumber}>
                        <td>
                          <ProfileLink competitor={one}>
                            {one.firstName} {one.lastName}
                          </ProfileLink>{' '}
                          <span className="table__member-number">{one.memberNumber}</span>
                        </td>
                        <td>{categoryLabel(categoryOfMember(one), t)}</td>
                        <td>
                          <EditableCell
                            under={MEMBERS.id}
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
