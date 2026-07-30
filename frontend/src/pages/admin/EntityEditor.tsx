import { useState } from 'react'
import { FormRenderer } from '../../forms/FormRenderer'
import { shownValue, textFrom, valuesFor } from '../../forms/records'
import type { FieldOption, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { idFor, type EntityDef, type Editing } from './entityForms'
import './Entity.css'

/* One record of one entity, opened whole.
 *
 * Editing in the row covers the correction of a single value spotted while
 * reading a list, which is most of the work. It cannot cover a date, a number, a
 * choice or a flag, and it cannot enter a record that is not there yet. This is
 * the other half: the whole record, with every field it has, validated by the
 * rules written in its definition rather than by anything on this screen.
 *
 * There is one of these for all eight entities. What differs between them is a
 * JSON file (PDL P30).
 */
export function EntityEditor({
  entity,
  editing,
  options = {},
  onDone,
}: {
  entity: EntityDef
  editing: Editing
  /** Choices for selects whose list is data: the events a race can belong to,
   *  the members who can run a team. */
  options?: Record<string, FieldOption[]>
  onDone: () => void
}) {
  const { t } = useI18n()
  const { creations, create, editRecord } = useSession()
  const [saved, setSaved] = useState<FormValues | null>(null)
  const form = entity.form

  function handleSubmit(values: FormValues) {
    const text = textFrom(form, values)

    if (editing.mode === 'new') {
      create(entity.id, idFor(entity, values, (creations[entity.id] ?? []).length), text)
    } else {
      editRecord(String(editing.record[entity.idField]), text)
    }

    setSaved(values)
  }

  if (saved !== null) {
    return (
      <div className="entity-editor">
        {/* Announced as soon as it appears, and it says what was written rather
            than that something was: "saved" on its own is not a confirmation. */}
        <div className="entity-saved" role="status" aria-labelledby="entity-saved-title">
          <h2 id="entity-saved-title">{t('admin.form.saved')}</h2>
          <p>{t('admin.form.savedNote')}</p>
          <dl>
            {form.fields.map((field) => (
              <div key={field.name}>
                <dt>{t(field.labelKey)}</dt>
                <dd>{t(shownValue(field, saved[field.name], options))}</dd>
              </div>
            ))}
          </dl>
        </div>

        <button type="button" className="button button--secondary" onClick={onDone}>
          {t('admin.form.back')}
        </button>
      </div>
    )
  }

  return (
    <div className="entity-editor">
      <button type="button" className="button button--secondary" onClick={onDone}>
        {t('admin.form.back')}
      </button>

      <FormRenderer
        form={form}
        title={t(
          editing.mode === 'new'
            ? `admin.form.new.${entity.id}`
            : `admin.form.edit.${entity.id}`,
        )}
        initial={editing.mode === 'new' ? undefined : valuesFor(form, editing.record)}
        options={options}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

/** The one control that starts a record that does not exist yet. It carries the
 *  name of the thing being created, because "new record" on eight screens is
 *  eight buttons a screen reader cannot tell apart. */
export function NewRecord({ entity, onOpen }: { entity: EntityDef; onOpen: () => void }) {
  const { t } = useI18n()

  return (
    <div className="entity-actions">
      <button type="button" className="button button--secondary" onClick={onOpen}>
        {t(`admin.form.new.${entity.id}`)}
      </button>
      <p className="member__note">{t('admin.form.note')}</p>
    </div>
  )
}

/** The control in a row that opens that row's record. The name of the record is
 *  in the accessible name, so twenty of these are twenty different controls. */
export function OpenRecord({ name, onOpen }: { name: string; onOpen: () => void }) {
  const { t } = useI18n()

  return (
    <button
      type="button"
      className="entity-open"
      aria-label={t('admin.form.openNamed', { name })}
      onClick={onOpen}
    >
      {t('admin.form.open')}
    </button>
  )
}
