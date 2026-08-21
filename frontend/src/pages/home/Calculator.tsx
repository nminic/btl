import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { btlPoints } from '../../data/scoring'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'

/* The six boxes, as one record rather than six separate pieces of state.
 * Emptying them is then a question about the record itself and not a list that
 * has to be kept in step with it by hand: a seventh box is emptied by Reset the
 * moment it is added here, without Reset being touched. */
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

/**
 * Whether a box has anything in it, which is not the same question as what it is
 * worth.
 *
 * A box of type number answers with an **empty value** for writing it refuses to
 * read as a number: a lone minus sign, `1e`, `1-2`. The characters stand in the
 * box where anybody can see them, and the value is the empty string.
 * `validity.badInput` is the browser saying so out loud, and it is the whole of
 * the difference rather than one case among several.
 */
function anythingIn(box: HTMLInputElement): boolean {
  return box.value !== '' || box.validity.badInput
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
  /* Whether there is writing in any of the boxes. A separate question from what
     they are worth, with a separate answer, and the effect below says why. */
  const [written, setWritten] = useState(false)
  const widget = useRef<HTMLElement>(null)
  const first = useRef<HTMLInputElement>(null)

  const points = btlPoints(
    Number(values.length || 0),
    Number(values.ascent || 0),
    Number(values.descent || 0),
    onCourse(values),
  )

  /* Asked of the boxes themselves and not only of React, and there is one reason
     for it: React calls `onChange` only when the value it last wrote has
     changed, and a number box answers with the same empty value for a lone minus
     sign as for nothing at all. Measured in Chrome on 21.08.2026: the browser
     fires `input`, React swallows it, and the widget never learned there was
     writing in the box, so Reset stood refused over characters the reader could
     see. A listener of our own is not swallowed.

     It asks one question of the whole widget rather than of a box, so it has
     nothing to know about which box fired, or how many of them there are. */
  useEffect(() => {
    /* At most one node, walked rather than tested for null: a ref is set by the
       time an effect runs, and an unreachable branch is a claim nothing checks
       (`Rulebook.tsx` keeps the same rule). */
    const widgets = [widget.current].filter((node): node is HTMLElement => node !== null)

    const look = () => {
      widgets.forEach((node) => setWritten([...node.querySelectorAll('input')].some(anythingIn)))
    }

    widgets.forEach((node) => node.addEventListener('input', look))

    return () => widgets.forEach((node) => node.removeEventListener('input', look))
  }, [])

  const write = (field: keyof Values) => (event: ChangeEvent<HTMLInputElement>) => {
    const typed = event.target.value

    setValues((current) => ({ ...current, [field]: typed }))
  }

  /* Empties the six boxes and puts the cursor back in the first of them (owner,
     21.08.2026), so the next race can be typed straight away rather than after
     a trip back up the widget with the mouse. */
  const reset = () => {
    /* There is nothing to empty, and the button says so. It keeps its place in
       the order of focus rather than leaving it, the way every refused control
       on the portal does (Pager.tsx, Home.css), so the guard is here and not on
       the browser. */
    if (!written) {
      return
    }

    setValues(NOTHING)
    setWritten(false)

    /* And the boxes themselves, which state alone does not reach. A box holding
       writing the browser will not read as a number already reports its value as
       empty, so emptying the state changes nothing React can see and it leaves
       the box alone: the minus sign somebody typed went on sitting there under
       an emptied widget, and the button, refused by then, could not be pressed
       again to shift it. Measured in Chrome, and not reproducible in jsdom,
       which does not sanitise the value of a number box.

       Written over every box inside the widget rather than over a list of six,
       so the seventh is emptied the day it is added. */
    widget.current?.querySelectorAll('input').forEach((box) => {
      box.value = ''
    })

    first.current?.focus()
  }

  return (
    <section className="card" aria-labelledby="calculator-heading" ref={widget}>
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
          aria-disabled={!written}
          onClick={reset}
        >
          {t('home.calcReset')}
        </button>
      </div>
    </section>
  )
}
