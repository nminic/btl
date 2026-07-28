import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { FieldDef, FieldError, FormDef, FormValues } from './types'
import { emptyValues, trimValues, validateForm } from './validate'
import './FormRenderer.css'

type Props = {
  form: FormDef
  onSubmit: (values: FormValues) => void
}

function Field({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldDef
  value: string | boolean
  error: FieldError | undefined
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

      {field.type === 'select' && (
        <select {...shared} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t('form.choose')}</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      )}

      {field.type === 'textarea' && (
        <textarea {...shared} value={String(value)} onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === 'checkbox' && (
        <input
          {...shared}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      )}

      {(field.type === 'text' ||
        field.type === 'email' ||
        field.type === 'date' ||
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

export function FormRenderer({ form, onSubmit }: Props) {
  const { t } = useI18n()
  const [values, setValues] = useState<FormValues>(() => emptyValues(form))
  const [errors, setErrors] = useState<Record<string, FieldError>>({})

  const broken = form.fields.filter((field) => errors[field.name] !== undefined)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validateForm(form, values)
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

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <h1 className="form__title">{t(form.titleKey)}</h1>

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

      {form.fields.map((field) => (
        <Field
          key={field.name}
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          onChange={(next) => handleChange(field, next)}
        />
      ))}

      <button type="submit" className="form__submit">
        {t(form.submitKey)}
      </button>
    </form>
  )
}
