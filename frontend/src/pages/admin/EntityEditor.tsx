import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FormRenderer } from '../../forms/FormRenderer'
import { shownValue, textFrom, valuesFor } from '../../forms/records'
import type { FieldOption, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { fieldValues, idFor, takenIdentity, type EntityDef, type Editing } from './entityForms'
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
  taken = [],
  openAt,
  onDone,
}: {
  entity: EntityDef
  editing: Editing
  /** Choices for selects whose list is data: the events a race can belong to,
   *  the members who can run a team. */
  options?: Record<string, FieldOption[]>
  /**
   * The identities already in use, for the two entities that care.
   *
   * A written page asks for its own address and has to be told the address is
   * gone. A member does not ask at all: its number is handed out first free in
   * order (PDL P8, 30.07.2026), which is the same list read the other way round.
   * The other six generate an identity that cannot collide.
   */
  taken?: string[]
  /** The field the cursor starts in, handed through to the form. Only a copied
   *  event uses it (src/pages/event/EventActions.tsx). */
  openAt?: string
  onDone: () => void
}) {
  const { t } = useI18n()
  const { creations, create, editRecord } = useSession()
  const [saved, setSaved] = useState<FormValues | null>(null)
  const done = useRef<HTMLDivElement>(null)
  const form = entity.form

  /* The confirmation has just replaced the form, so whatever had the focus is no
   * longer on the page and the next Tab would start it from the top. The focus
   * moves to the confirmation, which is also what makes a screen reader read it
   * from its heading down. A panel that closes in the header has the same
   * problem and the same answer (src/app/Dropdown.tsx). */
  useEffect(() => {
    done.current?.focus()
  }, [saved])

  function handleSubmit(values: FormValues) {
    /* What the form asked for, and what is read off it.
     *
     * The derived values were written when a record was created and never again,
     * so editing what they are read from left them saying the old thing: change
     * a race from 42 km to 10 and it went on calling itself a marathon, change
     * the date of an event and it went on answering at last year's address. They
     * are worked out here, on every save, which is the only moment either can
     * have changed. */
    const text = {
      ...textFrom(form, values),
      ...Object.fromEntries((entity.derived?.(values) ?? []).map((one) => [one.name, one.value])),
    }

    if (editing.mode === 'new') {
      create(entity.id, idFor(entity, values, (creations[entity.id] ?? []).length, taken), text)
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
        <div
          className="entity-saved"
          role="status"
          tabIndex={-1}
          ref={done}
          aria-labelledby="entity-saved-title"
        >
          <h2 id="entity-saved-title">{t('admin.form.saved')}</h2>
          <p>{t('admin.form.savedNote')}</p>
          <dl>
            {/* Every value that was saved, beside the field it was saved in.
                Read as pairs so that what the confirmation shows is what was
                written down, rather than a field of the form standing over
                whatever the values happened to hold for its name
                (entityForms.ts, fieldValues). */}
            {fieldValues(form, saved).map(({ field, value }) => (
              <div key={field.name}>
                <dt>{t(field.labelKey)}</dt>
                <dd>{t(shownValue(field, value, options))}</dd>
              </div>
            ))}
            {/* What was saved without being asked for, read off the rest of it. */}
            {(entity.derived?.(saved) ?? []).map((one) => (
              <div key={one.name}>
                <dt>{t(one.labelKey)}</dt>
                <dd>{t(one.shownKey)}</dd>
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

  /* A record being changed is not competing with itself, so its own identity is
     not in the way of it. */
  const others =
    editing.mode === 'new'
      ? taken
      : taken.filter((one) => one !== String(editing.record[entity.idField]))

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
        check={(values) => takenIdentity(entity, values, others)}
        derived={entity.derived}
        openAt={openAt}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

/**
 * The strip above every list: whatever narrows it on the left, and the one
 * control that starts a record that does not exist yet on the right.
 *
 * The button carries the name of the thing being created, because "new record"
 * on nine screens is nine buttons a screen reader cannot tell apart.
 *
 * It sits at the end of the row rather than above it (owner, 30.07.2026). Above
 * the search it was the first thing on a screen whose work is reading a list;
 * at the far end of the same line it is where the eye goes last and the hand
 * goes when the list has been read. On a narrow screen the row wraps and the
 * button drops under the search, which is the same order.
 */
/** The one control on the screen that survives a row being deleted, so it is
 *  where the focus goes when one is (RowActions). */
export const NEW_RECORD_ID = 'entity-new'

export function EntityBar({
  entity,
  onNew,
  children,
}: {
  entity: EntityDef
  onNew: () => void
  /** What narrows the list, where the list has anything to narrow it by. */
  children?: ReactNode
}) {
  const { t } = useI18n()

  return (
    <div className="entity-bar">
      <div className="entity-bar__filters">{children}</div>
      <button
        type="button"
        id={NEW_RECORD_ID}
        className="button button--secondary entity-bar__new"
        onClick={onNew}
      >
        {t(`admin.form.new.${entity.id}`)}
      </button>
    </div>
  )
}

/**
 * What every row of every list ends with: open the record, or remove it.
 *
 * One component for both, so a tenth screen cannot be written with the one and
 * not the other, and so the two are always the same distance apart in the same
 * order on all nine.
 *
 * The identity comes off the record through the entity's own definition rather
 * than being handed in, because which field is the identity is a fact about the
 * entity: a member is its number, an event its id, a written page its address.
 */
export function RowActions({
  entity,
  record,
  name,
  onOpen,
}: {
  entity: EntityDef
  record: object
  /** What the row is called, for both accessible names. */
  name: string
  onOpen: () => void
}) {
  const { remove } = useSession()
  const id = String((record as Record<string, unknown>)[entity.idField])

  /* The row about to go is where the focus is, so deleting it leaves the focus
     on nothing and the next Tab starts the page from the top. It moves to the
     control that starts a new record, which is the one thing on the screen that
     cannot be the row just deleted; a screen reader announces the move, which is
     also the only word anyone gets that the deletion happened. */
  function deleteRow() {
    const anchor = document.getElementById(NEW_RECORD_ID)

    if (anchor !== null) {
      anchor.focus()
    }

    remove(entity.id, id)
  }

  return (
    <span className="entity-row-actions">
      <OpenRecord name={name} onOpen={onOpen} />
      <DeleteRecord name={name} onDelete={deleteRow} />
    </span>
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

/**
 * And the control that removes it (owner, 30.07.2026).
 *
 * Asked twice, because nothing brings the record back and the button stands in a
 * row of twenty beside the one that merely opens it. The first press asks, the
 * second does it, and the third control that appears beside it puts the question
 * away. No dialogue: nothing to trap the focus in, nothing to dismiss with a
 * key, and the record still gone in two presses when it is meant to be.
 *
 * The question stays where it was put, in its own row, until it is answered. It
 * does not close when the list is searched or sorted: the rows are keyed by
 * identity, so the question follows the record it names rather than the place it
 * was standing, and a question that closed itself on the next keystroke would be
 * one somebody had to ask twice.
 *
 * The name of the record is on all three, so a screen reader asking "delete
 * what?" is answered without reading back up the row, and two rows asking at
 * once are two different questions rather than two buttons called Odustani.
 */
export function DeleteRecord({ name, onDelete }: { name: string; onDelete: () => void }) {
  const { t } = useI18n()
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button
        type="button"
        className="entity-open entity-delete"
        aria-label={t('admin.form.deleteNamed', { name })}
        onClick={() => setAsking(true)}
      >
        {t('admin.form.delete')}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="entity-open entity-delete entity-delete--sure"
        aria-label={t('admin.form.deleteSureNamed', { name })}
        onClick={onDelete}
      >
        {t('admin.form.deleteSure')}
      </button>
      <button
        type="button"
        className="entity-open"
        aria-label={t('admin.form.keepNamed', { name })}
        onClick={() => setAsking(false)}
      >
        {t('admin.form.keep')}
      </button>
    </>
  )
}
