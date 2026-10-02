import { useLayoutEffect, useRef, useState } from 'react'
import { fromBoxes } from '../../forms/clock'
import { parseNumber } from '../../forms/numberField'
import { btlPoints } from '../../data/scoring'
import { formatPoints } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'

/* The six boxes, as one record rather than six separate pieces of state.
 * Emptying them is then a question about the record itself and not a list that
 * has to be kept in step with it by hand. */
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

/** Everything the widget holds: what is in the boxes, and whether anything is. */
type Held = { values: Values; written: boolean }

const EMPTY: Held = { values: NOTHING, written: false }

/**
 * Whether a box has anything in it, which is not the same question as what it is
 * worth: a lone minus sign, `1e` and `abc` are writing, and are not a number.
 *
 * ~~A box of type number answers with an **empty value** for writing it refuses
 * to read as a number, and `validity.badInput` was the browser saying so out
 * loud, so "has it a value" and "is anything written in it" were two questions
 * (ADL, 21.08.2026).~~ **[02.10.2026]** These are text boxes now, so the two are
 * one. The owner decided that a number box takes a comma as well as a dot
 * (`forms/numberField.ts`), which a box of type number does not do (measured, see
 * `boxFor` in `forms/FormRenderer.tsx`), and the empty value for writing it would
 * not read went with the type. The question stays a function of its own because
 * Reset and the whole of `heldBy` hang on the answer.
 */
function anythingIn(box: HTMLInputElement): boolean {
  return box.value !== ''
}

/**
 * Everything the widget holds, read off the boxes themselves.
 *
 * The boxes are the record and this is the copy, not the other way round. That
 * is not a preference, it is what keeps a listener of our own from fighting
 * React: a listener set beside a box React writes to is worse than the fault it
 * was fixing. Measured in Chrome on 21.08.2026: typing `62.07` left the box
 * **empty** and the answer unwritten, because the state it set flushed between
 * the two listeners and React redrew the box from the value it still believed,
 * wiping the character out from under the cursor.
 *
 * ~~The other reason was that React calls `onChange` only when the value it last
 * wrote has changed, and a box of type number answers with the same empty value
 * for a lone minus sign as for nothing at all.~~ **[02.10.2026]** That went with
 * the type (`anythingIn`). The arrangement is left as it was decided: the fault
 * above was measured on boxes of type number, and nothing has measured whether a
 * text box has it too, so it is neither claimed here nor ruled out.
 *
 * With no `value` on the box there is nothing for React to redraw and nothing to
 * fight over: the browser keeps the writing, one listener copies it here, and
 * Reset empties the boxes and this together.
 *
 * Read by name rather than by position, so a box moved on the screen is still
 * the box it was. The name is what the widget reads them by and nothing else, so
 * each box also says `autocomplete="off"`: a name is what a browser looks at when
 * it decides whether to offer a saved value, and there is nothing to remember
 * about the length of somebody's last race.
 */
function heldBy(widget: HTMLElement): Held {
  const boxes = [...widget.querySelectorAll('input')]
  const value = (field: keyof Values): string =>
    boxes.filter((box) => box.name === field).reduce((_, box) => box.value, '')

  return {
    values: {
      length: value('length'),
      ascent: value('ascent'),
      descent: value('descent'),
      hours: value('hours'),
      minutes: value('minutes'),
      seconds: value('seconds'),
    },
    written: boxes.some(anythingIn),
  }
}

/**
 * What is written in one box, as a number: nought where nothing is, and no number
 * at all where what is written is not one.
 *
 * The reader is `forms/numberField.ts`, which takes the comma and the dot alike
 * (owner, 02.10.2026: "Polje za broj prima i zarez i tacku", PDL, "Odluke iz
 * ciscenja nalaza"). Nothing here is sent anywhere, so the second half of that
 * sentence, "a portal salje tacku", has nothing to do in this widget.
 *
 * **Writing that is not a number is not nought, and that is the coordinator's
 * reading and not a decision of the owner's.** It is what `fromBoxes` already does
 * for the three boxes of the time (PR 463), carried to the other three: a box
 * holding `abc` leaves the widget with no answer, where reading it as nought
 * would answer a race the member did not write. `btlPoints` refuses a number that
 * is not one for the climb and the fall as well as for the length and the time.
 */
function readBox(text: string): number {
  return text.trim() === '' ? 0 : (parseNumber(text) ?? Number.NaN)
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
  const [{ values, written }, setHeld] = useState(EMPTY)
  const widget = useRef<HTMLElement>(null)
  const first = useRef<HTMLInputElement>(null)

  const points = btlPoints(
    readBox(values.length),
    readBox(values.ascent),
    readBox(values.descent),
    fromBoxes(values),
  )

  /* The one listener, and `heldBy` above says why it is a listener of ours rather
     than React's.
   *
     A layout effect and not an ordinary one, which is not a preference: a passive
     effect is scheduled rather than run, so between the commit that puts these
     boxes on the screen and the flush that attaches this listener there is a
     window in which the boxes exist and nothing is listening. Writing that lands
     in it is not lost from the box, where it stands where anybody can see it, but
     from the widget, which goes on saying it holds nothing: Reset stays refused
     over a box with a number in it.
   *
     It is narrow and it is not empty, and the reason is measured rather than
     assumed. The gate failed twice on this widget on 22.08.2026, on two different
     tests, both times on the first assertion after the first typing of that test,
     which is the shape this window makes. Instrumented on 23.08.2026 in the form
     `Home.test.tsx` has: with a passive effect the listener was not yet attached
     in one pass of fifteen, and with this one in none of ten.

     What is **not** a reason here, though it would be one elsewhere: a browser
     restoring a form on reload, or an autofill. Both write into a box and fire
     `input` of their own accord, and neither reaches these six: every one of them
     says `autoComplete="off"` for the reason written above, and they are built by
     React after the page has loaded, so a form restored from session history never
     sees them.
   *
     Measured in both directions, deterministically, in `calculatorEarly.test.tsx`:
     a probe mounted before this widget writes into a box from its own passive
     effect, which React runs before this component's would. With `useEffect` here
     that writing is missed; with the layout effect it is caught, because a layout
     effect runs inside the commit itself. */
  useLayoutEffect(() => {
    /* At most one node, walked rather than tested for null: a ref is set by the
       time an effect runs, and an unreachable branch is a claim nothing checks
       (`Rulebook.tsx` keeps the same rule). */
    const widgets = [widget.current].filter((node): node is HTMLElement => node !== null)

    const look = () => {
      widgets.forEach((node) => setHeld(heldBy(node)))
    }

    widgets.forEach((node) => node.addEventListener('input', look))

    return () => widgets.forEach((node) => node.removeEventListener('input', look))
  }, [])

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

    /* The boxes first, because the boxes are where the writing is. Written over
       every box inside the widget rather than over a list of six, so the seventh
       is emptied the day it is added. */
    widget.current?.querySelectorAll('input').forEach((box) => {
      box.value = ''
    })

    setHeld(EMPTY)
    first.current?.focus()
  }

  return (
    <section className="card" aria-labelledby="calculator-heading" ref={widget}>
      <h2 className="card__title" id="calculator-heading">
        {t('home.calculator')}
      </h2>

      {/* TEXT BOXES WITH A KEYBOARD FOR NUMBERS, and not `type="number"`, since
          02.10.2026. A box of type number does not take the comma Serbian writes a
          decimal with and reports what it refuses as an empty value, so „21,1" read
          as no length at all (`forms/FormRenderer.tsx`, `boxFor`, measured); the
          owner decided that day that a number box takes a comma as well as a dot.
          What each box takes is decided by `forms/numberField.ts`, read in
          `readBox` and in `fromBoxes`, and the keyboard by `inputMode`: without it
          the three boxes of the time would open the full keyboard on a telephone,
          which a box of type number never did.

          ~~`min`, `max` and `step`~~ went with the type. On a text box they announce
          nothing to anybody and constrain nothing, and here they never constrained
          anything either: a figure outside them was read all the same.

          WHO HOLDS THE BOXES IS UNCHANGED (ADL, 21.08.2026): no `value`, no
          `onChange`, one listener of the widget's own, and `autoComplete="off"`. */}
      <div className="calc calc--grid">
        <label className="calc__field">
          <span>{t('home.calcLength')}</span>
          <input
            ref={first}
            name="length"
            autoComplete="off"
            type="text"
            inputMode="decimal"
          />
        </label>
        <label className="calc__field">
          <span>{t('home.calcAscent')}</span>
          <input name="ascent" autoComplete="off" type="text" inputMode="numeric" />
        </label>
        <label className="calc__field">
          <span>{t('home.calcDescent')}</span>
          <input name="descent" autoComplete="off" type="text" inputMode="numeric" />
        </label>
      </div>

      <fieldset className="calc__time">
        <legend className="visually-hidden">{t('home.calcTime')}</legend>
        <label className="calc__field">
          <span>{t('home.hours')}</span>
          <input name="hours" autoComplete="off" type="text" inputMode="numeric" />
        </label>
        <label className="calc__field">
          <span>{t('home.minutes')}</span>
          <input name="minutes" autoComplete="off" type="text" inputMode="numeric" />
        </label>
        <label className="calc__field">
          <span>{t('home.seconds')}</span>
          <input name="seconds" autoComplete="off" type="text" inputMode="numeric" />
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
