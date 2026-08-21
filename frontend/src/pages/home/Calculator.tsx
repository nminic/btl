import { useRef, useState, type ChangeEvent } from 'react'
import { btlPoints } from '../../data/scoring'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'

/* The six boxes, as one record rather than six separate pieces of state.
 * Emptying them and asking whether any of them has been filled in are then
 * questions about the record itself, and not two lists that have to be kept in
 * step with it by hand: a seventh box would be cleared by Reset and counted by
 * the button the moment it is added here, without either being touched. */
type Values = {
  length: string
  ascent: string
  descent: string
  hours: string
  minutes: string
  seconds: string
}

const NOTHING: Values = {
  length: '',
  ascent: '',
  descent: '',
  hours: '',
  minutes: '',
  seconds: '',
}

function onCourse({ hours, minutes, seconds }: Values): number {
  return Number(hours || 0) * 3600 + Number(minutes || 0) * 60 + Number(seconds || 0)
}

/* The calculator is the same one the old portal had, and it is mostly a toy.
 * It is also the only explanation of the scoring there is: the formula is public
 * and the rulebook does not set it out, so this is where somebody sees how it
 * behaves on their own result (PDL P11). It answers and nothing else: it does not
 * compare the result to anything, it has no reverse direction, and it does not
 * offer a race from the calendar as a starting point.
 *
 * It is also why "the formula is not published" was never a sentence the portal
 * could say: it has been computing it in the browser since the day it arrived.
 */
export function Calculator() {
  const { locale, t } = useI18n()
  const [values, setValues] = useState(NOTHING)
  const first = useRef<HTMLInputElement>(null)

  const points = btlPoints(
    Number(values.length || 0),
    Number(values.ascent || 0),
    Number(values.descent || 0),
    onCourse(values),
  )

  const untouched = Object.values(values).every((value) => value === '')

  const write = (field: keyof Values) => (event: ChangeEvent<HTMLInputElement>) => {
    const written = event.target.value

    setValues((current) => ({ ...current, [field]: written }))
  }

  /* Empties the six boxes and puts the cursor back in the first of them (owner,
     21.08.2026), so the next race can be typed straight away rather than after
     a trip back up the widget with the mouse. */
  const reset = () => {
    /* There is nothing to empty, and the button says so. It keeps its place in
       the order of focus rather than leaving it, the way every refused control
       on the portal does (Pager.tsx, Home.css), so the guard is here and not on
       the browser. */
    if (untouched) {
      return
    }

    setValues(NOTHING)
    first.current?.focus()
  }

  return (
    <section className="card" aria-labelledby="calculator-heading">
      <h2 className="card__title" id="calculator-heading">
        {t('home.calculator')}
      </h2>

      <div className="calc calc--grid">
        <label className="calc__field">
          <span>{t('home.calcLength')}</span>
          <input
            ref={first}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={values.length}
            onChange={write('length')}
          />
        </label>
        <label className="calc__field">
          <span>{t('home.calcAscent')}</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={values.ascent}
            onChange={write('ascent')}
          />
        </label>
        <label className="calc__field">
          <span>{t('home.calcDescent')}</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={values.descent}
            onChange={write('descent')}
          />
        </label>
      </div>

      <fieldset className="calc__time">
        <legend className="visually-hidden">{t('home.calcTime')}</legend>
        <label className="calc__field">
          <span>{t('home.hours')}</span>
          <input type="number" min="0" value={values.hours} onChange={write('hours')} />
        </label>
        <label className="calc__field">
          <span>{t('home.minutes')}</span>
          <input
            type="number"
            min="0"
            max="59"
            value={values.minutes}
            onChange={write('minutes')}
          />
        </label>
        <label className="calc__field">
          <span>{t('home.seconds')}</span>
          <input
            type="number"
            min="0"
            max="59"
            value={values.seconds}
            onChange={write('seconds')}
          />
        </label>
      </fieldset>

      {/* The answer and the way back to an empty widget share the last row
          (owner, 21.08.2026). The button stands outside the live region beside
          it: everything inside that region is read out again every time the
          figure changes, and the word "Reset" has not changed and does not need
          saying twice. */}
      <div className="calc__answer">
        {/* The label stands there whether or not there is an answer yet (owner,
            31.07.2026), so the line does not appear and disappear as somebody
            types and the card does not change height under the cursor. The
            number is what arrives. */}
        <p className="calc__result" role="status">
          <span className="calc__label">{t('home.calcResult')}</span>{' '}
          {points === null ? (
            <span className="calc__waiting">{t('home.calcWaiting')}</span>
          ) : (
            <strong>{formatPoints(points, locale)}</strong>
          )}
        </p>

        <button
          type="button"
          className="button button--secondary button--compact calc__reset"
          aria-disabled={untouched}
          onClick={reset}
        >
          {t('home.calcReset')}
        </button>
      </div>
    </section>
  )
}
