import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { useBadges } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { BADGE_KINDS, ruleSentence, type BadgeKind, type BadgeRule } from '../../data/badgeRule'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { BADGES, recordsOf, type Editing } from './entityForms'
import { useOverlay } from './overlay'
import '../member/Member.css'

export function AdminBadges() {
  const { locale, t } = useI18n()
  const overlay = useOverlay()
    const state = useBadges()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [rule, setRule] = useState<BadgeRule>({
    kind: 'raceCount',
    value: 10,
    from: '',
    to: '',
  })

  if (editing !== null) {
    return (
      <div className="member">
        {/* The name of the screen is in the navigation beside it and in the browser
            tab. Here it was a heading and a sentence or two above the work, and the
            moderator arrives having just read the name in the list he came from
            (owner, 30.07.2026). It stays in the markup so the page has a name for
            anyone who cannot see which entry is marked. */}
        <h1 className="visually-hidden">{t('admin.badges')}</h1>
        <EntityEditor entity={BADGES} editing={editing} onDone={() => setEditing(null)} />
      </div>
    )
  }

  return (
    <div className="member">
      <h1 className="visually-hidden">{t('admin.badges')}</h1>

      <EntityBar entity={BADGES} onNew={() => setEditing({ mode: 'new' })} />

      {/* The same badges the members see. This screen used to start from an
          empty list, from the days when no badge was written down anywhere, so
          the superadmin could not see, let alone change, a single one of the
          badges on the public page.

          There is no word for a list with nothing in it, here or on any of the
          other seven entity screens: the badges are generated data, so the list
          is empty only if the file is, and a table with its headings and no rows
          says that plainly enough. */}
      <Resource state={state}>
        {(badges) => {
          const rows = recordsOf(BADGES, badges, overlay)

          return (
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
                      <td>{ruleSentence(badge, t, locale)}</td>
                      <td>
                        <RowActions
                          entity={BADGES}
                          record={badge}
                          name={badge.name}
                          onOpen={() => setEditing({ mode: 'one', record: badge })}
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
          <span>{t('badges.kindLabel')}</span>
          <select
            value={rule.kind}
            onChange={(event) => setRule({ ...rule, kind: event.target.value as BadgeKind })}
          >
            {BADGE_KINDS.map((one) => (
              <option key={one} value={one}>
                {t(`badges.kind.${one}`)}
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

      <p className="badges__sentence" role="status" aria-label={t('admin.form.tryRule')}>
        {ruleSentence(rule, t, locale)}
      </p>

      <p className="member__note">{t('badges.closedList')}</p>
    </div>
  )
}
