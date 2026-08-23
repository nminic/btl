import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FormRenderer } from '../../forms/FormRenderer'
import { fieldValue, shownValue, textFrom, valuesFor } from '../../forms/records'
import type { FieldError, FieldOption, FormDef, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { plainWords } from '../../forms/worded'
import { useSession } from '../../session/useSession'
import {
  addressField,
  fieldValues,
  idFor,
  takenAddress,
  type EntityDef,
  type Editing,
} from './entityForms'
import './Entity.css'

/* One record of one entity, opened whole.
 *
 * Editing in the row covers the correction of a single value spotted while
 * reading a list, which is most of the work. It cannot cover a date, a number, a
 * choice or a flag, and it cannot enter a record that is not there yet. This is
 * the other half: the whole record, with every field it has, validated by the
 * rules written in its definition rather than by anything on this screen.
 *
 * There is one of these for all seven entities, and for the
 * races inside an event. What differs between them is a
 * JSON file (PDL P30).
 */
export function EntityEditor({
  entity,
  editing,
  options = {},
  taken = [],
  also,
  alsoSave,
  alsoFolds,
  seed = 0,
  openAt,
  onDone,
  onCreated,
  beneath,
  alsoRefuses,
  titleKey,
  form: drawn,
}: {
  entity: EntityDef
  editing: Editing
  /**
   * What else a save changes, run with the values it is being saved with.
   *
   * The races of an event: moving an event moves them with it, by the same
   * number of days (owner, 10.08.2026). Handed in rather than worked out here,
   * because what belongs to what is a fact about the screen and not about the
   * editor.
   */
  alsoSave?: (values: FormValues, written: string) => void
  /**
   * What the press changes about the values themselves, before anything is read
   * off them.
   *
   * `alsoSave` runs after the record is written, so anything it changes about the
   * record is already too late for the three things the values feed: the derived
   * text (`textFrom`), the derived fields (`entity.derived`, which is where the
   * address comes from), and the confirmation. An event follows its earliest race
   * (owner, 10.08.2026), and moved there afterwards the screen said „Datum
   * 30/01/2027 … Adresa podgoricka-desetka-2027" over a record that had just been
   * filed on 30.12.2026 under last year's address. Measured 23.08.2026.
   *
   * So what the press knows about the values is folded in here, once, and
   * everything downstream reads the same thing that was written.
   */
  alsoFolds?: (values: FormValues) => FormValues
  /**
   * A number that changes when the record has been changed by something else,
   * so the form is drawn again from what it now says.
   *
   * The races of an event move the event: a race entered on an earlier morning,
   * or the first one deleted, makes that day the event's (owner, 10.08.2026).
   * The form is seeded once, so it went on holding the day the event used to be
   * on, and saving it moved every race by the difference.
   *
   * On the form and not on this whole component, because the confirmation must
   * survive: a moderator who has just saved and then deletes a race would
   * otherwise watch "Sačuvano" disappear and the empty form come back, with the
   * focus falling to the page.
   */
  seed?: number
  /** Choices for selects whose list is data: the events a race can belong to,
   *  the members who can run a team. */
  options?: Record<string, FieldOption[]>
  /**
   * What is spoken for already, for the three entities that care.
   *
   * A written page asks for its own address, and is filed under it, so it has to
   * be told when the address is gone. A league asks for an address it is not
   * filed under, and has to be told the same thing. A member does not ask at
   * all: its number is handed out first free in order (PDL P8, 30.07.2026),
   * which is the same list read the other way round. The rest are filed under an
   * identity nobody types and answer at an address worked out for them.
   */
  taken?: string[]
  /**
   * A rule of the screen's own, checked beside the one every editor checks.
   *
   * The teams use it: one name is one team (PDL P13), and the address a team
   * answers at is read off its name, so two teams of one name are two teams at
   * one address. The queue that approves proposals refuses that; without this
   * the same name could be typed in here and the guard walked around.
   */
  also?: (values: FormValues) => Record<string, FieldError>
  /** The field the cursor starts in, handed through to the form. Only a copied
   *  event uses it (src/pages/event/EventActions.tsx). */
  openAt?: string
  onDone: () => void
  /**
   * Said with the identity of a record that has just been made.
   *
   * One screen listens: the events, where a race is entered inside the event it
   * belongs to and a new event has no identity to hang one on until it is saved
   * (owner, 11.08.2026). Without this the moderator had to save, go back to the
   * list, find the event they had just made, and open it again.
   */
  onCreated?: (id: string) => void
  /** What the screen draws between the fields and the button that sends them,
   *  and what it refuses that no field of the form can (FormRenderer.tsx). */
  beneath?: (values: FormValues) => ReactNode
  alsoRefuses?: () => string | undefined
  /**
   * Words for the heading, where what the screen is doing is not what the mode
   * says. Copying an event is technically an edit of a record that was written a
   * moment ago, and „Izmena događaja" is the truth about the code rather than
   * about the work (owner, 23.08.2026: „Kopiranje događaja treba da se zove u vrhu
   * Kopiranje a ne Izmena").
   */
  titleKey?: string
  /**
   * The form to draw, where the screen asks for less than the entity does.
   *
   * A copy is not asked for its town, its country or its kind: it has them from
   * the event it was copied out of and they are not in question (owner,
   * 23.08.2026). Left off the form, they are left out of what the save writes, and
   * a save writes over the fields it carries rather than the whole record, so what
   * is not asked stays as it was.
   */
  form?: FormDef
}) {
  const { t } = useI18n()
  const { creations, create, editRecord } = useSession()
  const [saved, setSaved] = useState<FormValues | null>(null)
  const done = useRef<HTMLDivElement>(null)
  /* What the screen asked for, or what the entity holds. A copy is drawn without
     the three fields it does not put in question (see `form` above). */
  const form = drawn ?? entity.form

  /* The confirmation has just replaced the form, so whatever had the focus is no
   * longer on the page and the next Tab would start it from the top. The focus
   * moves to the confirmation, which is also what makes a screen reader read it
   * from its heading down. A panel that closes in the header has the same
   * problem and the same answer (src/app/Dropdown.tsx). */
  useEffect(() => {
    done.current?.focus()
  }, [saved])

  function handleSubmit(given: FormValues) {
    /* What the press knows and the form does not, folded in before anything reads
       the values: the address, the derived text and the confirmation all come off
       what is below, so they say what was written rather than what was typed. */
    const values = alsoFolds?.(given) ?? given

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
      ...Object.fromEntries(
        (
          entity.derived?.(values, editing.mode === 'one' ? editing.record : undefined) ?? []
        ).map((one) => [one.name, one.value]),
      ),
    }

    let written: string

    if (editing.mode === 'new') {
      const made = idFor(
        entity,
        values,
        (creations[entity.id] ?? []).map((one) => one.id),
        taken,
      )

      create(entity.id, made, text)
      onCreated?.(made)
      written = made
    } else {
      written = String(editing.record[entity.idField])
      editRecord(written, text)
    }

    /* On both, because what else a save changes does not depend on whether the
       record is new. With the identity of what was written, which a new record
       does not have until this moment: the races of an event are saved in the
       same press and have to be filed under it (AdminEvents.tsx). */
    alsoSave?.(values, written)

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
                <dt>{plainWords(t(field.labelKey), field, t)}</dt>
                <dd>{t(shownValue(field, value, options))}</dd>
              </div>
            ))}
            {/* What was saved without being asked for, read off the rest of it,
                and off the record it was saved over where there is one: the
                address of an event that carried more than the rule builds is
                the address it still carries. */}
            {(
              entity.derived?.(saved, editing.mode === 'one' ? editing.record : undefined) ?? []
            ).map((one) => (
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

  /* A record being changed is not competing with itself, so its own address is
     not in the way of it. Its address and not its identity: a league is filed
     under an id it never shows and answers at an address of its own, so
     comparing identities would leave every league refusing its own address
     (entityForms.ts, `addressField`). */
  const named = addressField(entity)
  const others =
    editing.mode === 'new' || named === ''
      ? taken
      : taken.filter((one) => one !== String(editing.record[named]))

  return (
    <div className="entity-editor">
      <button type="button" className="button button--secondary" onClick={onDone}>
        {t('admin.form.back')}
      </button>

      <FormRenderer
        key={seed}
        form={form}
        title={t(
          titleKey ??
            (editing.mode === 'new'
              ? `admin.form.new.${entity.id}`
              : `admin.form.edit.${entity.id}`),
        )}
        initial={
          editing.mode === 'new'
            ? /* The entity's own defaults first, then whatever opened the form
                 on top of them, so a shortcut may fill one field and leave the
                 rest as they always were. */
              { ...entity.start, ...editing.start }
            : valuesFor(form, editing.record)
        }
        /* So the address the form shows is the address the save will leave, and
           not the one the rule would build out of the fields: an event whose
           address carries more than the rule can build keeps it, and an
           administrator reading the form before they save was reading an
           address that would 404 (entityForms.ts, `addressOfEvent`). */
        was={editing.mode === 'one' ? editing.record : undefined}
        options={options}
        check={(values) => ({ ...takenAddress(entity, values, others), ...also?.(values) })}
        derived={entity.derived}
        openAt={openAt}
        /* What the screen draws between the fields and the button, and what it
           refuses that no field of the form can (forms/FormRenderer.tsx). The
           races of an event are entered there and saved with it. */
        beneath={beneath}
        alsoRefuses={alsoRefuses}
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
 * on every screen is a row of buttons a screen reader cannot tell apart.
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
 * One component for both, so a new screen cannot be written with the one and not
 * the other, and so the two are always the same distance apart in the same order
 * wherever a list is edited.
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
  alsoRemove,
  whyNoRemove,
}: {
  entity: EntityDef
  record: object
  /** What the row is called, for both accessible names. */
  name: string
  onOpen: () => void
  /**
   * What goes with the record, where something does.
   *
   * An event carries its races: a race is one length of that morning and is
   * defined inside it (owner, 06.08.2026), so an event deleted without them
   * leaves races belonging to nothing, and nothing on the portal shows a race
   * outside its event any more. Handed in rather than worked out here, because
   * what belongs to what is a fact about the screen's own data.
   */
  alsoRemove?: () => void
  /**
   * Why this record cannot be deleted, where something stops it.
   *
   * The events screen reads the results only so that deleting an event takes
   * them along, and it no longer waits for them: a file of a million and a half
   * bytes must not decide whether an event can be edited. While they are on
   * their way there is nothing to take along, and a deletion in that window
   * leaves results pointing at an event that is gone, each of them still
   * counting in the standing and linking to a page that says so. The answer is
   * to wait for the one thing the deletion needs rather than for the screen, and
   * to say what is being waited for.
   */
  whyNoRemove?: string
}) {
  const { remove } = useSession()
  const id = String(fieldValue(record, entity.idField))

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

    alsoRemove?.()
    remove(entity.id, id)
  }

  return (
    <span className="entity-row-actions">
      <OpenRecord name={name} onOpen={onOpen} />
      {whyNoRemove === undefined ? (
        <DeleteRecord name={name} onDelete={deleteRow} />
      ) : (
        /* Said rather than drawn and refused. A button that answers nothing is
           worse than no button, and the words are in the row, where anybody
           running the row meets them in the place the second button would be.

           Not a live region. It was one, and there are forty five rows on the
           events screen: forty five regions carrying one sentence, all of them
           changing together the moment the file fails, is forty five identical
           announcements. What is said once is worth saying; said forty five
           times it is noise, which is the rule the event page already keeps
           (resourceScope.test). */
        <span className="entity-row-note">{whyNoRemove}</span>
      )}
    </span>
  )
}

/** The control in a row that opens that row's record. The name of the record is
 *  in the accessible name, so twenty of these are twenty different controls. */
export function OpenRecord({
  name,
  onOpen,
  /**
   * Whether the record is settled and may no longer be opened.
   *
   * Told off rather than switched off, as everywhere else on the portal:
   * `disabled` takes the button out of the tab order and takes with it the
   * sentence saying why it will not open. Only the price list passes it, for the
   * amount a referral brings once the renewal window has opened (owner,
   * 16.08.2026).
   */
  settled = false,
  /**
   * The element that says what this button will and will not do, where a screen
   * writes one. Passed in rather than named here: the sentence belongs to the
   * screen, and a shared button that knows one screen's element by its id says
   * nothing for the other screens and goes stale the moment that one is renamed.
   */
  describedBy,
}: {
  name: string
  onOpen: () => void
  settled?: boolean
  describedBy?: string
}) {
  const { t } = useI18n()

  return (
    <button
      type="button"
      className="entity-open"
      aria-label={t('admin.form.openNamed', { name })}
      aria-disabled={settled}
      aria-describedby={describedBy}
      onClick={() => {
        /* Reachable means pressable, so the refusal lives here as well as in the
           attribute: without it the record opened and the amount could be
           changed after the day it was settled on. */
        if (settled) {
          return
        }

        onOpen()
      }}
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
