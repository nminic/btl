import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { FormRenderer } from '../../forms/FormRenderer'
import { fieldValue, shownValue, textFrom, valuesFor } from '../../forms/records'
import type { FieldError, FieldOption, FormDef, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { plainWords } from '../../forms/worded'
import { useSession } from '../../session/useSession'
import { recordKey } from '../../session/context'
import {
  addressField,
  fieldValues,
  idFor,
  takenAddress,
  type EntityDef,
  type Editing,
} from './entityForms'
import './Entity.css'

/**
 * WHAT A SAVE ENDED IN, WHERE A SCREEN DOES ITS OWN SAVING.
 *
 * <p>Either the identity of the record that was written, or the words to put on the
 * screen instead of the confirmation. Two outcomes and not three, because from this
 * editor's side „the server refused" and „the server wrote it and this screen cannot
 * show it" are one thing: there is no record here to confirm.
 *
 * <p><b>The words are a `ReactNode` and never an answer, a reason or a status.</b> One
 * editor serves seven entities and must not learn what one route can say; the screen
 * that owns the route owns its sentences, which is the same division
 * `pages/account/ServerSaid.tsx` already keeps between a refusal and the table that
 * names it.
 */
export type Saving = { written: string } | { said: ReactNode }

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
  openAt,
  onDone,
  onCreated,
  beneath,
  alsoRefuses,
  steps,
  titleKey,
  save,
  form: drawn,
}: {
  entity: EntityDef
  editing: Editing
  /**
   * WHO WRITES THE RECORD, WHERE IT IS NOT THE SESSION.
   *
   * <p>Six of the seven entities have no route behind them and are still remembered as
   * an overlay on top of what was served (`session/context.ts`), which is the prototype
   * saying out loud that it had no database. The competitions have had routes since
   * B40 and use them from 25.09.2026 (`admin/AdminLeagues.tsx`), so the screen hands in
   * the sending and this editor stops deciding.
   *
   * <p><b>Left out, nothing about the other six moves.</b> That is the condition this
   * was written under and not a nicety: an editor that changed what a member or an event
   * does on save would be six screens' worth of change riding on one competition's.
   *
   * <p><b>It is given what the session write would have been given</b>, both halves: the
   * values as the form holds them, and the same values as text with whatever the entity
   * derives folded in. A screen sending to a route reads the first; a screen that also
   * wants to draw the new row without asking the server again reads the second, because
   * that is the shape `recordsOf` merges.
   *
   * @returns the identity written, or the words to say instead of a confirmation
   */
  save?: (values: FormValues, text: Record<string, string>) => Promise<Saving>
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
  alsoRefuses?: (values: FormValues) => string | undefined
  /** Days the date field offers beside its calendar; only the copy of an event
   *  has any (FormRenderer.tsx). */
  steps?: { label: string; title: string; to: string }[]
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
  /** What the screen's own save said instead of a confirmation, or nothing. */
  const [said, setSaid] = useState<ReactNode>(null)
  /* A press that is still out, held in a ref and not in state. Two presses inside one
     tick would both read a `false` that React has not re-rendered yet, and the second
     would send the same record again and answer this reader about it. The session path
     cannot get here: it writes and confirms inside the press. */
  const asking = useRef(false)
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

  /**
   * What the press knows and the form does not, folded in before anything reads
   * the values.
   *
   * Every reader of the values goes through here, and that is the whole point:
   * the address, the derived text, the confirmation **and the check that refuses
   * a clash** all have to be looking at the same thing. Folded only on the way
   * out and not on the way into the check, the clash was measured against the
   * date somebody typed while the save wrote another: an event moved onto a race
   * of 05/04/2025 was let through as `beogradski-maraton-2027` and filed as
   * `beogradski-maraton-2025`, which the event of 2025 already answers to. Two
   * records on one address, and a result finds its event by the address.
   * Measured 23.08.2026.
   */
  const folded = (values: FormValues): FormValues => alsoFolds?.(values) ?? values

  async function handleSubmit(given: FormValues) {
    const values = folded(given)

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

    /* THE SCREEN'S OWN SAVE FIRST, WHERE THERE IS ONE, and nothing of the session
       happens in that branch - not the counting out of an identity, not the write.
       Both are what a portal without a database did; a route hands back the identity
       the database chose, and a second one counted out here would be a number nothing
       answers to (`admin/raceIds.ts` counts DOWN from nought, so it was `-1`). */
    if (save !== undefined) {
      if (asking.current) {
        return
      }

      asking.current = true
      setSaid(null)

      const outcome = await save(values, text)

      asking.current = false

      /* Nothing is confirmed and the form stays as it was, so whoever pressed still
         has everything he typed and can press again after reading why. */
      if ('said' in outcome) {
        setSaid(outcome.said)

        return
      }

      written = outcome.written

      if (editing.mode === 'new') {
        onCreated?.(written)
      }
    } else if (editing.mode === 'new') {
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
      editRecord(recordKey(entity.id, written), text)
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
        /* Over the folded values, not the typed ones: what is refused has to be
           what would be written (see `folded`). */
        check={(values) => ({
          ...takenAddress(entity, folded(values), others),
          ...also?.(folded(values)),
        })}
        derived={entity.derived}
        openAt={openAt}
        /* What the screen draws between the fields and the button, and what it
           refuses that no field of the form can (forms/FormRenderer.tsx). The
           races of an event are entered there and saved with it. */
        beneath={beneath}
        alsoRefuses={alsoRefuses}
        steps={steps}
        onSubmit={(values) => void handleSubmit(values)}
      />

      {/* What the screen's own save said instead of a confirmation, beneath the form
          the reader is still looking at. Its own element rather than the form's own
          summary, because that one is for what the FIELDS refuse and this is what the
          server did; the words come from the screen that owns the route, so an editor
          serving seven entities says nothing of its own here. */}
      {said}
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
  deleteRecord,
  asksWith,
}: {
  entity: EntityDef
  record: object
  /** What the row is called, for both accessible names. */
  name: string
  onOpen: () => void
  /**
   * WHO TAKES THE RECORD AWAY, WHERE IT IS NOT THE SESSION.
   *
   * <p>The other half of `EntityEditor`'s `save`, and the same division for the same
   * reason: six entities have no route to delete through and are still remembered as an
   * overlay, the competitions have `DELETE /api/leagues/{id}` and use it.
   *
   * <p><b>It replaces the session write and nothing else.</b> The focus still moves to the
   * one control that cannot be the row just pressed, before the answer is back, which is
   * what the six already do and what a reader on a row that is about to vanish needs. A
   * deletion the server refuses is said beside the row, the question closes with the answer,
   * and the row's own „Obriši" takes the focus back from where it was moved ahead of it
   * (`DeleteRecord`, owner 02.10.2026).
   *
   * <p><b>It returns the promise of the deletion, and that is not optional for a route.</b>
   * The question the reader answered stays on the page while the request is out, told off
   * and saying it is sending (owner, 02.10.2026: „Ne", „Odustani" and Escape do nothing
   * while a request is out), and it can only know the request is out if what it was handed
   * gives it something to wait for. A handler written `() => void deleteOne(one)` hands it
   * nothing, so „Odustani" would go on putting the question away over a deletion that goes
   * on - which is exactly what every caller wrote until that day.
   */
  deleteRecord?: () => void | Promise<unknown>
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
   * WHAT ELSE GOES WITH THIS RECORD, SAID WHILE THE QUESTION IS ON SCREEN.
   *
   * <p><b>It was `whyNoRemove` until 28.09.2026, and the change is the owner's</b>
   * (28.09.2026, chosen between three outcomes he was priced). That prop held the
   * deletion BACK while the results were on their way: the events screen took the
   * results down itself, one by one, so a deletion before the file arrived left them
   * pointing at an event that was gone. The route deletes the event in one statement and
   * the schema cascades the rest (`result_race_fk` from the race), so there is nothing
   * left for this screen to wait for - and waiting on the largest file the portal has,
   * to do nothing with it, was the whole of the cost.
   *
   * <p>So the guard became a WARNING rather than a wait: the button works at once, and
   * what it will take with it is said in the question, where somebody who has pressed
   * once still has the second press to think about.
   *
   * <p>Named on the confirming button through `aria-describedby`, so it is read out to
   * whoever arrives there by keyboard rather than being a sentence only the sighted meet.
   */
  asksWith?: string
}) {
  const { remove } = useSession()
  const id = String(fieldValue(record, entity.idField))

  /* The row about to go is where the focus is, so deleting it leaves the focus
     on nothing and the next Tab starts the page from the top. It moves to the
     control that starts a new record, which is the one thing on the screen that
     cannot be the row just deleted; a screen reader announces the move, which is
     also the only word anyone gets that the deletion happened. */
  function deleteRow(): void | Promise<unknown> {
    const anchor = document.getElementById(NEW_RECORD_ID)

    if (anchor !== null) {
      anchor.focus()
    }

    alsoRemove?.()

    if (deleteRecord === undefined) {
      remove(entity.id, id)

      return
    }

    /* HANDED BACK, so the question can wait for the answer (see `deleteRecord`). */
    return deleteRecord()
  }

  return (
    <span className="entity-row-actions">
      <OpenRecord name={name} onOpen={onOpen} />
      <DeleteRecord name={name} onDelete={deleteRow} asksWith={asksWith} />
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
 *
 * <p><b>WHILE THE DELETION IS OUT THE QUESTION CANNOT BE PUT AWAY</b> (owner, 02.10.2026,
 * choosing between three outcomes he was priced; PDL, „Odluke iz ciscenja nalaza", first
 * item). The second press starts a request wherever `onDelete` hands back the promise of
 * it, and from then on „Odustani" would only LOOK as though it took the answer back: the
 * request goes on, and a refusal arriving afterwards was drawn under a question that was no
 * longer there. So both buttons are told off for as long as the promise is pending -
 * `aria-disabled`, and refused in their handlers as well, because it stops nothing by
 * itself - the portal's own sentence for a request that is out is said beside them, and the
 * question goes when the answer comes.
 *
 * <p><b>ANY ANSWER CLOSES IT, AND THE REFUSAL STANDS BESIDE THE BUTTON</b> (owner, 02.10.2026, the
 * second half of the same rule; PDL, „Odbijanje zatvara pitanje kao i uspeh": „na svaki odgovor
 * servera pitanje se zatvara, a razlog odbijanja stoji uz dugme"). A refusal used to leave the
 * question standing with the buttons live again, which put one question in two states according to
 * what the route said - and the portal's own sheet for the activation closed on both. The sentence
 * is the screen's and stays where it draws it, and the focus goes to the button the question came
 * from, because the one that had it went with the question (the activation does the same after a
 * 409). The reader asks again by pressing it again.
 *
 * <p>A deletion that hands back nothing (the session's own, which have nobody to wait for)
 * is not out with anyone: the row leaves in the same render, and the question behaves as it
 * always did. Nothing here handles Escape, so there is no key to refuse.
 */
export function DeleteRecord({ name, onDelete, onKeep, look = 'entity-open', asksWith }: {
  name: string
  /**
   * What the second press does, and whether the reader has to wait for it.
   *
   * <p><b>Hand back the promise of a deletion that goes to the server</b>
   * (`() => deleteOne(one)`, never `() => void deleteOne(one)`): the question tells itself
   * off for as long as that promise is pending. A handler that returns nothing is taken to
   * be finished when it returns.
   */
  onDelete: () => void | Promise<unknown>
  /**
   * Told when the READER puts the question away, and not when it goes by itself: with its
   * record, or because an answer came.
   *
   * <p>A screen that drew something about an earlier attempt - a refusal - takes it back here.
   * The reader who has asked again and then puts the question away has said he does not mean to
   * go on, and the sentence about the last attempt should not outlive that and stand beside a
   * button that has gone back to asking nothing (registry item 311, `pages/TeamDetail.tsx`).
   * The refusal itself is NOT taken back when it closes the question: that sentence is the
   * answer, and it stands beside the button (owner, 02.10.2026).
   *
   * <p><b>Only `TeamDetail` passes it today, and that is a boundary rather than a rule.</b>
   * The lists of the administration and the member's own results draw a refusal beside the
   * row in the same way and do not take it back when the question is put away: the same fault
   * one screen wider, recorded and not fixed with the item that named one screen.
   */
  onKeep?: () => void
  /**
   * WHAT ELSE THIS DELETION TAKES, said between the question and the answer.
   *
   * <p>Owner, 28.09.2026, choosing between three outcomes: the button works at once and
   * the reader is told the number before he confirms. So this is drawn only while the
   * question stands - the row of sixty says nothing until somebody has pressed once,
   * which is the same reason the question itself is two presses rather than a dialogue.
   *
   * <p>Only the events screen passes one. It is optional rather than required because the
   * other three lists take nothing else with them: a moderator, a team and a competition
   * are one row each, and a sentence saying „and nothing else" on every one of them is
   * noise on three screens to be honest on a fourth.
   */
  asksWith?: string
  /**
   * What the three buttons are dressed as.
   *
   * The question is the same wherever it is asked and the dress is not: this
   * began on the rows of the administration and is asked on a member's own
   * results since 27.08.2026, where the buttons stand among `button` controls
   * rather than in a table of records. Written as one component with two looks
   * rather than two components, because what must not be copied is the asking:
   * one press that opens a question, a second that answers it, and every one of
   * the three carrying the name of what is being deleted.
   */
  look?: string
}) {
  const { t } = useI18n()
  const [asking, setAsking] = useState(false)
  /**
   * WHETHER THE DELETION THE SECOND PRESS STARTED IS STILL OUT, as a render can see it - for the
   * two buttons to say so, and for the sentence beside them.
   */
  const [working, setWorking] = useState(false)
  /**
   * AND THE SAME FACT AS A PRESS CAN SEE IT: a ref, because a value set inside the handler is not
   * visible to a second click fired before the render it would cause, and two clicks fired without
   * waiting are what a double press is (`member/Membership.tsx`'s `outstanding` and
   * `admin/Payments.tsx`'s give the same reason). Both buttons refuse a press off this one.
   */
  const outstanding = useRef(false)
  /**
   * WHETHER THE QUESTION WAS LAST CLOSED BY AN ANSWER, so the button that asks it takes the focus the
   * confirming button had. Raised by an answer and lowered by asking again, so it is true only from an
   * answer to the next time the question is asked: the reader putting the question away himself is
   * his own act and moves nothing, as it did before this branch (a gap of its own, and not this
   * change's), and nothing is focused when the page first draws. The effect below depends on the flag,
   * so it runs when the flag CHANGES: lowering it when the question is asked again is what lets the
   * next answer raise it again and run the effect again (`deleteRecord.test.tsx`, „puts the focus on
   * the button again after a second answer").
   *
   * <p><b>A ref and an effect, and NOT `autoFocus`, which was written first and did nothing on four
   * of the seven screens.</b> `autoFocus` acts when an element is CREATED, and the opener is not
   * always a new element: React gives it the confirming button's own, because both are the first
   * button this component draws (same type, no `key`). Measured: where `asksWith` is not given there
   * is nothing before the confirming button, so the element was reused, the attribute changed on an
   * element already in the page, and the focus stayed where it had been moved ahead of the answer
   * (`RowActions`, the members' list). Where it is given, the sentence is the first child and the
   * opener is created, so the same line worked on the events screen. On the team page and the
   * member's own results it only LOOKED right: nothing had moved the focus, so it was still on the
   * very element that became the opener. The effect says where the focus goes whichever way the
   * element came back.
   *
   * <p>And a `key` on the opener would have made it a new element every time, which is the other
   * thing that rides on the reuse: asking the question hands the focus from the opener to „Potvrdi
   * brisanje" because they are one element (`admin/deleting.test.tsx`), and a key would drop it.
   */
  const [afterAnAnswer, setAfterAnAnswer] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)

  /* A LAYOUT EFFECT, so the focus is on the button in the very commit that draws it. A passive one
     runs a task later, after the paint: a reader would see a frame with the focus nowhere, and
     anything that looks the moment the sentence appears - a screen reader, and a test - looks before
     it has moved. */
  useLayoutEffect(() => {
    if (afterAnAnswer) {
      opener.current?.focus()
    }
  }, [afterAnAnswer])
  /* One id per row. Sixty rows sharing one would point every confirming button at the
     first row's sentence, which is the same fault an `id` written out by hand always
     has on a list (`OpenRecord`, `describedBy`, says it one control along). */
  const saying = useId()

  if (!asking) {
    return (
      <button
        type="button"
        className={`${look} entity-delete`}
        aria-label={t('admin.form.deleteNamed', { name })}
        ref={opener}
        onClick={() => {
          setAfterAnAnswer(false)
          setAsking(true)
        }}
      >
        {t('admin.form.delete')}
      </button>
    )
  }

  return (
    <>
      {/* Before the buttons rather than after them, so it is read on the way to the
          one that cannot be undone rather than behind it. */}
      {asksWith !== undefined && (
        <span className="entity-row-note" id={saying}>
          {asksWith}
        </span>
      )}
      <button
        type="button"
        className={`${look} entity-delete entity-delete--sure`}
        aria-label={t('admin.form.deleteSureNamed', { name })}
        /* So whoever arrives here by keyboard is told what goes with it. Named
           through the element rather than folded into the label, because the label
           is what tells twenty of these buttons apart and a number in it would make
           two rows with the same count read as one control. */
        aria-describedby={asksWith === undefined ? undefined : saying}
        /* TOLD OFF WHILE ITS OWN DELETION IS OUT, not switched off: the control a reader pressed
           has the focus (or had it, where `RowActions` has moved it on), and `disabled` would
           take it out of the tab order. */
        aria-disabled={working ? true : undefined}
        onClick={() => {
          /* Reachable means pressable, so the refusal lives here as well as on the attribute. A
             second press while the first is out would send a second deletion, which the route
             answers 404 - and the reader is then told his first one failed. */
          if (outstanding.current) {
            return
          }

          const answer = onDelete()

          /* A handler that hands back nothing has nothing to wait for. A promise is a deletion
             that is out, and it is let go of when it settles, whichever way it did. */
          if (!(answer instanceof Promise)) {
            return
          }

          outstanding.current = true
          setWorking(true)

          /* THE QUESTION CLOSES HERE, ON ANY ANSWER AND NOT BEFORE (owner, 02.10.2026): with the
             request out nothing the reader presses puts it away, so this is the one road by which it
             goes once „Potvrdi brisanje" has been pressed. A success takes the row, and this component
             with it, in the same breath; a refusal leaves the row, the sentence the screen drew, and
             the button this question came from - which takes the focus, because the one that had it is
             gone. */
          void answer.finally(() => {
            outstanding.current = false
            setWorking(false)
            setAsking(false)
            setAfterAnAnswer(true)
          })
        }}
      >
        {t('admin.form.deleteSure')}
      </button>
      <button
        type="button"
        className={look}
        aria-label={t('admin.form.keepNamed', { name })}
        aria-disabled={working ? true : undefined}
        onClick={() => {
          /* PUT AWAY ONLY WHEN NOTHING IS OUT (owner, 02.10.2026): with the deletion on its way
             this would say „I took it back" over a request that goes on. */
          if (outstanding.current) {
            return
          }

          setAsking(false)
          onKeep?.()
        }}
      >
        {t('admin.form.keep')}
      </button>
      {/* SAID IN WORDS, ONLY WHILE IT IS TRUE (WCAG 2.2 AA, 4.1.3), in the portal's own sentence
          for a request that is out: `results.sending` is read by the two forms that send a
          result and four other keys carry the same words, so nothing new was written. */}
      {working && (
        <span className="entity-row-note" role="status">
          {t('results.sending')}
        </span>
      )}
    </>
  )
}
