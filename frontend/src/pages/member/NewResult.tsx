import { useNavigate } from 'react-router'
import { FormRenderer } from '../../forms/FormRenderer'
import unosRezultata from '../../forms/definitions/unos-rezultata.form.json'
import type { FormDef, FormValues } from '../../forms/types'
import { parseDate } from '../../forms/dateField'
import { categoryOf } from '../../data/raceCategory'
import { btlPoints } from '../../data/scoring'
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
  const navigate = useNavigate()
  const { memberNumber, submit } = useSession()

  if (memberNumber === null) {
    return <SignedOut />
  }

  function onSubmit(values: FormValues) {
    const distanceKm = Number(values.distanceKm)
    const ascentM = Number(values.ascentM)
    const descentM = Number(values.descentM)
    const total = seconds(values)
    const date = parseDate(String(values.date))

    submit({
      memberNumber: memberNumber as string,
      eventName: String(values.eventName),
      // The form refuses to submit without a real date, so this is never null.
      date: (date as Date).toISOString().slice(0, 10),
      distanceKm,
      ascentM,
      descentM,
      seconds: total,
      points: btlPoints(distanceKm, ascentM, descentM, total) ?? 0,
      category: categoryOf(distanceKm),
      link: String(values.link),
    })

    navigate(`/${locale}/moji-rezultati`)
  }

  return (
    <div className="member">
      <p className="member__note">{t('newResult.note')}</p>
      <FormRenderer form={unosRezultata as FormDef} onSubmit={onSubmit} />
    </div>
  )
}
