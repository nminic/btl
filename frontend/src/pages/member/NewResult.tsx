import { useState } from 'react'
import { Link } from 'react-router'
import { FormRenderer } from '../../forms/FormRenderer'
import unosRezultata from '../../forms/definitions/unos-rezultata.form.json'
import type { FormDef, FormValues } from '../../forms/types'
import { parseDate } from '../../forms/dateField'
import { categoryOf } from '../../data/raceCategory'
import { btlPoints } from '../../data/scoring'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
import './Member.css'

/** Hours, minutes and seconds are all required by the form definition, so
 *  there is nothing here to fall back to. */
function seconds(values: FormValues): number {
  return Number(values.hours) * 3600 + Number(values.minutes) * 60 + Number(values.seconds)
}

export function NewResult() {
  const { locale, t } = useI18n()
  const { memberNumber, submit } = useSession()
  /** The points the last entry earned, once there has been one. */
  const [done, setDone] = useState<number | null>(null)

  if (memberNumber === null) {
    return <SignedOut />
  }

  function onSubmit(values: FormValues) {
    const distanceKm = Number(values.distanceKm)
    const ascentM = Number(values.ascentM)
    const descentM = Number(values.descentM)
    const total = seconds(values)
    const date = parseDate(String(values.date))
    const earned = btlPoints(distanceKm, ascentM, descentM, total) ?? 0

    submit({
      memberNumber: memberNumber as string,
      eventName: String(values.eventName),
      // The form refuses to submit without a real date, so this is never null.
      date: (date as Date).toISOString().slice(0, 10),
      distanceKm,
      ascentM,
      descentM,
      photo: String(values.photo),
      seconds: total,
      points: earned,
      category: categoryOf(distanceKm),
      link: String(values.link),
      comment: '',
    })

    /* Stays on a confirmation rather than jumping to the list (PDL P9: "Član
       odmah po unosu vidi koliko je bodova dobio"). The points were already
       being worked out here and then thrown away, so the one thing the member
       came to find out was the one thing the screen did not say. */
    setDone(earned)
  }

  if (done !== null) {
    return (
      <div className="member" role="status">
        <h1>{t('newResult.doneTitle')}</h1>
        <p>{t('newResult.donePoints', { points: formatPoints(done, locale) })}</p>
        <p>{t('newResult.doneWaiting')}</p>
        <p className="member__actions">
          <Link className="button button--primary" to={`/${locale}/moji-rezultati`}>
            {t('newResult.toMine')}
          </Link>{' '}
          <button
            type="button"
            className="button button--secondary"
            onClick={() => setDone(null)}
          >
            {t('newResult.another')}
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="member">
      <p className="member__note">{t('newResult.note')}</p>
      <FormRenderer form={unosRezultata as FormDef} onSubmit={onSubmit} />
    </div>
  )
}
