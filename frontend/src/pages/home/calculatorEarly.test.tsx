import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { ClockProvider } from '../../clock/ClockProvider'
import { I18nProvider } from '../../i18n/I18nProvider'
import { inputElement, must } from '../../test/at'
import { Calculator } from './Calculator'

/**
 * Writing that arrives before the widget's own effect would have run.
 *
 * The calculator does not read its boxes through React. They carry no `value`,
 * the browser keeps what is typed, and one listener of the widget's own copies it
 * into the component (Calculator.tsx says why at length). That listener is
 * attached from an effect, and an effect is the question this file asks: **which
 * kind**.
 *
 * A passive effect is scheduled, not immediate. Between the commit that puts the
 * boxes on the screen and the flush that attaches the listener there is a window
 * in which the boxes exist and nothing is listening, and writing that lands in
 * that window is not lost from the box, where it stands where anybody can see
 * it, but from the widget, which goes on saying it holds nothing. Reset stays
 * refused and the answer stays unwritten over a box with a number in it.
 *
 * The window is narrow and it is real. Twice in one day, on 22.08.2026, the gate
 * failed on this widget on two different tests, and both times it was the first
 * assertion after the first typing of that test, which is the shape this window
 * makes. Instrumented on 23.08.2026 in the form `Home.test.tsx` has: with a
 * passive effect the listener was not yet attached in one pass of fifteen; with a
 * layout effect, in none of ten.
 *
 * An autofill and a form restored on reload would open the same window elsewhere,
 * and they do not open it here: these six boxes say `autoComplete="off"`, and
 * React builds them after the page has loaded.
 *
 * A layout effect closes it: it runs inside the commit, before the browser
 * paints and before any passive effect anywhere in the tree.
 *
 * ## How that is measured rather than argued
 *
 * The probe below is mounted **before** the calculator, and it writes into the
 * box from its own passive effect. React runs passive effects in mounting order,
 * so the probe's runs before the calculator's would. That is the window, opened
 * on purpose and closed on the clock rather than on a delay:
 *
 * - with the listener attached from `useEffect`, the writing arrives first and is
 *   missed, and Reset stays refused;
 * - with it attached from `useLayoutEffect`, the listener is already there when
 *   the probe writes, and Reset comes alive.
 *
 * Measured both ways on 23.08.2026.
 */
function TypedAtOnce({ into, said }: { into: string; said: string }) {
  useEffect(() => {
    /* The whole tree is committed before any passive effect runs, so the box is
       on the screen by now whatever the calculator has done about listening. */
    const box = inputElement(
      must(document.querySelector(`input[name="${into}"]`), `the box named ${into}`),
    )

    box.value = said
    box.dispatchEvent(new Event('input', { bubbles: true }))
  }, [into, said])

  return null
}

describe('the calculator and writing that arrives early', () => {
  it('counts what was written before its own passive effect would have run', () => {
    render(
      <ClockProvider>
        <I18nProvider locale="sr">
          <TypedAtOnce into="length" said="5" />
          <Calculator />
        </I18nProvider>
      </ClockProvider>,
    )

    expect(
      screen.getByRole('button', { name: 'Reset' }),
      'the widget did not notice writing that arrived before its own effect',
    ).toHaveAttribute('aria-disabled', 'false')
  })
})
