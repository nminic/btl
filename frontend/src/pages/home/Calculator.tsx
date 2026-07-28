import { useState } from 'react'
import { btlPoints } from '../../data/scoring'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'

function seconds(hours: string, minutes: string, rest: string): number {
  return Number(hours || 0) * 3600 + Number(minutes || 0) * 60 + Number(rest || 0)
}

/* The calculator is the same one the old portal had, and it is mostly a toy.
 * It is also the only explanation of the scoring there is, since the formula
 * itself is not published. It answers and nothing else: it does not compare the
 * result to anything, it has no reverse direction, and it does not offer a race
 * from the calendar as a starting point.
 */
export function Calculator() {
  const { locale, t } = useI18n()
  const [length, setLength] = useState('')
  const [ascent, setAscent] = useState('')
  const [descent, setDescent] = useState('')
  const [hours, setHours] = useState('')
  const [minutes, setMinutes] = useState('')
  const [rest, setRest] = useState('')

  const points = btlPoints(
    Number(length || 0),
    Number(ascent || 0),
    Number(descent || 0),
    seconds(hours, minutes, rest),
  )

  return (
    <section className="card" aria-labelledby="calculator-heading">
      <h2 className="card__title" id="calculator-heading">
        {t('home.calculator')}
      </h2>

      <div className="calc">
        <label className="calc__field">
          <span>{t('home.calcLength')}</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
        </label>
        <label className="calc__field">
          <span>{t('home.calcAscent')}</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={ascent}
            onChange={(e) => setAscent(e.target.value)}
          />
        </label>
        <label className="calc__field">
          <span>{t('home.calcDescent')}</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={descent}
            onChange={(e) => setDescent(e.target.value)}
          />
        </label>
      </div>

      <fieldset className="calc__time">
        <legend>{t('home.calcTime')}</legend>
        <label className="calc__field">
          <span>{t('home.hours')}</span>
          <input type="number" min="0" value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="calc__field">
          <span>{t('home.minutes')}</span>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
        <label className="calc__field">
          <span>{t('home.seconds')}</span>
          <input
            type="number"
            min="0"
            max="59"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
          />
        </label>
      </fieldset>

      <p className="calc__result" role="status">
        {points === null ? (
          <span className="calc__waiting">{t('home.calcWaiting')}</span>
        ) : (
          <>
            <strong>{formatPoints(points, locale)}</strong> <span>BTL points</span>
          </>
        )}
      </p>
    </section>
  )
}
