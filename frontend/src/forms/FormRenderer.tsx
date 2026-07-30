import { useState, type FormEvent } from 'react'
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

function Field({
  field,
  value,
  error,
  choices,
  onChange,
}: {
  field: FieldDef
  value: string | boolean
  error: FieldError | undefined
  choices: FieldOption[]
  onChange: (value: string | boolean) => void
}) {
  const { t } = useI18n()
  const inputId = `field-${field.name}`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = [field.hintKey ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ')

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
            onChange={(e) => onChange(e.target.checked)}
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
        <select {...shared} value={String(value)} onChange={(e) => onChange(e.target.value)}>
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
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? '')}
        />
      )}

      {field.type === 'select' && (
        <select {...shared} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('form.choose')}</option>
          {choices.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      )}

      {field.type === 'textarea' && (
        <textarea {...shared} value={String(value)} onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === 'date' && (
        <DatePicker
          id={inputId}
          name={field.name}
          value={String(value)}
          invalid={error !== undefined}
          describedBy={describedBy === '' ? undefined : describedBy}
          onChange={onChange}
        />
      )}

      {field.type === 'time' && (
        <input {...shared} type="time" value={String(value)} onChange={(e) => onChange(e.target.value)} />
      )}

      {(field.type === 'text' ||
        field.type === 'email' ||
        field.type === 'password' ||
        field.type === 'number') && (
        <input
          {...shared}
          type={field.type}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {error !== undefined && (
        <p className="field__error" id={errorId}>
          {t(error.key, error.params)}
        </p>
      )}
    </div>
  )
}

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
  const [errors, setErrors] = useState<Record<string, FieldError>>({})

  // A field that is not on screen is neither shown nor validated. The parent
  // signature appears the moment the date of birth says it is needed, which is
  // why visibility is derived from the values rather than from a blur event.
  const visible = form.fields.filter((field) => isVisible(field, values, new Date()))
  const broken = visible.filter((field) => errors[field.name] !== undefined)
  const titleId = `form-${form.id}-title`

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    /* The rules in the definition win over the handed in check: a field that is
       empty is empty before it is anything else. */
    const found = { ...check?.(values), ...validateForm(form, values) }
    setErrors(found)

    if (Object.keys(found).length === 0) {
      onSubmit(trimValues(values))
    }
  }

  function handleChange(field: FieldDef, next: string | boolean) {
    setValues((current) => ({ ...current, [field.name]: next }))
    // The message goes away as soon as the field is touched. Leaving it up
    // tells a screen reader the field is still wrong after it was fixed.
    setErrors(({ [field.name]: _fixed, ...rest }) => rest)
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

      {visible.map((field) => (
        <Field
          key={field.name}
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          choices={optionsFor(field, options)}
          onChange={(next) => handleChange(field, next)}
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
