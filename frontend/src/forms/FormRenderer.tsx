import {
  Fragment,
  memo,
  useCallback,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useTodayDate } from '../clock/useClock'
import { useI18n } from '../i18n/useI18n'
import { FieldHint } from './FieldHint'
import { LongBox } from './LongBox'
import type {
  DerivedField,
  FieldDef,
  FieldError,
  FieldOption,
  FormDef,
  FormValues,
} from './types'
import { CountryOptions } from './CountryOptions'
import { DatePicker } from './DatePicker'
import { PlaceField } from './PlaceField'
import { optionsFor } from './records'
import { emptyValues, isVisible, trimValues, validateForm } from './validate'
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

/** A field beside the value it is holding, which is what the form draws. */
type Drawn = { field: FieldDef; value: string | boolean }

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
/**
 * How wide a row is, counted in columns rather than in fields.
 *
 * A town counts as two, because it carries the country beside it and the two are
 * two controls: „Adresa, Mesto, Država" is three columns and two fields.
 */
function columnsOf(fields: Drawn[]): number {
  return fields.reduce((so, one) => so + (one.field.type === 'place' ? 2 : 1), 0)
}

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

/**
 * The words of a field, with the link they carry where they carry one.
 *
 * One case: the confirmation that the rules have been read leads to them (owner,
 * 11.08.2026). The label holds `{link}`, so the sentence and the words of the
 * link are both translated and neither is glued together out of pieces, which is
 * how a sentence ends up in the wrong order in the other language.
 */
function worded(
  words: string,
  field: FieldDef,
  locale: string,
  t: (key: string) => string,
): ReactNode {
  if (field.linkKey === undefined || field.linkTo === undefined) {
    return words
  }

  const [before, after] = words.split('{link}')

  /* A translation that lost the mark keeps its words rather than gaining a link
     glued to the end of them. The other language is written by somebody working
     from the Serbian, and „{link}" is the sort of thing that is dropped; a
     sentence about the rules with the rules missing is worse than a sentence
     with no link at all, and the dictionary guard cannot see this one because
     the key resolves either way. */
  if (after === undefined) {
    return words
  }

  return (
    <>
      {before}
      {/* A new tab, because following it in the middle of a form that is being
          filled in would otherwise throw away everything typed so far.
       *
          The address is written without the language and gets it here, from the
          page it is being read on (ADL A2): a definition that wrote „/sr/" would
          send an English reader to the Serbian rulebook. */}
      <a href={`/${locale}/${field.linkTo}`} target="_blank" rel="noreferrer">
        {t(field.linkKey)}
      </a>
      {after}
    </>
  )
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
}) {
  const { locale, t } = useI18n()
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

  const shared = {
    id: inputId,
    name: field.name,
    'aria-invalid': error !== undefined,
    'aria-describedby': describedBy === '' ? undefined : describedBy,
    className: 'field__control',
    autoFocus: open,
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
          <label className="field__label" htmlFor={inputId} id={labelId}>
            {worded(t(field.labelKey), field, locale, t)}
          </label>
        </div>

        {field.hintKey !== undefined && (
          <FieldHint id={hintId} text={t(field.hintKey)} of={labelId} />
        )}

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
      /* Named by the id the summary of errors links to. Every other field is
         reached through its own control, which carries that id; a group has no
         one control, so the group carries it. Without this the link „Pol" led to
         an element that is not there, and it is the likeliest error on this
         form: sex and category are the two things nothing is chosen for. */
      <fieldset
        className="field field--choice"
        id={inputId}
        /* And it takes the cursor when the summary of errors leads here. A
           fieldset is not focusable of itself, so following the link only
           scrolled: the keyboard stayed where it was, which is not what a list
           of things to fix promises. */
        tabIndex={-1}
      >
        {/* A legend names the group, and nothing but the name goes in it: a rule
            written here would be read out before every one of the buttons. */}
        <legend className="field__label" id={labelId}>
          {t(field.labelKey)}
        </legend>

        {field.hintKey !== undefined && (
          <FieldHint id={hintId} text={t(field.hintKey)} of={labelId} />
        )}

        {/* Buttons to look at and radio buttons to work: nothing is chosen to
            begin with, exactly one can be, and the arrow keys walk the group the
            way they walk every other one on the web. Inputs with labels rather
            than `<button aria-pressed>`, because a pressed button is a switch
            and this is a choice: a reader is told „2 of 2" and which one it is
            standing on. */}
        <div className="choice">
          {choices.map((option) => (
            <span className="choice__one" key={option.value}>
              <input
                type="radio"
                id={`${inputId}-${option.value}`}
                name={field.name}
                className="choice__input"
                value={option.value}
                checked={String(value) === option.value}
                aria-invalid={error !== undefined}
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
      </fieldset>
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

        {field.hintKey !== undefined && (
          <FieldHint id={hintId} text={t(field.hintKey)} of={labelId} />
        )}
      </span>

      {field.type === 'country' && (
        <select {...shared} value={String(value)} onChange={(e) => change(e.target.value)}>
          {/* Only while there is no answer, the way every other select on the
              portal does it. */}
          {String(value) === '' && <option value="">{t('form.choose')}</option>}
          <CountryOptions holding={String(value)} />
        </select>
      )}

      {field.type === 'photo' && (
        <input
          {...shared}
          type="file"
          accept="image/*"
          onChange={(e) => change(e.target.files?.[0]?.name ?? '')}
        />
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
          id={inputId}
          name={field.name}
          value={String(value)}
          /* Read out of the values the form holds rather than out of a field of
             its own: the country is the second half of the place and has no
             field on any definition (forms/types.ts). */
          country={beside}
          invalid={error !== undefined}
          describedBy={describedBy === '' ? undefined : describedBy}
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
          invalid={error !== undefined}
          describedBy={describedBy === '' ? undefined : describedBy}
          openAt={open}
          onChange={change}
        />
      )}

      {(field.type === 'text' ||
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
  /* One day for showing a field and for validating it. They used to read the
     clock separately, one on every draw and one on submit, so a form filled in
     across midnight could show a field it then refused to validate. */
  const today = useTodayDate()

  // A field that is not on screen is neither shown nor validated. The parent
  // signature appears the moment the date of birth says it is needed, which is
  // why visibility is derived from the values rather than from a blur event.
  const visible = form.fields.filter((field) => isVisible(field, values, today))
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    /* The rules in the definition win over the handed in check: a field that is
       empty is empty before it is anything else. */
    const found = { ...check?.(values), ...validateForm(form, values, today) }
    setErrors(found)

    if (Object.keys(found).length === 0) {
      onSubmit(trimValues(filled))
    }
  }

  /* Made once for the whole form, not once per field per redraw: a field that is
     handed a new handler every time counts as changed and redraws with it, which
     is the one thing the memo above cannot see through. Both setters are stable
     and both updates read the current state, so there is nothing to depend on. */
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

      {/* Announced the moment it appears. Without it, pressing the button with
          a broken form does nothing perceivable for a blind visitor. */}
      {broken.length > 0 && (
        <div className="form__summary" role="alert">
          <p className="form__summary-title">{t('form.errorSummary')}</p>
          <ul>
            {broken.map((field) => (
              <li key={field.name}>
                <a href={`#field-${field.name}`}>{t(field.labelKey)}</a>
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
            style={{ '--columns': columnsOf(fields) } as CSSProperties}
          >
            {drawnRow}
          </div>
        )
      })}

      {/* What the record carries without being asked: shown, so nobody wonders
          where it went, and read only, so it cannot contradict what it is read
          off. It says where it comes from, or a value nobody can change reads
          as a fault rather than as a rule. */}
      {(derived?.(values, was) ?? [])
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
