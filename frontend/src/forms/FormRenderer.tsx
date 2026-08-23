import {
  Fragment,
  memo,
  useCallback,
  useState,
  type FormEvent,
} from 'react'
import { useTodayDate } from '../clock/useClock'
import { useI18n } from '../i18n/useI18n'
import { RequiredMark, RequiredNote } from './AskedLabel'
import { FieldHint } from './FieldHint'
import { plainWords, worded } from './worded'
import { LongBox } from './LongBox'
import type {
  DerivedField,
  FieldDef,
  FieldError,
  FieldOption,
  FormDef,
  FormValues,
  Suggestion,
} from './types'
import { CountryOptions } from './CountryOptions'
import { DatePicker } from './DatePicker'
import { PlaceField } from './PlaceField'
import { Suggesting } from './Suggesting'
import { optionsFor } from './records'
import { asAsked, emptyValues, isVisible, trimValues, validateForm } from './validate'
import './FormRenderer.css'

type Props = {
  form: FormDef
  onSubmit: (values: FormValues) => void
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
   */
  suggests?: Record<string, Suggestion[]>
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

/** A field beside the value it is holding, which is what the form draws. */
type Drawn = { field: FieldDef; value: string | boolean }

/**
 * How wide a row is, counted in columns rather than in fields.
 *
 * A town counts as two, because it carries the country beside it and the two are
 * two controls: „Adresa, Mesto, Država" is three columns and two fields.
 */
function columnsOf(fields: Drawn[]): number {
  return fields.reduce((so, one) => so + (one.field.type === 'place' ? 2 : 1), 0)
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
function rowsOf(drawn: Drawn[]): { row: number | undefined; fields: Drawn[]; key: string }[] {
  const rows: { row: number | undefined; fields: Drawn[]; key: string }[] = []

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
  /** The list this field is typed against, where it has one, and what to do with
   *  what is typed and what is chosen (forms/Suggesting.tsx). */
  suggesting?: {
    list: readonly Suggestion[]
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
  const change = useCallback(
    (next: string | boolean) => {
      onChange(field, next)
    },
    [field, onChange],
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
    className: 'field__control',
    autoFocus: open,
    /* `undefined` and not `false`, so a control that is not locked carries no
       attribute at all: `disabled={false}` is the same to a browser and one more
       thing in the markup for a test to read as a decision somebody made. */
    disabled: locked ? true : undefined,
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

            {field.hintKey !== undefined && (
              <FieldHint id={hintId} text={t(field.hintKey)} of={labelId} />
            )}
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

          {field.hintKey !== undefined && (
            <FieldHint id={hintId} text={t(field.hintKey)} of={labelId} />
          )}
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

           And it carries the id the summary of errors links to, and takes the
           cursor when that link is followed: every other field is reached
           through its own control, a group has no one control, so the group is
           what the link leads to. Sex and category are the two things nothing is
           chosen for, so they are the likeliest errors on this form. */}
        <div
          className="choice"
          role="radiogroup"
          aria-required={asked}
          aria-labelledby={labelId}
          /* The error, on the group as well as on the buttons: the summary of
             errors leads here and puts the cursor on the group itself, and
             a group that says only „Pol" does not say what is wrong with it. */
          aria-describedby={error === undefined ? undefined : errorId}
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
                disabled={locked}
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
            type="file"
            accept="image/*"
            onChange={(e) => change(e.target.files?.[0]?.name ?? '')}
          />

          {String(value) !== '' && (
            <button
              type="button"
              className="button button--secondary button--compact field__clear"
              onClick={() => {
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
          onChange={change}
        />
      )}

      {suggesting !== undefined && (
        <Suggesting
          shared={shared}
          value={String(value)}
          suggestions={suggesting.list}
          onType={suggesting.onType}
          onChoose={suggesting.onChoose}
        />
      )}

      {suggesting === undefined &&
        (field.type === 'text' ||
          field.type === 'email' ||
          field.type === 'password' ||
          field.type === 'number') && (
          <input
            {...shared}
            type={field.type}
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
  check,
  derived,
  was,
  openAt,
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
  const broken = visible.filter((field) => errors[field.name] !== undefined)
  const titleId = `form-${form.id}-title`

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
  function onScreen(all: FormValues): FormValues {
    const gone = form.fields.filter((field) => !isVisible(field, all, today))
    /* And whatever a field that has gone was writing beside itself. A place
       field writes the country its town came with, under a name of its own, so
       hiding the town used to leave the country behind with nothing holding it
       (src/forms/types.ts). Nothing draws that arrangement today; the fault was
       built in the moment the country was let through by name. */
    const alongside = gone.flatMap((field) => (field.type === 'place' ? ['country'] : []))
    /* A field that only agrees with another one carries nothing of its own. The
       repeated password is the whole of that case, and it was going out in the
       body beside the first: a secret sent twice is a second place for it to end
       up in a proxy log or a crash report. Whether the two matched is a rule of
       the form, answered here, and not a fact a backend is owed. */
    const confirming = form.fields.filter((field) => field.matches !== undefined)
    const left = [...gone, ...confirming].map((field) => field.name)

    return Object.fromEntries(
      Object.entries(all).filter(([name]) => !left.includes(name) && !alongside.includes(name)),
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
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

    if (Object.keys(found).length === 0) {
      onSubmit(trimValues(onScreen(filled)))
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
   * walking the summary with a screen reader lost it on touching the first field
   * and had to send the form unfinished again to get it back (WCAG 2.2 SC 3.3.1).
   */
  const without = (names: string[]) => (current: Record<string, FieldError>) =>
    Object.fromEntries(Object.entries(current).filter(([name]) => !names.includes(name)))

  const handleChange = useCallback(
    (field: FieldDef, next: string | boolean, also?: Record<string, string>) => {
      /* `also` is what a place field writes beside itself: the country the town
         came with. One field, two values, and the second has no field of its own
         to be typed into (src/forms/types.ts). */
      setValues((current) => ({ ...current, [field.name]: next, ...also }))
      // The message goes away as soon as the field is touched. Leaving it up
      // tells a screen reader the field is still wrong after it was fixed.
      setErrors(({ [field.name]: _fixed, ...rest }) => rest)
    },
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
      list,
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
    <form className="form" aria-labelledby={titleId} onSubmit={handleSubmit} noValidate>
      {title === undefined ? (
        <h1 className="form__title" id={titleId}>
          {t(form.titleKey)}
        </h1>
      ) : (
        <h2 className="form__title" id={titleId}>
          {title}
        </h2>
      )}

      {/* What the star beside a name means, said once over the form rather than
          spelled out on every field (owner, 12.08.2026). Only where there is a
          star to explain: a form of nothing but optional fields would be
          explaining a mark it never draws. Every form the portal has draws at
          least one, the registration included, where „Svojim rečima" is the one
          field that may be left empty. */}
      {form.fields.some((one) => one.required === true) && <RequiredNote />}

      {/* Announced the moment it appears. Without it, pressing the button with
          a broken form does nothing perceivable for a blind visitor. */}
      {broken.length > 0 && (
        <div className="form__summary" role="alert">
          <p className="form__summary-title">{t('form.errorSummary')}</p>
          <ul>
            {broken.map((field) => (
              <li key={field.name}>
                {/* To the control that is unanswered, which for a town is not
                    always the town: the country beside it is the other half of
                    the same field and has an id of its own (PlaceField.tsx).
                    Written as one address for the field, the list said „Mesto"
                    and led to a box that had already been filled in, while the
                    one marked wrong could not be reached from here at all
                    (WCAG 2.2 SC 2.4.3). */}
                <a href={`#field-${field.name}${aboutCountry(errors[field.name]) ? '-country' : ''}`}>
                  {aboutCountry(errors[field.name])
                    ? t('form.country')
                    : /* Without the mark, and without a link inside this link
                         (forms/worded.tsx). */
                      plainWords(t(field.labelKey), field, t)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rowsOf(drawn).map(({ row, fields, key }) => {
        const drawnRow = fields.map(({ field, value }) => (
          <Field
            key={field.name}
            field={field}
            value={value}
            beside={String(filled.country ?? '')}
            error={errors[field.name]}
            choices={optionsFor(field, options)}
            onChange={handleChange}
            open={field.name === openAt}
            locked={led.includes(field.name)}
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
            style={{ '--columns': columnsOf(fields) }}
          >
            {drawnRow}
          </div>
        )
      })}

      {/* What the record carries without being asked: shown, so nobody wonders
          where it went, and read only, so it cannot contradict what it is read
          off. It says where it comes from, or a value nobody can change reads
          as a fault rather than as a rule. */}
      {(derived?.(filled, was) ?? [])
        .filter((one) => one.hidden !== true)
        .map((one) => (
        <p className="field field--derived" key={one.name}>
          <span className="field__label">{t(one.labelKey)}</span>
          <strong className="field__derived">{t(one.shownKey)}</strong>
          <span className="field__hint">{t(one.hintKey)}</span>
        </p>
      ))}

      <button type="submit" className="form__submit">
        {t(form.submitKey)}
      </button>
    </form>
  )
}
