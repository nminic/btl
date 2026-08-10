import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { useDucats } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { DUCAT_KINDS, ruleSentence, type DucatKind, type DucatRule } from '../../data/ducatRule'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { DUCATS, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import '../member/Member.css'

export function AdminDucats() {
  const { locale, t } = useI18n()
  const overlay = useOverlay()
    const state = useDucats()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [rule, setRule] = useState<DucatRule>({
    kind: 'raceCount',
    value: 10,
    from: '',
    to: '',
  })

  if (editing !== null) {
    return (
      <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
        <h1 className="visually-hidden">{t('admin.ducats')}</h1>
        <EntityEditor entity={DUCATS} editing={editing} onDone={() => setEditing(null)} />
      </div>
    )
  }

  return (
    <div className="member">
      <h1 className="visually-hidden">{t('admin.ducats')}</h1>

      <EntityBar entity={DUCATS} onNew={() => setEditing({ mode: 'new' })} />

      {/* The same ducats the members see. This screen used to start from an
          empty list, from the days when no ducat was written down anywhere, so
          the superadmin could not see, let alone change, a single one of the
          ducats on the public page.

          There is no word for a list with nothing in it, here or on any of the
          other seven entity screens: the ducats are generated data, so the list
          is empty only if the file is, and a table with its headings and no rows
          says that plainly enough. */}
      <Resource state={state}>
        {(ducats) => {
          const rows = recordsOf(DUCATS, ducats, overlay)

          return (
            <div className="table-scroll">
              <table className="table">
                <caption className="visually-hidden">{t('admin.ducats')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('admin.field.ducatName')}</th>
                    <th scope="col">{t('admin.field.rule')}</th>
                    <th scope="col">{t('admin.form.record')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ducat) => (
                    <tr key={ducat.id}>
                      <td>{ducat.name}</td>
                      <td>{ruleSentence(ducat, t, locale)}</td>
                      <td>
                        <RowActions
                          entity={DUCATS}
                          record={ducat}
                          name={ducat.name}
                          onOpen={() => setEditing({ mode: 'one', record: ducat })}
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

      <h2 className="entity-heading">{t('admin.form.tryRule')}</h2>

      <div className="rankings__filters">
        <label className="rankings__field">
          <span>{t('ducats.kindLabel')}</span>
          <select
            value={rule.kind}
            onChange={(event) => setRule({ ...rule, kind: event.target.value as DucatKind })}
          >
            {DUCAT_KINDS.map((one) => (
              <option key={one} value={one}>
                {t(`ducats.kind.${one}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="rankings__field">
          <span>{t('ducats.valueLabel')}</span>
          <input
            type="number"
            min="1"
            value={rule.value}
            onChange={(event) => setRule({ ...rule, value: Number(event.target.value) })}
          />
        </label>

        <label className="rankings__field">
          <span>{t('ducats.from')}</span>
          <input
            type="date"
            value={rule.from}
            onChange={(event) => setRule({ ...rule, from: event.target.value })}
          />
        </label>

        <label className="rankings__field">
          <span>{t('ducats.to')}</span>
          <input
            type="date"
            value={rule.to}
            onChange={(event) => setRule({ ...rule, to: event.target.value })}
          />
        </label>
      </div>

      <p className="ducats__sentence" role="status" aria-label={t('admin.form.tryRule')}>
        {ruleSentence(rule, t, locale)}
      </p>

      <p className="member__note">{t('ducats.closedList')}</p>
    </div>
  )
}
