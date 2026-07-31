import { useState } from 'react'
import { useToday } from '../clock/useClock'
import registracija from '../forms/definitions/registracija.form.json'
import { FormRenderer } from '../forms/FormRenderer'
import type { FormDef, FormValues } from '../forms/types'
import { REGISTRATION_OPENS, daysBetween, registrationOpen } from '../data/pricing'
import { formatDate } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'

/* The form itself is the JSON definition; this screen only decides what
 * happens with the values. Until the backend exists, it shows what was
 * captured, which is what makes the flow reviewable. */
export function Registration() {
  const { locale, t } = useI18n()
  const [sent, setSent] = useState<FormValues | null>(null)
  /* Which side of 1 October the portal is on, from the one clock the whole
     portal reads (src/clock). It used to be a prop with the machine's date
     behind it, which meant this screen could be shown one day and the price
     beside it another. */
  const today = useToday()

  // Between 15 and 30 September the portal is open for looking only: nobody can
  // even begin to register, which is a decision and not a missing screen.
  if (!registrationOpen(today)) {
    return (
      <div className="registration-closed">
        <h1>{t('registration.closed')}</h1>
        <p>{t('registration.closedText')}</p>
        <p>
          {t('registration.opensOn', { date: formatDate(REGISTRATION_OPENS, locale) })}{' '}
          {t('home.opensIn', { count: daysBetween(today, REGISTRATION_OPENS) })}
        </p>
      </div>
    )
  }

  if (sent !== null) {
    /* What happens next, and not what was typed.
     *
     * This used to print every field that had been submitted, under its own
     * name in the code and with no translation: `password` and `passwordRepeat`
     * among them, in plain sight, on the screen the owner shows first. It was a
     * tool for reviewing the form and it read like a debugger left switched on.
     *
     * PDL P22 says what belongs here instead: the address the letter went to,
     * that the letter is what activates the account, where to look if it does
     * not arrive, and a way to ask for another one. */
    return (
      <div className="registration-done" role="status">
        <h1>{t('registration.doneTitle')}</h1>
        <p>{t('registration.doneText', { email: String(sent.email) })}</p>
        <p>{t('registration.checkSpam')}</p>
        <button type="button" className="button button--secondary" onClick={() => setSent(null)}>
          {t('registration.resend')}
        </button>
      </div>
    )
  }

  return <FormRenderer form={registracija as FormDef} onSubmit={setSent} />
}
