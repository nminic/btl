import { useState } from 'react'
import registracija from '../forms/definitions/registracija.form.json'
import { FormRenderer } from '../forms/FormRenderer'
import type { FormDef, FormValues } from '../forms/types'
import { useI18n } from '../i18n/useI18n'

/* The form itself is the JSON definition; this screen only decides what
 * happens with the values. Until the backend exists, it shows what was
 * captured, which is what makes the flow reviewable. */
export function Registration() {
  const { t } = useI18n()
  const [sent, setSent] = useState<FormValues | null>(null)

  if (sent !== null) {
    return (
      <div className="registration-done" role="status">
        <h1>{t('registration.doneTitle')}</h1>
        <p>{t('registration.doneText')}</p>
        <dl>
          {Object.entries(sent).map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  return <FormRenderer form={registracija as FormDef} onSubmit={setSent} />
}
