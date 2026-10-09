import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { useTodayDate } from '../clock/useClock'
import { useI18n } from '../i18n/useI18n'
import { RequiredMark, RequiredNote } from './AskedLabel'
import { FieldHint } from './FieldHint'
import { heldControl } from './held'
/* `plainWords` went with the summary of errors on 28.09.2026: it was here to write a
   field's name into a link without the star and without a link inside the link, and
   there is no such list any more. It is still exported, and `pages/admin/EntityEditor.tsx`
   still reads it. */
import { worded } from './worded'
import { LongBox } from './LongBox'
import type {
  DerivedField,
  FieldDef,
  FieldError,
  FieldOption,
  FormDef,
  FormValues,
  Suggestion,
  UnreadableList,
} from './types'
import { CountryOptions } from './CountryOptions'
import { DatePicker } from './DatePicker'
import { PlaceField } from './PlaceField'
import { Suggesting } from './Suggesting'
import { optionsFor, storedDates, storedNumbers } from './records'
import {
  asAsked,
  emptyValues,
  isVisible,
  REQUIRED_KEY,
  trimValues,
  validateForm,
} from './validate'
import './FormRenderer.css'

type Props = {
  form: FormDef
  /**
   * What the form sends, and beside it the fields that only agree with another one.
   *
   * <p><b>Two arguments and not one, and the second exists for exactly one reader.</b>
   * `onScreen` below drops every field carrying `matches`, and says in its own words
   * why: a secret sent twice is a second home for it. That reasoning is about what the
   * portal puts in a body **by default**, and it still holds for every form here. But
   * `/api/registration` asks for `passwordRepeat` by name
   * (`WhatRegistrationAsksFor.OF_EVERYBODY`), so with one argument this component
   * cannot produce a body that route accepts at all.
   *
   * <p><b>Why the second argument rather than sending the first password twice.</b>
   * That was weighed and refused: the server's comparison would become theatre, and
   * the day somebody breaks the agreement rule in the form, nothing would catch it.
   * `NewPassword.tsx` calls that very move a mistake, in as many words, and that
   * sentence stands. What a person actually typed is what travels.
   *
   * <p><b>Nothing else on the portal is moved by this, and that is measured rather
   * than asserted.</b> The second argument is additive: a handler declaring one
   * parameter is assignable here and is handed the extra one it never reads. The
   * floor is in `FormRenderer.test.tsx`, which walks `FORMS` - every definition this
   * portal has - and demands the second argument be **empty** for each form that has
   * no `matches` field. Eleven of the twelve are empty today, so no other caller can
   * see a difference, and a thirteenth form that grows such a field arrives as a red
   * gate rather than as a body somebody has to notice.
   *
   * <p><b>And both are handed over in the shape the SERVER reads, not the shape the screen
   * spells.</b> A date leaves as yyyy-mm-dd and a number with a dot, whatever was typed:
   * owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza"), the conversion of a
   * date has one place for every form and the portal sends a number with a dot. That place is
   * here, at the one door every form leaves by (`records.ts`, `storedDates` and
   * `storedNumbers`), so a screen reads the day it is handed and converts nothing itself.
   * Everything else arrives as it was typed, trimmed. What a screen is asked WHILE the form is
   * open - `check`, `alsoRefuses`, `derived`, `beneath` - still reads what is on the screen.
   */
  onSubmit: (values: FormValues, agreeing: FormValues) => void
  /**
   * What the screen draws between the fields and the button that sends them.
   *
   * The races of an event are entered in a table under its form and saved with it
   * in one press (owner, 23.08.2026), so the button has to stand under them: put
   * above, it reads as belonging to the fields alone and the table under it as
   * something else again. Handed in rather than built here, because a form knows
   * fields and nothing else.
   */
  beneath?: (values: FormValues) => ReactNode
  /**
   * What the screen draws between the heading and the first field.
   *
   * Handed in for one reason only: a page has one first level heading and it has
   * to be the first thing on the page. Drawn by the screen instead, whatever the
   * screen puts above the form stands above that heading, so a reader working by
   * ear meets a file field before learning which page they are on, and the page
   * has no heading at its start at all (WCAG 2.2, 1.3.1 and 2.4.6; owner,
   * 01.09.2026). Two screens did that: the proposal of a team and the reporting
   * of a result.
   *
   * Not a function of the values, unlike `beneath`: what stands here explains the
   * form rather than answering it.
   */
  above?: ReactNode
  /**
   * A refusal that belongs to the screen rather than to any field of the form.
   *
   * Answers with what to say, or nothing where there is nothing to refuse. What
   * is beneath the form may be as unfinished as a field is, and the press has to
   * stop for it the same way: a row of a race with no distance is not a race, and
   * saving the event without it would file a morning that has nothing running on
   * it.
   */
  alsoRefuses?: (values: FormValues) => string | undefined
  /**
   * Days the date field offers beside its calendar, each a button that writes one.
   *
   * Only the copy of an event has any: next season and a week on (owner,
   * 23.08.2026). Handed in rather than read from the definition, because which days
   * they are depends on the record being copied and a definition knows no records.
   */
  steps?: { label: string; title: string; to: string }[]
  /** What the fields start out holding. Empty when nothing is handed in, which
   *  is a form that creates something rather than one that changes it. */
  initial?: FormValues
  /**
   * Words for the heading, when the form is a screen inside a screen rather than
   * the screen itself. Then it is a second level heading under the name of the
   * list it was opened from, because a page has one first level heading.
   */
  title?: string
  /** Choices for selects whose list is data: the events a race can belong to,
   *  the members who can run a team. Keyed by field name. */
  options?: Record<string, FieldOption[]>
  /**
   * Lists to type against, keyed by field name.
   *
   * Not the same thing as `options`, which is a closed list a select is answered
   * from: this is what the portal already holds, offered while somebody types
   * something they may also type freely. Choosing an entry fills the fields it
   * names and locks them; typing again breaks that and hands them back.
   *
   * <p><b>A field's list is its rows, or the way it failed to come</b> (decision of 03.10.2026,
   * `forms/types.ts`, `UnreadableList`): a list that could not be read is not handed in as an empty
   * one, because an empty list looks like a calendar with nothing in it. The field then says so
   * under its box, with a button that asks again, and goes on taking whatever is typed into it.
   * One prop and not two, so a field cannot be given both and the box is the same box on either
   * side of the failure: it is not replaced, and the keyboard on it is not lost, when the list
   * comes.
   *
   * <p><b>A held box says nothing</b> (`fixed`): nothing is typed into it, so a list is of no use to
   * it and a button that asks for one would offer something that cannot be used. That is the
   * coordinator's reading and not a recorded decision.
   */
  suggests?: Record<string, Suggestion[] | UnreadableList>
  /**
   * Fields this form must not let anybody change, whatever they do.
   *
   * `led` beside it is the same idea reached from inside: a field filled in by
   * choosing an entry from a list is not the reader's to alter. This is the same
   * lock decided by the caller instead, for a form that is one thing on one
   * screen and another on the next.
   *
   * Two callers hand any. Correcting a result may change everything about it except
   * which race it was run in (owner, 27.08.2026: „sve osim trke"), because a
   * correction keeps the identity of the submission a moderator has already seen;
   * whoever picked the wrong race deletes it and enters another. And the editor of an
   * event holds every field of it while its races wait and while its save is out
   * (`pages/admin/EntityEditor.tsx`, `fixed` and `holdsWhileSaving`).
   */
  fixed?: string[]
  /**
   * WHETHER THE BUTTON THAT SENDS IS HELD, as a render can see it: a send of the screen's own is out
   * and the press waits for it.
   *
   * <p>Owner, 05.10.2026, chosen between offered outcomes (PDL, P6, „Dok čuvanje događaja traje", the
   * last decision of the block; the wording was offered to him and the choice is his): the button that
   * sends waits while the save lasts, the way „Nazad na spisak" and the buttons of 02.10.2026 do. Held
   * the way the portal holds every control that cannot act and is not switched off: `aria-disabled`, the
   * dress of a held control (`FormRenderer.css`), and a refusal in the handler as well (`sendIsOut`),
   * because the attribute stops nothing by itself. It stays in the order of focus: switched off, it would
   * take with it the focus the press gave it.
   *
   * <p><b>`undefined` and not `false` when it is not held</b>, so a button that waits for nothing carries
   * no such word at all. The sentence that says why is the screen's (`results.sending`, under the form).
   *
   * <p><b>Only the events hold it today, and left out nothing about any other form moves</b>, which is
   * the condition `fixed` was written under as well: every other form draws this button as it always did.
   */
  sendIsHeld?: boolean
  /**
   * AND THE SAME FACT AS A PRESS CAN SEE IT: a ref the screen sets in the tick its send begins and
   * clears in the tick its last answer comes, whatever the answer is.
   *
   * <p><b>Read at the press and never at the render.</b> A press in the very tick the send began in finds
   * the render not drawn yet, so `sendIsHeld` is still false and the attribute is not there; the ref is
   * already true. The press is refused above everything the form asks (its rules, the screen's `check`,
   * `alsoRefuses`), which is the point: an event that has just been taken is in the screen's list by the
   * time its races are on the way, and a second press that asked whether the event's address is free
   * answered „Događaj sa tim nazivom već postoji te godine" over a request that was going well, and took
   * the cursor to the date (measured, PDL P6, 05.10.2026). A press that waits is not asked anything.
   *
   * <p>Given together with `sendIsHeld`, from the same two facts the screen already keeps for its other
   * controls (`EntityEditor`'s `asking` and `working`): this is the ref and that is the state, and the
   * two are cleared in one place.
   */
  sendIsOut?: RefObject<boolean>
  /**
   * A rule the definition cannot describe, checked when the form is submitted
   * and returned in the same shape as the rules that can: errors by field name.
   * Used for the one rule that needs to know about the other records, which is
   * whether the identity typed in is free (PDL P8).
   */
  check?: (values: FormValues) => Record<string, FieldError>
  /** Values the form shows but does not ask for, because they are read off the
   *  ones it does ask for. They follow the fields as words. */
  derived?: (values: FormValues, was?: Record<string, unknown>) => DerivedField[]
  /**
   * The record being changed, where there is one.
   *
   * Only for the derived values, which are not all a function of the fields
   * alone: the address of an event stays as it was written unless the name or
   * the year has changed, so the form cannot show what a save will leave behind
   * without knowing what it started from (entityForms.ts, `addressOfEvent`).
   */
  was?: Record<string, unknown>
  /**
   * The field the cursor starts in, by name.
   *
   * For the one case where the form is opened at something rather than by
   * somebody: copying an event fills every field from the one it was copied
   * from, and the date is the one thing that is certainly wrong (owner,
   * 03.08.2026). Left out everywhere else, because a form that grabs the cursor
   * is a form that has taken the page away from whoever opened it.
   */
  openAt?: string
}

/** Whether what is wrong about a place is the country rather than the town. */
function aboutCountry(error: FieldError | undefined): boolean {
  return error?.key === 'form.errors.countryMissing'
}

/** Everything but the names given, which is the one shape both the values and the
 *  errors of a form are narrowed by. */
function outside<T>(names: string[]): (current: Record<string, T>) => Record<string, T> {
  return (current) =>
    Object.fromEntries(Object.entries(current).filter(([name]) => !names.includes(name)))
}

/** Whether somebody put this there, as against the nothing every field starts life
 *  holding (`emptyValues`). Asked of the state rather than of the drawn value: the
 *  drawn value is never missing, because the definition supplies a blank for every
 *  field the form has. */
function holds(value: string | boolean | undefined): boolean {
  return value !== undefined && value !== ''
}

/**
 * How a box somebody types into is drawn: its type, and the keyboard a telephone offers for it.
 *
 * <p><b>A number is a TEXT box, on purpose and for a measured reason.</b> A `type="number"` box
 * in a Serbian browser refuses the comma Serbian writes a decimal with and reports what it
 * refuses as an empty value, so the member read „21,1" in the box and „Ovo polje je obavezno."
 * under it. Owner, 02.10.2026: „Polje za broj prima i zarez i tacku, a portal salje tacku."
 * What the box takes is decided by `numberField.ts` instead, and the keyboard by `inputMode`,
 * which is the shape `pages/admin/Payments.tsx` drew its amount in first, for the same reason.
 *
 * <p><b>And a whole number is offered digits alone</b>, because a field the server keeps whole
 * refuses a separator (`types.ts`, `integer`): a keyboard that offers one is a keyboard that
 * invites the refusal.
 */
function boxFor(field: FieldDef): { type: string; inputMode: 'decimal' | 'numeric' | undefined } {
  if (field.type !== 'number') {
    return { type: field.type, inputMode: undefined }
  }

  return { type: 'text', inputMode: field.integer === true ? 'numeric' : 'decimal' }
}

/** A field beside the value it is holding, which is what the form draws. */
type Drawn = { field: FieldDef; value: string | boolean }

/**
 * How wide a row is, counted in columns rather than in fields.
 *
 * A town counts as two, because it carries the country beside it and the two are
 * two controls: „Adresa, Mesto, Država" is three columns and two fields.
 *
 * <p><b>And never narrower than the form itself asks for.</b> A form may declare
 * a width every one of its rows has (`types.ts`, `FormDef.columns`), which is
 * how a row of two fields leaves a third of the line empty rather than becoming
 * two halves. Owner, 28.09.2026, three times over: „Treća kolona je prazna".
 *
 * <p>The larger of the two rather than the declared one, so the number on the
 * form is a FLOOR. A row that outgrows it keeps the width it needs, instead of
 * having its last field pushed onto a second line by a number written elsewhere
 * and for another row.
 *
 * <p>`declared` is a number and never nothing: a form that names no width is
 * read as nought before this is called, where a form that names none is really
 * drawn. See `floor` in the component.
 */
function columnsOf(fields: Drawn[], declared: number): number {
  return Math.max(
    declared,
    fields.reduce((so, one) => so + (one.field.type === 'place' ? 2 : 1), 0),
  )
}

/**
 * The fields grouped into the rows the definition puts them on.
 *
 * Fields that name the same row stand together on a screen wide enough for it
 * (owner, 11.08.2026, for the registration form); everything else keeps a row of
 * its own. Grouped by walking the list in order rather than by collecting every
 * field that carries the same number, so a row is a run of neighbours: two
 * fields far apart in the definition that happen to share a number are two rows,
 * and what is on screen is always in the order of the file.
 */
type Row = { row: number | undefined; fields: Drawn[]; key: string }

type Group = { groupKey: string | undefined; rows: Row[]; key: string }

/**
 * The rows gathered into the groups the definition puts them in.
 *
 * The same walk as `rowsOf`, one level up: a group is a run of neighbouring
 * ROWS whose fields name the same group, so a group never reaches across a row
 * it does not hold and what is on screen stays in the order of the file.
 *
 * A group is named after the row it begins with, for the reason `rowsOf` gives
 * about keys: two groups may carry one name once a field is moved between them,
 * and two siblings keyed alike are two React cannot tell apart.
 *
 * Read off the FIRST field of each row rather than off the row: a row belongs
 * to one group, and `everyFieldIsInAGroup` in `fieldHint.test.tsx` is what says
 * so about the definition rather than leaving it to be assumed here.
 */
function groupsOf(rows: Row[]): Group[] {
  const groups: Group[] = []

  for (const one of rows) {
    const groupKey = one.fields[0]?.field.groupKey
    const last = groups.at(-1)

    if (last !== undefined && last.groupKey !== undefined && last.groupKey === groupKey) {
      last.rows.push(one)
    } else {
      groups.push({ groupKey, rows: [one], key: one.key })
    }
  }

  return groups
}

function rowsOf(drawn: Drawn[]): Row[] {
  const rows: Row[] = []

  for (const one of drawn) {
    const last = rows.at(-1)

    if (last !== undefined && last.row !== undefined && last.row === one.field.row) {
      last.fields.push(one)
    } else {
      /* Named after the field it begins with, and not after the number of the
         row. Two groups may carry one number, since a row is a run of
         neighbours: moving a field between two that share a number splits them
         into two rows, and two rows keyed alike are two siblings React cannot
         tell apart. A field appears once on a form, so the field it begins with
         names it once. */
      rows.push({ row: one.field.row, fields: [one], key: one.field.name })
    }
  }

  return rows
}

/* One field, drawn again only when something about that field changed.
 *
 * A form keeps all its values in one place, so without this every keystroke
 * redraws every field on the form. That is free on a form of eight text boxes and
 * it is not free on the race form, whose one select offers all twelve hundred
 * events: typing a race name rebuilt twelve hundred options per letter. It is the
 * administrator who pays for that, in a browser, with a form that answers late.
 *
 * What it takes is that the props hold still: the change handler is made once by
 * the form (rather than per field per render), the choices for a field that has
 * none are one shared empty list (src/forms/records.ts), and everything else a
 * field is given is either its own value or its own error.
 */
const Field = memo(function Field({
  field,
  value,
  beside,
  error,
  choices,
  onChange,
  open = false,
  locked = false,
  steps,
  suggesting,
}: {
  field: FieldDef
  value: string | boolean
  /**
   * The country a place field writes beside itself.
   *
   * Handed in rather than read here, because a field is drawn again only when
   * something about that field changed and this is the one value that belongs
   * to a field without being its own. Every field on the form is given it and
   * only a place field reads it; on a form with no place there is nothing to
   * give and it is empty.
   */
  beside: string
  error: FieldError | undefined
  choices: readonly FieldOption[]
  onChange: (field: FieldDef, value: string | boolean, also?: Record<string, string>) => void
  /** Whether the cursor starts here. One field on one form ever does. */
  open?: boolean
  /**
   * Whether this field was filled from a record rather than by the reader.
   *
   * Then it takes nothing: the four measurements of a race come off the race,
   * and a reader who could edit them would be filing a time against a distance
   * the calendar does not have. The way out is the field they came from: editing
   * the name breaks the link and hands all four back (FormRenderer below).
   */
  locked?: boolean
  /** Days the date box offers beside its calendar, where the screen has any to
   *  offer. Only a date field is ever given them. */
  steps?: { label: string; title: string; to: string }[]
  /** The list this field is typed against, where it has one, and what to do with
   *  what is typed and what is chosen (forms/Suggesting.tsx). */
  suggesting?: {
    list: readonly Suggestion[]
    /** Present only where the list could not be read (see `suggests` on the form). */
    unreadable?: UnreadableList
    onType: (next: string) => void
    onChoose: (one: Suggestion) => void
  }
}) {
  const { locale, t } = useI18n()
  /* How many times the picture has been thrown away, which is the whole of what
     this counts. A file input holds its own copy of what was chosen and nothing
     but the browser may write to it, so emptying our value leaves the name of
     the file standing beside an empty field. Drawn again under a new key, the
     browser builds a new box and its copy goes with the old one. */
  const [cleared, setCleared] = useState(0)
  const putBack = useRef(false)
  const change = useCallback(
    (next: string | boolean) => {
      /* A locked control stays reachable, so it can still be pressed; what it must
         not do is change. `readOnly` says that in markup for a box somebody types
         into, and a `select`, a checkbox and a radio have no such attribute, so the
         refusal is written once here for all of them. */
      if (locked) {
        return
      }

      onChange(field, next)
    },
    [field, locked, onChange],
  )
  const inputId = `field-${field.name}`
  const hintId = `${inputId}-hint`
  const labelId = `${inputId}-label`
  const errorId = `${inputId}-error`
  const leftId = `${inputId}-left`
  /* The room left is described by the field rather than merely printed under it.
     Printed under it, it is read by whoever can see it and by nobody else: a
     screen reader announces the label, the rule and the error on focus, and the
     one number that says how much of the box is already spent was not among
     them. It is last of the three, because the count is the detail and the rule
     is what the field is for. */
  const describedBy = [
    /* Only where one is drawn, which is what `hintKey` already answers: a field
       answered by buttons or by a tick carries no rule since 31.08.2026, so there
       is none of them to name. Written as a second condition it would be a test
       nothing can fail. */
    field.hintKey ? hintId : '',
    error ? errorId : '',
    field.type === 'textarea' && field.maxLength !== undefined ? leftId : '',
  ]
    .filter(Boolean)
    .join(' ')

  /* Said to the control and not only to the eye. The star beside the name is
     drawn for whoever can see it and is kept out of what is read aloud
     (`RequiredMark`), so without this a screen reader was told nothing at all:
     the legend over the form says fields with a star are obligatory, and there
     is no star in the accessibility tree to find. `aria-required` and not the
     native `required`, because the form is `noValidate` and answers for its own
     rules (`validate.ts`); the native attribute would put the browser's own
     bubble on top of the portal's error, in the browser's language. */
  const asked = field.required === true ? true : undefined

  const shared = {
    id: inputId,
    name: field.name,
    'aria-required': asked,
    'aria-invalid': error !== undefined,
    'aria-describedby': describedBy === '' ? undefined : describedBy,
    /* And a held control wears the portal's one dress for a control that is
       reachable and will not answer. This is where three of the four fields a
       race fills in actually live: `led` locks the date, the length, the climb and
       the fall (`pages/member/NewResult.tsx`), and until 28.08.2026 all four
       carried the plain class.
     *
       **Three and not four**, which a review counted on 28.08.2026 after this was
       written claiming all of them: the date is not drawn from here at all but by
       `forms/DatePicker.tsx`, which writes its own class and never sees this
       object, and the date beside them is drawn by `DatePicker.tsx`, which never
       saw this set: three fields went grey and the fourth still looked like a box
       somebody may type into, while carrying `aria-disabled` and `readOnly` like
       the rest. Measured by a review that day in Chrome over the built
       stylesheet: the difference between the whole computed style of a locked
       date and a live one was the empty set, down to the same background and the
       same text cursor. `disabled` had made exactly one visible difference and
       the move to `aria-disabled` took it away without putting anything in its
       place. Closed on 29.08.2026 by giving the class one home (`forms/held.ts`)
       and the rule one home (`FormRenderer.css`), so a fifth control cannot be
       drawn without one. */
    className: heldControl(locked === true),
    autoFocus: open,
    /* Held, not switched off (PDL: „Odbijeno, ne ugaseno", and the same argument
       is written out in `PlaceField.tsx` beside the country).
     *
       `disabled` takes a control out of the keyboard's path, so whoever reads by
       keyboard never reaches it and is never told why. Measured on 23.08.2026 on
       the real `unos-rezultata`: choose a race from the list and Tab goes from
       „Naziv dogadjaja" straight to „Sati", with the date, the length, the climb
       and the fall all skipped and nothing said about any of them.
     *
       And these four are not refused at all. They are **filled by the portal from
       the race**, which is what `readOnly` says of a box somebody types into: still
       reachable, still read out, still copied, and not the reader's to change.
       `aria-disabled` beside it is what a screen reader announces, and `change`
       above is what refuses the ones that have no `readOnly` of their own.
     *
       `undefined` and not `false`, so a control that is not locked carries no
       attribute at all: one more thing in the markup is one more thing for a test
       to read as a decision somebody made. */
    'aria-disabled': locked ? true : undefined,
    /* And the same refusal in markup, on the shared set rather than on one branch
       of it. `change` below refuses a locked control, but a field typed against a
       list does not go through `change`: it hands what is typed straight to its
       own `onType` (`Suggesting`), so a locked race name announced itself as
       locked and took a new name anyway. Measured by a review on 27.08.2026,
       through the real screen: the box said `aria-disabled` and still read „Sasvim
       druga trka". `readOnly` is what says it to the browser, and it is the same
       word the four filled-in fields already wear. */
    readOnly: locked ? true : undefined,
  }

  if (field.type === 'checkbox') {
    return (
      <div className="field field--checkbox">
        <div className="field__confirm">
          {/* The box stands before the words it confirms, never after them. */}
          <input
            {...shared}
            type="checkbox"
            checked={value === true}
            onChange={(e) => change(e.target.checked)}
          />
          {/* The words, the star, and the letter that explains them, all in a
              head of their own. Left outside a head the letter became an item of
              the field's own column and fell to a line under the sentence, where
              ten other fields carry it beside their name; the group of buttons
              was rebuilt for the same reason. The head is also what the open
              rule is measured from, so this one is not an ornament
              (FieldHint.css). */}
          <span className="field__head field__head--confirm">
            <label className="field__label" htmlFor={inputId} id={labelId}>
              {worded(t(field.labelKey), field, locale, t)}
              {/* Both halves of the rule, as on every other kind of field: a
                  star where it has to be answered and the word where it may be
                  left alone. This branch was given the star alone, so a
                  confirmation that is not obligatory was the one field on the
                  portal that said nothing either way. */}
              {field.required !== true && (
                <span className="field__optional"> ({t('form.optional')})</span>
              )}
            </label>
            {field.required === true && <RequiredMark />}

            {/* And no rule beside a box that is ticked. It was drawn here, in a
                head of its own for the same reason the group of buttons has one;
                on 31.08.2026 the owner kept seven rules on the whole portal and
                none of them belongs to a field of this kind, so what was left was
                the ability to draw one that nothing asks for. Taken out with the
                rules themselves, the way the group's was, and the reason the head
                exists is written above so it is not learned again. */}
          </span>
        </div>

        {error !== undefined && (
          <p className="field__error" id={errorId}>
            {t(error.key, error.params)}
          </p>
        )}
      </div>
    )
  }

  if (field.type === 'choice') {
    return (
      <div className="field field--choice">
        <span className="field__head">
          {/* The name of the group, and nothing but the name: a rule written
              into it would be read out before every one of the buttons. */}
          <span className="field__label" id={labelId}>
            {worded(t(field.labelKey), field, locale, t)}
            {field.required !== true && (
              <span className="field__optional"> ({t('form.optional')})</span>
            )}
          </span>
          {field.required === true && <RequiredMark />}

          {/* And no rule beside the name of a group. It used to be drawn here,
              deliberately out of a `<legend>` so that the three fields answered by
              buttons would not be laid out unlike the other eight (11.08.2026);
              on 31.08.2026 the owner kept seven rules on the whole portal and none
              of them belongs to a group, so what is left is the ability to draw
              one that nothing asks for. Taken out with the rules themselves: if a
              group is ever to carry one again, it is written again, and the reason
              a `<legend>` was refused is recorded here. */}
        </span>

        {/* Buttons to look at and radio buttons to work: nothing is chosen to
            begin with, exactly one can be, and the arrow keys walk the group the
            way they walk every other one on the web. Inputs with labels rather
            than `<button aria-pressed>`, because a pressed button is a switch
            and this is a choice: a reader is told „2 of 2" and which one it is
            standing on. */}
        {/* The group is the buttons and nothing else.
         *
           Not a `<fieldset>`: a `<legend>` is laid out by rules of its own that
           no browser lets a grid touch, so the letter that explains the group
           could never stand beside its name the way it does on every other
           field. `role="radiogroup"` with `aria-labelledby` says the same thing
           to a screen reader, and more exactly than a fieldset does, which is a
           plain group.

           Around the buttons alone, because a radiogroup may hold radios and
           nothing else: around the whole field it held the letter and the line
           of the error as well.

           And it takes the cursor when a press is refused over it: every other
           field is reached through its own control, a group has no one control,
           so the group is what the cursor is put on, and that is why it carries
           `tabIndex={-1}`. ~~It carries the id the summary of errors links to.~~
           The summary went on 28.09.2026 and the cursor took over its job; the id
           stays because `forms/choiceControl.test.tsx` finds the group by it, and
           because a control group with no name in the document is a thing nothing
           can point at. Sex and category are the two things nothing is chosen for,
           so they are the likeliest errors on this form. */}
        <div
          className="choice"
          role="radiogroup"
          aria-required={asked}
          aria-labelledby={labelId}
          /* The error, on the group as well as on the buttons, and a group that
             says only „Pol" does not say what is wrong with it. */
          aria-describedby={error === undefined ? undefined : errorId}
          /* AND THE MARK ON THE GROUP TOO, WHICH IS WHAT PUTS THE CURSOR HERE
             RATHER THAN ON THE FIRST BUTTON. The cursor is found by asking the
             document for the first control marked wrong (`owed`, above), and the
             group stands before its buttons in the document, so marking it is the
             whole of how a choice is reached. Marked only on the buttons, the
             reader landed on „Muški" and heard one option out of two before he
             heard what the question was. */
          aria-invalid={error !== undefined}
          id={inputId}
          tabIndex={-1}
        >
          {choices.map((option) => (
            <span className="choice__one" key={option.value}>
              <input
                type="radio"
                id={`${inputId}-${option.value}`}
                name={field.name}
                className="choice__input"
                value={option.value}
                checked={String(value) === option.value}
                /* The lock reaches these too. `shared` carries it for every other
                   kind of control and this branch is written before `shared` is
                   used at all, so a suggestion that filled a group of buttons
                   would have locked nothing while the form said it had. Nothing
                   fills one today; a lock that is an ornament is worse than none,
                   because the screen says the value cannot be changed. */
                aria-disabled={locked ? true : undefined}
                aria-invalid={error !== undefined}
                /* The rule and the error on every button, and both on the
                   group around them as well.
                 *
                   `aria-describedby` is not inherited, and a description is read
                   for whatever holds the focus. There are two ways to arrive:
                   the keyboard walks the form and lands on a button, and the
                   summary of errors leads to the group itself. Said in only one
                   of the two, whoever came the other way heard „Pol, Muški, nije
                   izabrano" and nothing about the rule or about what is wrong,
                   and „Početnička" against „Starosna" carries a decision that
                   cannot be undone mid-season (PDL P7). Said in both, it is read
                   on both roads. The price is that a reader which speaks the
                   name and description of a group on entering it may say the
                   error twice, once for the group and once for the button; the
                   alternative was that somebody walking the form never heard it
                   at all, and that is the worse of the two. */
                aria-describedby={describedBy === '' ? undefined : describedBy}
                onChange={() => change(option.value)}
              />
              <label className="choice__label" htmlFor={`${inputId}-${option.value}`}>
                {t(option.labelKey)}
              </label>
            </span>
          ))}
        </div>

        {error !== undefined && (
          <p className="field__error" id={errorId}>
            {t(error.key, error.params)}
          </p>
        )}
      </div>
    )
  }

  return (
    /* The town carries the country beside it, so where a row has three columns
       this field is two of them (FormRenderer.css). */
    <div className={field.type === 'place' ? 'field field--place' : 'field'}>
      {/* The name of the field and, beside it, the rule it carries. Beside and
          not inside: everything inside a label is the name of the field, so a
          rule put there is read out as part of it, and „Mejl" becomes „Mejl, na
          njega stiže veza za potvrdu, i njime se kasnije prijavljuješ". */}
      <span className="field__head">
        <label className="field__label" htmlFor={inputId} id={labelId}>
          {/* And a link inside the words where the words carry one, the same on
              every kind of field: it was written only into the confirmation,
              which is the one field that has one today, so a link put on any
              other was dropped without a word. */}
          {worded(t(field.labelKey), field, locale, t)}
          {field.required !== true && (
            <span className="field__optional"> ({t('form.optional')})</span>
          )}
        </label>
        {field.required === true && <RequiredMark />}

        {field.hintKey !== undefined && (
          <FieldHint id={hintId} text={t(field.hintKey)} of={labelId} />
        )}
      </span>

      {field.type === 'country' && (
        <select {...shared} value={String(value)} onChange={(e) => change(e.target.value)}>
          {/* „Izaberi" comes with the list, since the list is the one that knows
              whether the code it was handed is one it can name
              (forms/CountryOptions.tsx). Written here as well, every country
              select that opened unanswered began with the same word twice. */}
          <CountryOptions holding={String(value)} />
        </select>
      )}

      {field.type === 'photo' && (
        /* The box and, once there is something in it, the way out of it (owner,
           23.08.2026: „Slika treba da ima dugme Obrisi na kraju reda, jer
           trenutno ne mogu da odustanem od slanja slike"). Drawn only where there
           is a picture, because a button that undoes nothing is a button that
           says something was done. */
        <span className="field__photo">
          <input
            {...shared}
            key={cleared}
            ref={(node) => {
              if (node !== null && putBack.current) {
                putBack.current = false
                node.focus()
              }
            }}
            type="file"
            accept="image/*"
            onChange={(e) => change(e.target.files?.[0]?.name ?? '')}
          />

          {String(value) !== '' && (
            <button
              type="button"
              className="button button--secondary button--compact field__clear"
              onClick={() => {
                /* The box is remounted in the same stroke (`key` above) and the
                   button itself stops being drawn, so the cursor would fall to the
                   document and a screen reader would read that as leaving the form
                   (WCAG 2.2 SC 2.4.3). Measured on 23.08.2026: after the press,
                   `document.activeElement` was `<body>`. It goes back onto the box
                   the button just emptied, which is what the reader was working
                   on. */
                putBack.current = true
                setCleared((was) => was + 1)
                change('')
              }}
            >
              {t('form.clearPhoto')}
            </button>
          )}
        </span>
      )}

      {field.type === 'select' && (
        <select {...shared} value={String(value)} onChange={(e) => change(e.target.value)}>
          {/* Only while there is no answer. It is there so a required select
              cannot be left unanswered by accident; on a field the form opens
              already holding one (`EVENTS.start`), it is a first entry nobody
              can ever want, standing above the two that are the whole question:
              „Izaberi", „Ne", „Da". */}
          {String(value) === '' && <option value="">{t('form.choose')}</option>}
          {choices.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      )}

      {field.type === 'textarea' && (
        <LongBox
          {...shared}
          value={String(value)}
          maxLength={field.maxLength}
          leftId={leftId}
          onChange={change}
        />
      )}

      {field.type === 'place' && (
        <PlaceField
          required={asked}
          id={inputId}
          name={field.name}
          value={String(value)}
          /* Read out of the values the form holds rather than out of a field of
             its own: the country is the second half of the place and has no
             field on any definition (forms/types.ts). */
          country={beside}
          /* Which of the two is wrong, since the field is two controls and the
             error may be about either: the town when it is empty, the country
             when the town is one the codebook does not know. Marked on the town
             either way, a screen reader was sent to the box that was already
             filled in (WCAG 2.2 SC 3.3.1). */
          invalid={error !== undefined && !aboutCountry(error)}
          countryInvalid={aboutCountry(error)}
          locked={locked}
          describedBy={describedBy === '' ? undefined : describedBy}
          /* What is left of that when the error belongs to the country: the
             town keeps saying how it works, and stops carrying somebody else's
             error. */
          withoutError={
            describedBy
              .split(' ')
              .filter((one) => one !== errorId)
              .join(' ') || undefined
          }
          errorOnly={error === undefined ? undefined : errorId}
          openAt={open}
          onChange={(town, country) => {
            onChange(field, town, { country })
          }}
        />
      )}

      {field.type === 'date' && (
        <DatePicker
          id={inputId}
          name={field.name}
          value={String(value)}
          required={asked}
          invalid={error !== undefined}
          describedBy={describedBy === '' ? undefined : describedBy}
          openAt={open}
          locked={locked}
          steps={steps}
          onChange={change}
        />
      )}

      {/* And only on a field somebody types into. The condition below asks the
          type and this one did not, so a `select`, a `textarea` or a picture given
          a list would draw two controls carrying the same `id`. Nothing on the
          portal does that today; the only list is on `raceName`, which is text.
          Written so that it stays impossible rather than merely unused. */}
      {suggesting !== undefined && field.type === 'text' && (
        <Suggesting
          shared={shared}
          value={String(value)}
          suggestions={suggesting.list}
          /* A held box is not typed into, so it says nothing about a list it cannot use. */
          unreadable={locked ? undefined : suggesting.unreadable}
          onType={suggesting.onType}
          onChoose={suggesting.onChoose}
        />
      )}

      {(suggesting === undefined || field.type !== 'text') &&
        (field.type === 'text' ||
          field.type === 'email' ||
          field.type === 'password' ||
          field.type === 'number') && (
          <input
            {...shared}
            readOnly={locked ? true : undefined}
            {...boxFor(field)}
            value={String(value)}
            onChange={(e) => change(e.target.value)}
          />
        )}

      {error !== undefined && (
        <p className="field__error" id={errorId}>
          {t(error.key, error.params)}
        </p>
      )}
    </div>
  )
})

export function FormRenderer({
  form,
  onSubmit,
  initial,
  title,
  options = {},
  suggests = {},
  fixed = [],
  sendIsHeld = false,
  sendIsOut,
  check,
  derived,
  was,
  openAt,
  beneath,
  above,
  alsoRefuses,
  steps,
}: Props) {
  const { t } = useI18n()
  const [values, setValues] = useState<FormValues>(() => ({ ...emptyValues(form), ...initial }))
  /* The state is seeded from the definition it was first handed, and a caller may
     hand it another one without remounting. Filled here rather than only where a
     field is drawn: the guard used to sit on the drawn value alone, so a field
     the state was not holding showed empty and then saved the string
     "undefined", because `textFrom` in records.ts is `String(value)`. Blank on
     screen and a word in the record is worse than the fault it replaced. */
  const filled: FormValues = { ...emptyValues(form), ...values }
  const [errors, setErrors] = useState<Record<string, FieldError>>({})
  /** What was refused beneath the form when it was last sent, so the sentence is
   *  drawn where the field errors are and goes when the press succeeds. */
  const [refused, setRefused] = useState<string | undefined>(undefined)
  /** The form itself, so the cursor can be put back inside it without asking the
   *  whole document for an address (`components/Prompt.tsx` does the same). */
  const sheet = useRef<HTMLFormElement>(null)
  /** Whether the last press was refused over a field, and the cursor is therefore
   *  owed to the first field that is wrong. Set on the press and spent by the
   *  effect below, so a redraw for any other reason never moves the cursor. */
  const owed = useRef(false)

  /**
   * THE CURSOR GOES TO THE FIRST FIELD THAT IS WRONG, AFTER A PRESS THAT WAS REFUSED.
   *
   * <p><b>This is what replaces the summary of errors, and it is not decoration.</b>
   * Until 28.09.2026 the one road back to a broken field was the list of links above
   * the form, and the decision that kept that list said so in as many words (PDL,
   * „[ODLUKA 12.08.2026, vlasnik] Forme se dele na trecine": „veza iz sazetka ka polju
   * ostaje, jer je to ono sto tastaturu vraca na gresku (WCAG 2.2 SC 3.3.1)"). The
   * owner took the LIST away on 28.09.2026; he did not take the ROAD away. Measured in
   * a browser before the change: after a refused press `document.activeElement` was
   * `body`, with fourteen messages on the screen and no way to reach any of them from
   * the keyboard.
   *
   * <p><b>WHICH CONTROL, ASKED OF THE DOCUMENT RATHER THAN WORKED OUT AGAIN.</b> Every
   * control that is wrong already carries `aria-invalid="true"`, and the document holds
   * them in the order the form draws them, so the first one found is the first field
   * that is wrong. Worked out from `broken` instead, this would have to know the one
   * thing the list of links also had to know: that the half of a place field which is
   * wrong may be the COUNTRY, which has an address of its own
   * (`PlaceField.tsx`, `field-<name>-country`). The document answers that already,
   * because in exactly that case the town is marked valid and the country invalid
   * (`invalid` and `countryInvalid`, where the field is drawn). One home for the
   * question, and it is the home that cannot fall out of step with what is on screen.
   *
   * <p><b>No dependency list, on purpose.</b> It must run after the draw that carries
   * the new errors, whichever draw that is, and `owed` is what decides whether it does
   * anything at all. A list would have to name the errors, and the errors are not what
   * this waits for: the draw is.
   *
   * <p>The scroll is <b>not</b> prevented here, unlike the landmark on a new screen
   * (`app/useNewScreen.ts`). There the scroll had just been put where it belongs and
   * focus would have undone it; here the field may be below the fold and taking the
   * reader to it is the whole point.
   */
  useEffect(() => {
    if (!owed.current) {
      return
    }

    owed.current = false
    sheet.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
  /* The fields that were filled from a chosen entry, and are therefore not this
     reader's to change. Names and not a flag per field, because what is locked is
     decided by the entry that was chosen and differs from one list to the next. */
  const [led, setLed] = useState<string[]>([])
  /* One day for showing a field and for validating it. They used to read the
     clock separately, one on every draw and one on submit, so a form filled in
     across midnight could show a field it then refused to validate. */
  const today = useTodayDate()

  // A field that is not on screen is neither shown nor validated. The parent
  // signature appears the moment the date of birth says it is needed, which is
  // why visibility is derived from the values rather than from a blur event.
  /* Over what is going to be sent, the same as everything else on this form:
     `values` is what has been typed and `filled` is that read through the
     definition, and the two differ only for a caller that hands the form another
     definition without remounting it. */
  /* Through `asAsked`, so the star and `aria-required` say the same thing the
     validation will demand of this reader. */
  const visible = form.fields
    .filter((field) => isVisible(field, filled, today))
    .map((field) => asAsked(field, filled, today))
  /* Each visible field beside its own value, rather than each field looking its
     value up by name. `filled` is built from the definition, so the pairing is
     total and the value that comes out is a value: no fallback, and so no branch
     that cannot be taken. Order is the definition's, because that is the order
     `emptyValues` writes its keys in (ADL A14 rule 4). */
  const drawn = Object.entries(filled).flatMap(([name, value]) =>
    visible.filter((field) => field.name === name).map((field) => ({ field, value })),
  )
  /**
   * The errors this form still stands behind.
   *
   * An error that says a field is obligatory is dropped the moment the form stops
   * asking for that field. A member who sends the form without a link is told the
   * link is obligatory, and then attaches a picture, which by Član 37 makes the
   * link optional: the star beside the name goes, `aria-required` goes, and until
   * 23.08.2026 the red line under the box and the entry in the summary above it
   * stayed. The screen said in one breath that the field need not be answered and
   * that it is wrong to have left it.
   *
   * Only that one kind of error, and only while the field is not asked for. A
   * badly written address is still a badly written address whether or not the form
   * insists on having one, so a pattern error stays.
   *
   * Derived here and not swept out of the state, and that is the one home this
   * question has. Swept was the first answer and it lived in `handleChange` for a
   * day, as a list of the rules by which one field decides another; a round on
   * 23.08.2026 measured the two against each other and found the sweep does nothing
   * this does not, so it went. What is left is smaller than either: this asks only
   * whether the form is asking for the field **now**, so a fifth rule written
   * tomorrow needs nothing here, while a list of rules would have had to learn it.
   *
   * **Only for this one kind of error**, and the rest of the state is as stale as it
   * ever was: correct the first of two passwords that did not match and „Ne poklapa
   * se sa prethodnim poljem." goes on standing under the second until the form is
   * sent again, because `handleChange` clears the error of the field that was typed
   * into and of no other. That is older than this and it is not what this is about;
   * it is written down so the sentence above is not read as a promise about
   * everything.
   *
   * One visible consequence, worth saying rather than discovering: a field that
   * becomes obligatory again is refused again **at once**, without another
   * submission. Attach a picture and the message goes; press „Obriši" on that
   * picture and it is back, over a field nobody has touched since. That is the same
   * sentence the form would say on the next press, so nothing is being invented; a
   * sweep would have said nothing until then, over a field that is obligatory and
   * empty. Measured in `pages/member/newResult.test.tsx`, because the same sentence
   * stood here while a sweep was also running and was false: there was nothing left
   * in the state to come back.
   */
  const shown: Record<string, FieldError> = Object.fromEntries(
    visible.flatMap((field) => {
      const error = errors[field.name]

      return error === undefined || (error.key === REQUIRED_KEY && field.required !== true)
        ? []
        : [[field.name, error] as const]
    }),
  )
  /* ~~`broken`, the visible fields that carry an error.~~ It existed to be listed
     above the form, and that list went on 28.09.2026. Nothing derives the set any
     more: which field is wrong is said on the field itself, through `shown` just
     above, and WHICH ONE IS FIRST is answered by the document rather than here
     (`owed`, above), so that the country half of a place field is not a second thing
     to be remembered in a second place. */

  /**
   * WHAT THE FORM HAS STOPPED ASKING FOR, IT ALSO STOPS HOLDING.
   *
   * <p><b>Owner, 28.09.2026:</b> „Ukoliko ukucam greskom 2026 godinu za koju mi trazi
   * povezano lice, a onda promenim na 2006 godinu za koju mi ne trazi, bitno mi je da
   * se ne cuvaju nepotrebni podaci o staratelju koje sam mozda uneo pa izgubio uvid u
   * njih." It is a question of privacy and not of tidiness, and his own reason says so:
   * he has lost sight of them. A third person named in a form nobody can see any more
   * is a record with nothing holding it (PDL P23 collects nothing that is not needed).
   *
   * <p><b>The body was already clean and that is exactly why this was invisible.</b>
   * `onScreen` has left hidden fields out of what is sent since it was written, so
   * every guard over the REQUEST body passed while the form went on holding the name
   * in its state. Measured in a browser on 28.09.2026: type a parent, move the date of
   * birth to an adult year and back, and „Milan Djurisic" is still in the box. Two
   * homes for one fact, one of them right, and only the wrong one is what the reader
   * meets.
   *
   * <p><b>Both directions matter and the second is the one that shows.</b> Going back
   * to an age that asks for a parent again must give EMPTY boxes; leaving the state
   * alone gives back what was typed, which is the fault itself wearing the look of a
   * convenience.
   *
   * <p><b>Adjusted while drawing, not in the change handler.</b> The handler is made
   * once for the whole form and must stay that way (ADL A2: a field handed a new
   * handler every draw redraws with it, which is what a form of 1187 options cannot
   * afford), and it can reach neither the definition nor the day without taking both
   * as dependencies - and `useTodayDate` returns a fresh `Date` on every draw, so that
   * alone would rebuild the handler constantly. Asked here instead, where both are
   * already in hand, and it answers for every reason a field can go, not only for
   * somebody typing: a caller handing the form another definition, or the day itself
   * turning over.
   *
   * <p>It settles in one further draw and cannot loop: once the names are out of the
   * state, `holds` is false for them and nothing more is set.
   */
  /* A VALUE OR A MESSAGE ABOUT ONE, and the second is not the first over again. A
     parent left blank on a form that was sent carries no value and does carry
     „Ovo polje je obavezno.", so a sweep that asked only about values left the
     message standing: correct the age twice and it came back over a box that is empty
     only because this emptied it, scolding somebody for an answer nobody asked him for
     again. That is the „jezivo, prenapadno" of 12.08.2026 arriving through a back door,
     and it is measured in `pages/Registration.test.tsx`, „does not scold an empty
     parent box it emptied itself". */
  const held = goneFrom(filled).filter(
    (name) => holds(values[name]) || errors[name] !== undefined,
  )

  if (held.length > 0) {
    setValues(outside(held))
    setErrors(outside(held))
  }

  const titleId = `form-${form.id}-title`
  /* The width this form gives every one of its rows, or nought where it names
     none (`types.ts`, `FormDef.columns`).
   *
     Read HERE, once for the form, and not inside `columnsOf` where it is used.
     Inside, the fallback is unreachable: `columnsOf` is called for a ROW, the
     registration is the only form of the twelve that puts a field on one, and it
     is the only one that declares a width - so a form arriving without one never
     reaches that line and the coverage gate says so, at 99,97% of branches with
     3575 cases green. Out here it is read for every form the renderer draws,
     eleven of which declare nothing, and both answers are live.

     The gate finding it is the point rather than an inconvenience: a fallback
     nothing can reach is a promise nobody is keeping, and a case written to
     reach it sideways would only have hidden that. */
  const floor = form.columns ?? 0

  /**
   * What is on screen, which is what may be sent.
   *
   * A field taken off the form takes its value with it. Somebody who entered a
   * date of birth in 2015, filled in the parent's name and relationship the form
   * then asked for, and corrected the date to an adult one, was still sending
   * that name and that relationship: a third party named in a record with no
   * ground to stand on, where PDL P23 collects nothing that is not needed and a
   * parent's signature exists only as the legal basis for a member under
   * sixteen. Nothing keeps it today because there is no database yet, but this
   * object is the contract the F5 backend will be written against.
   *
   * Written as what to leave out rather than what to keep: a place field writes
   * a value beside its own, the country the town came with, and that value has
   * no field of its own to be found under (src/forms/types.ts).
   */
  /**
   * THE NAMES THE FORM HAS STOPPED ASKING FOR, and whatever those fields were
   * writing beside themselves.
   *
   * <p><b>One home, because two things now ask this same question.</b> The body that
   * goes to the server leaves these out (`onScreen`, just below), and since
   * 28.09.2026 the state of the form drops them outright as well (`held`, further
   * down). Asked in two places, the two would answer differently the day a second
   * kind of field starts writing a value beside its own, and then the body would be
   * clean while the form went on holding what the reader can no longer see - which is
   * the half the owner actually complained about.
   */
  function goneFrom(all: FormValues): string[] {
    const gone = form.fields.filter((field) => !isVisible(field, all, today))

    /* And whatever a field that has gone was writing beside itself. A place
       field writes the country its town came with, under a name of its own, so
       hiding the town used to leave the country behind with nothing holding it
       (src/forms/types.ts). Nothing draws that arrangement today; the fault was
       built in the moment the country was let through by name. */
    return [
      ...gone.map((field) => field.name),
      ...gone.flatMap((field) => (field.type === 'place' ? ['country'] : [])),
    ]
  }

  function onScreen(all: FormValues): FormValues {
    /* A field that only agrees with another one carries nothing of its own. The
       repeated password is the whole of that case, and it was going out in the
       body beside the first: a secret sent twice is a second place for it to end
       up in a proxy log or a crash report. Whether the two matched is a rule of
       the form, answered here, and not a fact a backend is owed. */
    const confirming = form.fields
      .filter((field) => field.matches !== undefined)
      .map((field) => field.name)
    const left = [...goneFrom(all), ...confirming]

    return Object.fromEntries(Object.entries(all).filter(([name]) => !left.includes(name)))
  }

  /**
   * The fields `onScreen` dropped because they only agree with another one.
   *
   * <p>Handed to the caller beside what is sent rather than folded into it, so that
   * the default stays what it was: a form does not put a repeated secret in a body
   * unless the screen asks for it by reading this. One route asks
   * (`/api/registration`, which requires `passwordRepeat` by name) and no other does.
   *
   * <p><b>Visibility is asked here too, and it is not decoration.</b> A field nobody
   * was shown is a field nobody typed, and handing its empty value over would let a
   * screen send an agreement that was never made. The same question `onScreen` asks
   * of every other field, asked of these.
   */
  function agreeing(all: FormValues): FormValues {
    /* Named, then filtered out of `all`, which is the shape `onScreen` above has: an
       index into the values would have to answer for a key that is not there, and the
       fallback it would need is a branch nothing can reach, since `filled` holds one
       value for every field of the form. Kept side by side, the two read as one idea. */
    const confirming = form.fields
      .filter((field) => field.matches !== undefined && isVisible(field, all, today))
      .map((field) => field.name)

    return Object.fromEntries(Object.entries(all).filter(([name]) => confirming.includes(name)))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    /* A PRESS THAT WAITS IS NOT ASKED ANYTHING (`sendIsOut`). Refused here, above the rules of the
       definition, the screen's `check` and `alsoRefuses`, and below the line that keeps the browser
       from sending the form itself. Whatever it asked would be answered about the record the send in
       flight is making: the event just taken is in the screen's list under the address the form
       shows. Read off the ref, which is already true in the tick the send began in, and not off
       `sendIsHeld`, which is still false until the render that follows it. */
    if (sendIsOut?.current === true) {
      return
    }

    /* The rules in the definition win over the handed in check: a field that is
       empty is empty before it is anything else. The one exception is the rule
       about the country beside a town, which is the last resort: a caller with
       something to say about the same field has said something more
       particular. */
    const handed = check?.(filled) ?? {}
    /* Over what is going to be sent, not over what has been typed. The two are
       the same until a caller hands the form a second definition without
       remounting it, and then `values` is missing whatever the new definition
       added while `filled` has it (see `filled` above): the rule about the
       country then said nothing in the one case where there is certainly no
       country. */
    const own = validateForm(form, filled, today)
    const found = { ...handed, ...own }

    for (const [name, error] of Object.entries(handed)) {
      if (aboutCountry(found[name])) {
        found[name] = error
      }
    }
    setErrors(found)

    /* Asked on the press and not while typing, like every other rule this form
       keeps: a row half entered is not a fault until somebody says they are
       finished. */
    const beyond = alsoRefuses?.(onScreen(filled))

    setRefused(beyond)

    /* Owed only where a FIELD is wrong. A form refused as a whole has no field to
       be taken to - what `alsoRefuses` names is the table below it - and that
       sentence announces itself where it is drawn, through `role="alert"`. Asked
       of `found` rather than of `beyond` for that reason, and the two are not the
       same question. */
    owed.current = Object.keys(found).length > 0

    if (Object.keys(found).length === 0 && beyond === undefined) {
      /* BOTH THROUGH `trimValues`, AND THE DEFINITION GOES WITH THEM. Handed the same
         form, the two sides treat a field the same way - which matters most for the one
         kind of field `trimValues` deliberately leaves alone. A password is not trimmed
         (ADL A62c), and the repeated one is a password too; trimmed on one side only,
         two boxes holding the same thing would arrive at the server holding different
         things, and the comparison there would refuse a form the reader filled in
         correctly.
       *
         AND BOTH THROUGH THE ONE DOOR, after the rules and after the trimming, for the same
         reason: a date leaves as yyyy-mm-dd and a number with a dot (`records.ts`,
         `storedDates` and `storedNumbers`; owner, 02.10.2026). The rules above read what was
         typed, so the door cannot stand in front of them; it stands here, where nothing on
         this side of the form reads the values again. */
      const sent = (all: FormValues): FormValues =>
        storedNumbers(form, storedDates(form, trimValues(form, all)))

      onSubmit(sent(onScreen(filled)), sent(agreeing(filled)))
    }
  }

  /* Made once for the whole form, not once per field per redraw: a field that is
     handed a new handler every time counts as changed and redraws with it, which
     is the one thing the memo above cannot see through. Both setters are stable
     and both updates read the current state, so there is nothing to depend on. */
  /**
   * The errors of the fields that were just touched, gone, and the rest left
   * standing.
   *
   * `setErrors({})` stood here until 23.08.2026 and emptied the whole form: one
   * letter typed into the name of an event took away nine messages and the summary
   * over them, while the same letter typed into „Sati" took away one. A reader
   * walking those messages with a screen reader lost them on touching the first field
   * and had to send the form unfinished again to get them back (WCAG 2.2 SC 3.3.1).
   *
   * <p><b>The rule outlived the thing it was first written for.</b> The summary went on
   * 28.09.2026, and this matters more without it, not less: the messages are now the
   * only account of what is wrong, and they are what `aria-invalid` marks, so a sweep
   * that emptied them would also take away every place the cursor has to go back to.
   */
  const without = (names: string[]) => outside<FieldError>(names)

  const handleChange = useCallback(
    (field: FieldDef, next: string | boolean, also?: Record<string, string>) => {
      /* `also` is what a place field writes beside itself: the country the town
         came with. One field, two values, and the second has no field of its own
         to be typed into (src/forms/types.ts). */
      setValues((current) => ({ ...current, [field.name]: next, ...also }))
      /* The message goes away as soon as the field is touched. Leaving it up tells
         a screen reader a field is still wrong after it was fixed.
       *
         This field and no other. A message on a **second** field that the answer to
         this one frees is a separate question, and it is answered where the errors
         are drawn rather than here (`shown`, further down). Held here as well for
         one day, on a hand-read list of the rules by which one field decides
         another, and a round measured on 23.08.2026 that the two do the same work:
         with the derivation in place, taking this back to the touched field alone
         left all 2099 tests green. Two homes for one fact, and the derived one is
         the one that needs no list. */
      setErrors(without([field.name]))
    },
    /* Nothing to depend on. `form` was read in here while the list of rules by
       which one field decides another lived in this callback; that went on
       23.08.2026, and the dependency went with it. The suppression that stood here
       went too: `react-hooks/exhaustive-deps` is not a rule this gate runs
       (`.oxlintrc.json`), so it was silencing nothing and reading as though it
       were. */
    [],
  )

  /**
   * The list a field is typed against, and what typing and choosing do to the
   * form around it.
   *
   * Built here rather than handed to every field, so the two callbacks are made
   * only for the one field that has a list. Every other field goes on getting
   * the memoised `handleChange` and is drawn again only when its own value
   * changes, which is what keeps a form of twelve hundred options usable.
   */
  function suggestingOn(field: FieldDef) {
    const list = suggests[field.name]

    if (list === undefined) {
      return undefined
    }

    return {
      list: Array.isArray(list) ? list : [],
      unreadable: Array.isArray(list) ? undefined : list,
      onType: (next: string) => {
        /* The link breaks the moment the name is edited (owner, 23.08.2026):
           what was filled from the chosen entry is emptied and handed back, so a
           name typed freely cannot stand over somebody else's date and distance.
           Emptied and not merely unlocked, because the four are then a record
           this form is no longer describing. */
        setValues((current) => ({
          ...current,
          ...Object.fromEntries(led.map((name) => [name, ''])),
          [field.name]: next,
        }))
        setErrors(without([field.name, ...led]))
        setLed([])
      },
      onChoose: (one: Suggestion) => {
        setValues((current) => ({ ...current, [field.name]: one.value, ...one.fills }))
        setErrors(without([field.name, ...Object.keys(one.fills)]))
        setLed(Object.keys(one.fills))
      },
    }
  }

  /* The form is named after its own heading, so it is a region a screen reader
   * can be taken to and land in, rather than a run of fields in the page. */
  return (
    <form /* Wide where the screen has put a table under the fields: the ceiling on
         a form is a measure for reading, and a table is not prose
         (FormRenderer.css). */
      className={beneath === undefined ? 'form' : 'form form--wide'} aria-labelledby={titleId} onSubmit={handleSubmit} noValidate ref={sheet}>
      {title === undefined ? (
        <h1 className="form__title" id={titleId}>
          {t(form.titleKey)}
        </h1>
      ) : (
        <h2 className="form__title" id={titleId}>
          {title}
        </h2>
      )}

      {above}

      {/* What the star beside a name means, said once over the form rather than
          spelled out on every field (owner, 12.08.2026). Only where there is a
          star to explain: a form of nothing but optional fields would be
          explaining a mark it never draws. Every form the portal has draws at
          least one, the registration included, where „Svojim rečima" is the one
          field that may be left empty. */}
      {visible.some((one) => one.required === true) && <RequiredNote />}

      {/* WHAT WAS REFUSED OVER THE WHOLE FORM, AND NOTHING THAT BELONGS TO A FIELD.
       *
         The summary that stood here until 28.09.2026 - a title and a list of links,
         one per broken field - is gone. Owner, that day, over a picture of it on the
         registration: „U strani registracije (a i na svim ostalim stranama) zbirne
         greske kao u prilogu ne treba da se pojavljuju. Dovoljna je validacija na
         nivou polja kako je sad u Registraciji." It went from all thirteen forms at
         once, because there is one renderer and he said „na svim ostalim stranama".
       *
         WHAT IS LEFT IS THE ONE SENTENCE THAT HAS NO FIELD TO STAND BESIDE. What
         `alsoRefuses` answers for is the form as a whole, and what it names is the
         table below it rather than any box on it, so there is no field-level place it
         could be moved to and no address it could be led to. Three screens say
         something here - `pages/member/NewResult.tsx`, `pages/event/ReportResult.tsx`
         and `pages/admin/AdminEvents.tsx` - and taken away with the list, all three
         would refuse a press with nothing whatever on the screen.
       *
         `role="alert"` stays, and for the reason it was there: it appears in answer to
         a press, and a press that does nothing perceivable is a press a blind visitor
         cannot tell went wrong. What the FIELDS say is announced the other way now, by
         the cursor being put on the first of them (`owed`, above), which is what took
         over the job the links used to do. */}
      {refused !== undefined && (
        <p className="form__refused" role="alert">
          {t(refused)}
        </p>
      )}

      {groupsOf(rowsOf(drawn)).map(({ groupKey, rows, key: groupOwnKey }) => {
        const drawnRows = rows.map(({ row, fields, key }) => {
          const drawnRow = fields.map(({ field, value }) => (
            <Field
              key={field.name}
              field={field}
              value={value}
              beside={String(filled.country ?? '')}
              error={shown[field.name]}
              choices={optionsFor(field, options)}
              onChange={handleChange}
              open={field.name === openAt}
              locked={led.includes(field.name) || fixed.includes(field.name)}
              steps={field.type === 'date' ? steps : undefined}
              suggesting={suggestingOn(field)}
            />
          ))

          /* A field on no row stands on its own, as every field on every form did
             before rows existed and as every field still does on a telephone. */
          if (row === undefined) {
            /* Wrapped rather than handed back bare, so this group has a key of its
               own. Returned as an array it had none, and React then paired these
               groups by position: a field that appears and disappears with a date
               of birth shifted every one below it by one, and „Svojim rečima" was
               mounted onto the fiber that had been holding the confirmation. */
            return <Fragment key={key}>{drawnRow}</Fragment>
          }

          return (
            <div
              className="form__row"
              key={key}
              /* How many columns this row has is counted here rather than written
                 in the definition, so moving a field between rows is one number in
                 one place (forms/types.ts, `row`). A town counts as two of
                 them, because it carries the country beside it. */
              /* The one cast the portal makes, and the same one every other CSS
                 variable on it makes (components/ColumnChart.tsx): TypeScript's
                 `CSSProperties` has no room for a custom property, and there is no
                 other way to hand a number to a stylesheet. */
              style={{ '--columns': columnsOf(fields, floor) }}
            >
              {drawnRow}
            </div>
          )
        })

        /* A form whose fields name no group is drawn exactly as it was before
           groups existed: no `fieldset`, no `legend`, not one element more.
           Eleven of the twelve forms the renderer draws are that form, and
           `otherFormsAreDrawnAsTheyWere` in `FormRenderer.test.tsx` is what
           holds them there. */
        if (groupKey === undefined) {
          return <Fragment key={groupOwnKey}>{drawnRows}</Fragment>
        }

        return (
          <fieldset className="form__group" key={groupOwnKey}>
            {/* The one element a screen reader repeats before every field inside
                it. A heading would be read once, on the way past, and say
                nothing at all to somebody who arrives at the third field of the
                group by keyboard. */}
            <legend className="form__groupName">{t(groupKey)}</legend>
            {drawnRows}
          </fieldset>
        )
      })}

      {/* What the record carries without being asked: shown, so nobody wonders
          where it went, and read only, so it cannot contradict what it is read
          off. **A label and the value, and nothing else.** Where the value comes
          from used to be said here in a sentence of its own; both sentences the
          portal had were on the numbered list the owner read on 31.08.2026 and
          neither was among the seven he kept, so they went with the rest and the
          property that carried them went with them (`types.ts`, `DerivedField`,
          which records that in the past tense this line kept promising in the
          present until 04.09.2026). */}
      {(derived?.(filled, was) ?? [])
        .filter((one) => one.hidden !== true)
        .map((one) => (
        <p className="field field--derived" key={one.name}>
          <span className="field__label">{t(one.labelKey)}</span>
          <strong className="field__derived">{t(one.shownKey)}</strong>
        </p>
      ))}

      {/* Handed the values as they stand, because what it draws answers them: a
          race entered under an event opens on the day the form above it is
          showing, whether or not that day has been saved yet. */}
      {beneath?.(filled)}

      {/* TOLD OFF AND NOT SWITCHED OFF while a send the screen holds the reader for is out
          (`sendIsHeld`), like every control that cannot act on this portal: `disabled` would take it
          out of the order of focus along with the focus the press gave it. The press itself is
          refused in `handleSubmit`, because the attribute stops nothing. */}
      <button
        type="submit"
        className="form__submit"
        aria-disabled={sendIsHeld ? true : undefined}
      >
        {t(form.submitKey)}
      </button>
    </form>
  )
}
