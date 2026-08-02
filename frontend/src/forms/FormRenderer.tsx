import { memo, useCallback, useRef, useState, type FormEvent } from 'react'
import { useTodayDate } from '../clock/useClock'
import { useI18n } from '../i18n/useI18n'
import type {
  DerivedField,
  FieldDef,
  FieldError,
  FieldOption,
  FormDef,
  FormValues,
} from './types'
import countries from '../data/countries.json'
import { DatePicker } from './DatePicker'
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
  derived?: (values: FormValues) => DerivedField[]
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
  error,
  choices,
  onChange,
}: {
  field: FieldDef
  value: string | boolean
  error: FieldError | undefined
  choices: readonly FieldOption[]
  onChange: (field: FieldDef, value: string | boolean) => void
}) {
  const { t } = useI18n()
  /**
   * How many characters the last paste lost, and zero once anything else has
   * happened in the box.
   *
   * The limit is refused at the door by `maxLength` on the element (owner,
   * 01.08.2026), and the browser refuses it in silence: paste nine thousand
   * characters into a box that holds eight and it keeps eight, drops a thousand,
   * and says nothing at all. The counter then reads "the box is full", which is
   * read as "I filled it" and not as "a thousand characters of what you brought
   * are gone". Somebody moving the rules of a competition across from a document
   * loses the last page and finds out when a member asks about it.
   *
   * Kept here rather than worked out from the value, because after the event
   * there is nothing to work it out from: what was dropped never reached React.
   */
  const [dropped, setDropped] = useState(0)
  /**
   * Whether the change about to arrive is the paste's own.
   *
   * A paste raises the message and then delivers a change, so clearing on every
   * change puts the message up and takes it down inside one event and nobody
   * ever sees it. This lets that one change through and clears on the next,
   * which is the first thing the writer does themselves.
   *
   * Set only when the paste will actually deliver a change: pasting into a box
   * that is already full is refused whole, no change follows, and a flag left
   * standing would eat the writer's next keystroke instead.
   */
  const fromPaste = useRef(false)
  const change = useCallback(
    (next: string | boolean) => {
      if (fromPaste.current) {
        fromPaste.current = false
      } else {
        setDropped(0)
      }

      onChange(field, next)
    },
    [field, onChange],
  )
  const inputId = `field-${field.name}`
  const hintId = `${inputId}-hint`
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
          <label className="field__label" htmlFor={inputId}>
            {t(field.labelKey)}
          </label>
        </div>

        {field.hintKey !== undefined && (
          <p className="field__hint" id={hintId}>
            {t(field.hintKey)}
          </p>
        )}

        {error !== undefined && (
          <p className="field__error" id={errorId}>
            {t(error.key, error.params)}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {t(field.labelKey)}
        {field.required !== true && <span className="field__optional"> ({t('form.optional')})</span>}
      </label>

      {/* The rule sits next to the field, never in a separate help page. */}
      {field.hintKey !== undefined && (
        <p className="field__hint" id={hintId}>
          {t(field.hintKey)}
        </p>
      )}

      {field.type === 'country' && (
        <select {...shared} value={String(value)} onChange={(e) => change(e.target.value)}>
          <option value="">{t('form.choose')}</option>
          {/* The region first, because nine members in ten pick one of these. */}
          <optgroup label={t('form.region')}>
            {countries.region.map((one) => (
              <option key={one.code} value={one.code}>
                {one.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('form.restOfWorld')}>
            {countries.rest.map((one) => (
              <option key={one.code} value={one.code}>
                {one.name}
              </option>
            ))}
          </optgroup>
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
          <option value="">{t('form.choose')}</option>
          {choices.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      )}

      {field.type === 'textarea' && (
        <>
          <textarea
            {...shared}
            /* Tall enough for what fits, and no taller. Ten is where a box
               stops being a box and becomes the screen: the page editor holds
               eight thousand characters, which at sixty to a line is a hundred
               and thirty-four rows. */
            rows={field.maxLength === undefined ? undefined : Math.min(10, Math.ceil(field.maxLength / 60))}
            value={String(value)}
            /* The limit is refused at the door rather than reported afterwards
               (owner, 01.08.2026). `maxLength` on the element does the refusing,
               so a paste that is too long is cut rather than accepted and then
               marked wrong. */
            maxLength={field.maxLength}
            /* What the browser is about to throw away, counted before it does.
               The room is what the limit leaves, plus whatever the paste is
               replacing: pasting over the whole box is not an overflow. */
            onPaste={(event) => {
              const box = event.currentTarget
              const replacing = box.selectionEnd - box.selectionStart
              /* No limit is unbounded room, which is what `Infinity` says.
                 Absence has a meaning here rather than standing in for a value
                 nobody worked out, which is the case a fallback is for (ADL A14,
                 rule 2). Every textarea the portal has does carry a limit and
                 `definitions.test.ts` keeps it that way, but the renderer is
                 handed a definition and is in no position to insist. */
              const limit = field.maxLength ?? Infinity
              /* Never below nought. A record can be longer than the limit that
                 was put on the field after it was written, and a negative room
                 would report the whole of that overrun as something this paste
                 lost. */
              const room = Math.max(0, limit - String(value).length + replacing)
              /* Line endings as the box will hold them. The clipboard carries
                 CR LF on Windows and a textarea keeps LF, so counting the
                 clipboard as it comes charges the writer one character per line
                 for something the box never had. */
              const brought = event.clipboardData.getData('text').replace(/\r\n/g, '\n').length

              fromPaste.current = brought > 0 && room > 0
              setDropped(Math.max(0, brought - room))
            }}
            onChange={(e) => change(e.target.value)}
          />
          {field.maxLength !== undefined && (
            /* How much room is left, counted down.
             *
             * Not a live region. It was one, politely, and polite only means the
             * reader waits its turn: the text changes on every keystroke, so the
             * queue filled with three hundred and fifty-nine announcements of a
             * number nobody was waiting to hear, and each one had to be got
             * through before anything else could be said. What a writer needs is
             * the count when they arrive at the field and a word when the box
             * will take no more, and those are two different things.
             *
             * The count on arrival is `aria-describedby` above. The word at the
             * wall is the region below, which is empty until the box is full and
             * therefore says something at most once. */
            <>
              <p className="field__left" id={leftId}>
                {String(value).length >= field.maxLength
                  ? t('registration.bioFull', { count: field.maxLength })
                  : t('registration.bioLeft', { count: field.maxLength - String(value).length })}
              </p>

              {/* What the last paste lost. Said in full, in its own words, and
                  not left to be worked out from a counter that has gone to zero.
               *
                  The one thing here worth interrupting a writer for, and it is
                  announced by being the sentence itself rather than by a second
                  copy hidden beside it: two copies are read twice by anybody
                  going through the page rather than tabbing. It exists only while
                  there is something to say, so it says it once.
               *
                  The counter above has no region of its own on purpose. That a
                  box is full is on the screen, is in `aria-describedby` on the
                  way in, and is felt at the keyboard the moment nothing more
                  appears. Losing text that was already written is not any of
                  those, which is why this one speaks. */}
              {dropped > 0 && (
                <p className="field__dropped" role="status">
                  {t('form.pasteCut', { count: dropped })}
                </p>
              )}
            </>
          )}
        </>
      )}

      {field.type === 'date' && (
        <DatePicker
          id={inputId}
          name={field.name}
          value={String(value)}
          invalid={error !== undefined}
          describedBy={describedBy === '' ? undefined : describedBy}
          onChange={change}
        />
      )}

      {(field.type === 'text' ||
        field.type === 'email' ||
        field.type === 'password' ||
        field.type === 'tel' ||
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
  const handleChange = useCallback((field: FieldDef, next: string | boolean) => {
    setValues((current) => ({ ...current, [field.name]: next }))
    // The message goes away as soon as the field is touched. Leaving it up
    // tells a screen reader the field is still wrong after it was fixed.
    setErrors(({ [field.name]: _fixed, ...rest }) => rest)
  }, [])

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

      {drawn.map(({ field, value }) => (
        <Field
          key={field.name}
          field={field}
          value={value}
          error={errors[field.name]}
          choices={optionsFor(field, options)}
          onChange={handleChange}
        />
      ))}

      {/* What the record carries without being asked: shown, so nobody wonders
          where it went, and read only, so it cannot contradict what it is read
          off. It says where it comes from, or a value nobody can change reads
          as a fault rather than as a rule. */}
      {(derived?.(values) ?? []).map((one) => (
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
