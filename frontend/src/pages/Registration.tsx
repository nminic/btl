import { useState } from 'react'
import { useFilterParams } from '../app/useFilterParams'
import { useToday } from '../clock/useClock'
import { registracija } from '../forms/definitions'
import { FormRenderer } from '../forms/FormRenderer'
import type { FormValues } from '../forms/types'
import { REFERRAL_CODE, REGISTRATION_OPENS, daysBetween, registrationOpen } from '../data/pricing'
import { formatDayInSentence } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'

/* The form itself is the JSON definition; this screen only decides what happens
 * with the values: until the backend exists, it holds them long enough to say
 * where the letter of confirmation went. */
export function Registration() {
  const { locale, t } = useI18n()
  const [sent, setSent] = useState<FormValues | null>(null)
  const [resent, setResent] = useState(false)
  /* Which side of 1 October the portal is on, from the one clock the whole
     portal reads (src/clock). It used to be a prop with the machine's date
     behind it, which meant this screen could be shown one day and the price
     beside it another. */
  const today = useToday()
  const [params] = useFilterParams()
  /* A referral code and not whatever the address carried.
   *
   * `get` answers the empty string for `?preporuka=` with nothing after it, so a
   * link that lost its code while being copied still had somebody told „Prijava
   * je zabeležena kao preporuka" over a credit nobody could ever be paid, and
   * `referredBy: ''` went out, a third state the record's own type does not have.
   *
   * And anything at all fitted through: `?preporuka="><img src=x onerror=...>`
   * arrived in what is sent, word for word, sixty eight characters of it. React
   * draws none of it and nothing here puts it in an address, so it is not an
   * attack today; it becomes one the day a backend keeps it and an
   * administration screen writes out who brought whom. The shape is known and
   * costs one line, so it is checked at the door rather than migrated later. */
  const carried = params.get('preporuka') ?? ''
  const referral = REFERRAL_CODE.test(carried) ? carried : null

  // Between 15 and 30 September the portal is open for looking only: nobody can
  // even begin to register, which is a decision and not a missing screen.
  if (!registrationOpen(today)) {
    return (
      <div className="registration-closed">
        <h1>{t('registration.closed')}</h1>
        <p>{t('registration.closedText')}</p>
        <p>
          {t('registration.opensIn', {
            /* The day under a verb, so the genitive and not the nominative that
               `formatDate` gives: a screen said „Učlanjenje se otvara 1. oktobar 2026."
               to everybody between 15 and 30 September (ADL A35, review 05.09.2026). */
            date: formatDayInSentence(REGISTRATION_OPENS, locale),
            count: daysBetween(today, REGISTRATION_OPENS),
          })}
        </p>
      </div>
    )
  }

  if (sent !== null) {
    /* What happens next, and not what was typed.
     *
     * It used to print every field that had been submitted, under its own name
     * in the code and with no translation: `password` and `passwordRepeat`
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
        {/* Said only to somebody who arrived by a link, and it says both halves
            of the rule: the referral is recorded now, and it pays when this
            member's own fee is activated. Whoever brought them is not named,
            since the code is theirs and not this member's to be told. */}
        {sent.referredBy === undefined ? null : <p>{t('registration.doneReferral')}</p>}
        {/* Asking again says so and stays where it is. It used to empty `sent`,
            which unmounted this confirmation and handed back a blank form:
            nothing said the letter had gone out again, and everything typed was
            gone. A control has to do what it is called. */}
        {resent ? (
          <p className="registration-done__resent" role="status">
            {t('registration.resent')}
          </p>
        ) : (
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setResent(true)}
          >
            {t('registration.resend')}
          </button>
        )}
      </div>
    )
  }

  /* Who brought this member, taken off the link they arrived by and kept with
     what they send. The link was being written and never read: the address said
     `?preporuka=`, nothing looked, and the one fact the whole programme rests on
     was lost at the door. A member who registers this way is credited to
     whoever brought them, but not yet: the credit falls when this member's own
     membership is first activated (owner, 12.08.2026).

     Through `useFilterParams` because that is the only door to the address bar
     (app/useFilterParams.ts). Reading is all this does; nothing here writes. */
  return (
    <FormRenderer
      form={registracija}
      onSubmit={(values) => {
        setSent(referral === null ? values : { ...values, referredBy: referral })
      }}
    />
  )
}
