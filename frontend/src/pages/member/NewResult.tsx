import { useState } from 'react'
import { useFilterParams } from '../../app/useFilterParams'
import { Link } from 'react-router'
import { FormRenderer } from '../../forms/FormRenderer'
import unosRezultata from '../../forms/definitions/unos-rezultata.form.json'
import type { FormDef, FormValues } from '../../forms/types'
import { fieldDate, parseDate } from '../../forms/dateField'
import { categoryOf } from '../../data/raceCategory'
import { btlPoints } from '../../data/scoring'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import type { Submission } from '../../session/context'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
import './Member.css'

/**
 * A refused result written back into the fields it was entered in.
 *
 * The other way round from `seconds` below: the form asks for hours, minutes and
 * seconds and the record keeps one number, and a member correcting a link is not
 * to be made to type the whole race again (owner, 06.08.2026).
 */
function filledFrom(one: Submission): FormValues {
  return {
    eventName: one.eventName,
    date: fieldDate(one.date),
    distanceKm: String(one.distanceKm),
    ascentM: String(one.ascentM),
    descentM: String(one.descentM),
    hours: String(Math.floor(one.seconds / 3600)),
    minutes: String(Math.floor((one.seconds % 3600) / 60)),
    seconds: String(one.seconds % 60),
    link: one.link,
    photo: one.photo,
  }
}

/** Hours, minutes and seconds are all required by the form definition, so
 *  there is nothing here to fall back to. */
function seconds(values: FormValues): number {
  return Number(values.hours) * 3600 + Number(values.minutes) * 60 + Number(values.seconds)
}

export function NewResult() {
  const { locale, t } = useI18n()
  const { memberNumber, submissions, submit, resubmit } = useSession()
  /**
   * What the last entry earned and whether it was a correction, once there has
   * been one.
   *
   * Both together, because the second cannot be worked out afterwards: sending a
   * correction puts the result back to waiting, so the refused result the
   * address named is no longer refused and the screen would say the ordinary
   * thing about it.
   */
  const [done, setDone] = useState<{ points: number; again: boolean } | null>(null)
  /**
   * The refused result this is a correction of, where the address names one.
   *
   * Carried in the address because a screen cannot be told anything else, the
   * same way the administration opens an event by address. Read against the
   * member signed in, so a number typed into the address bar opens nobody else's
   * result.
   */
  const [params] = useFilterParams()
  const again = params.get('ponovo')
  const correcting = submissions.find(
    (one) => one.id === again && one.memberNumber === memberNumber && one.status === 'rejected',
  )

  if (memberNumber === null) {
    return <SignedOut />
  }

  /** Who is signed in, held once. The check above narrows it and a function
   *  written below does not see that narrowing. */
  const me = memberNumber

  function onSubmit(values: FormValues) {
    const distanceKm = Number(values.distanceKm)
    const ascentM = Number(values.ascentM)
    const descentM = Number(values.descentM)
    const total = seconds(values)
    const date = parseDate(String(values.date))
    const earned = btlPoints(distanceKm, ascentM, descentM, total) ?? 0

    const sent = {
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
    }

    /* The same result again where one is being corrected, and a new one
       otherwise. Sending the correction as a new result would leave the refused
       one standing beside it: two rows for one race, and the moderator reading
       the same morning twice (owner, 06.08.2026). */
    if (correcting === undefined) {
      submit({ memberNumber: me, ...sent })
    } else {
      resubmit(correcting.id, sent)
    }

    /* Stays on a confirmation rather than jumping to the list (PDL P9: "Član
       odmah po unosu vidi koliko je bodova dobio"). The points were already
       being worked out here and then thrown away, so the one thing the member
       came to find out was the one thing the screen did not say. */
    setDone({ points: earned, again: correcting !== undefined })
  }

  if (done !== null) {
    return (
      <div className="member" role="status">
        <h1>{t('newResult.doneTitle')}</h1>
        <p>{t('newResult.donePoints', { points: formatPoints(done.points, locale) })}</p>
        <p>{done.again ? t('newResult.againDone') : t('newResult.doneWaiting')}</p>
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
      {correcting === undefined ? (
        <p className="member__note">{t('newResult.note')}</p>
      ) : (
        /* Why the form is full, and of what. A member who pressed "correct and
           send again" is looking at their own words back, and the reason they
           are looking at them is the sentence the moderator wrote. */
        <p className="member__note">{t('newResult.again', { reason: correcting.note })}</p>
      )}

      <FormRenderer
        form={unosRezultata as FormDef}
        initial={correcting === undefined ? undefined : filledFrom(correcting)}
        onSubmit={onSubmit}
      />
    </div>
  )
}
