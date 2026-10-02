import { fireEvent, render, screen, within } from '@testing-library/react'
import { ClockProvider } from '../../clock/ClockProvider'
import { btlPoints } from '../../data/scoring'
import { formatPoints } from '../../i18n/format'
import { I18nProvider } from '../../i18n/I18nProvider'
import sr from '../../i18n/sr.json'
import { inputElement, must } from '../../test/at'
import { Calculator } from './Calculator'

/**
 * THE SIX BOXES OF THE CALCULATOR, AND HOW EACH ONE READS WHAT IS WRITTEN IN IT.
 *
 * <p>Owner, 02.10.2026 (`btl-produkt/PDL.md`, „Odluke iz ciscenja nalaza"): „Polje za broj prima
 * i zarez i tacku, a portal salje tacku." The calculator sends nothing to a server, so only the
 * first half of that has anything to hold here, and it is held on every one of the six boxes
 * rather than on the length that the owner's example names.
 *
 * <p>**What the boxes were, and what that decided.** Six `type="number"` boxes. In a browser
 * that is not set to Serbian such a box refuses the comma and reports what it refuses as an empty
 * value, so „21,1" read as no length at all. `forms/numberField.ts` (PR 463) is the reader every
 * other number box on the portal reads through, so these six are text boxes with a keyboard for
 * numbers and read through the same one. What stays is what `ADL.md` decided on 21.08.2026 and
 * 23.08.2026 about WHO HOLDS the boxes: React holds none of them (`Home.test.tsx`), the listener is
 * attached from a layout effect (`calculatorEarly.test.tsx`), and each says `autoComplete="off"`.
 * What went is the premise of the first of those, a box that reports an empty value for writing it
 * will not read (`validity.badInput`): a text box says what is in it.
 *
 * <p>**One race, chosen so that every box moves the answer at two decimals** when a fraction is
 * added to it. Measured before it was written down: with a race of 62,07 km, 7:28:31, a half
 * second in the seconds box leaves „79,03" exactly as it was, and a case built on it cannot tell a
 * reader that cuts at the comma from one that does not. This one is 10 km, 2.000 m up and down, 50
 * minutes, and every fraction below changes the figure it is written next to.
 */
type Box = 'length' | 'ascent' | 'descent' | 'hours' | 'minutes' | 'seconds'

const RACE: Record<Box, number> = {
  length: 10,
  ascent: 2000,
  descent: 2000,
  hours: 0,
  minutes: 50,
  seconds: 0,
}

/** The keyboard each box offers a telephone: decimals for the length, digits for the rest, which is
 *  what each had before the boxes became text (`inputMode`), and for the three of the time what a
 *  number box gave without being asked. */
const KEYBOARD: Record<Box, string> = {
  length: 'decimal',
  ascent: 'numeric',
  descent: 'numeric',
  hours: 'numeric',
  minutes: 'numeric',
  seconds: 'numeric',
}

/** A fraction in each box, written both ways round, and the number it is. The numbers are written
 *  out and not read by the reader under test, so „the comma is read as a decimal point" is a claim
 *  about the box and not about the reader agreeing with itself. */
const FRACTION: Record<Box, { comma: string; dot: string; number: number }> = {
  length: { comma: '10,9', dot: '10.9', number: 10.9 },
  ascent: { comma: '2000,9', dot: '2000.9', number: 2000.9 },
  descent: { comma: '2000,9', dot: '2000.9', number: 2000.9 },
  hours: { comma: '0,5', dot: '0.5', number: 0.5 },
  minutes: { comma: '50,9', dot: '50.9', number: 50.9 },
  seconds: { comma: '0,9', dot: '0.9', number: 0.9 },
}

/** Writing that is not a number, every kind of it a browser's number box would have emptied. */
const NOT_A_NUMBER = ['abc', '1e', '-', '1,2,3', '+5']

/** Every box a table above has to have a row for, which the compiler holds (`Record<Box, …>`), and
 *  which the first case holds to the DOM from the other side: the names the widget really has. */
const BOXES: Box[] = ['length', 'ascent', 'descent', 'hours', 'minutes', 'seconds']

function mount(): HTMLElement {
  render(
    <ClockProvider>
      <I18nProvider locale="sr">
        <Calculator />
      </I18nProvider>
    </ClockProvider>,
  )

  return screen.getByRole('region', { name: sr.home.calculator })
}

/** The boxes by the name the widget reads them by, found as boxes somebody types into. */
function boxesOf(calc: HTMLElement): Record<string, HTMLInputElement> {
  return Object.fromEntries(
    within(calc)
      .getAllByRole('textbox')
      .map((one) => [inputElement(one).name, inputElement(one)]),
  )
}

/** What is written into one box, the way the browser tells the widget: the value, then `input`. */
function write(calc: HTMLElement, name: Box, text: string): void {
  fireEvent.input(must(boxesOf(calc)[name], `the box named ${name}`), { target: { value: text } })
}

function writeRace(calc: HTMLElement, race: Record<Box, number>): void {
  for (const name of BOXES) {
    write(calc, name, String(race[name]))
  }
}

/** The figure the widget writes for a race, worked out from the numbers and not from the boxes. */
function figureFor(race: Record<Box, number>): string {
  const points = must(
    btlPoints(
      race.length,
      race.ascent,
      race.descent,
      race.hours * 3600 + race.minutes * 60 + race.seconds,
    ),
    'a score for the race',
  )

  return formatPoints(points, 'sr')
}

/** The whole of a text and nothing less: „4,10" is also found inside „14,10", and a figure that
 *  was off by a digit in front would pass a search for the one it was meant to be. */
function exactly(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

function expectFigure(calc: HTMLElement, figure: string): void {
  expect(within(calc).getByRole('status')).toHaveTextContent(
    exactly(`${sr.home.calcResult} ${figure}`),
  )
}

function expectWaiting(calc: HTMLElement, what: string): void {
  const status = within(calc).getByRole('status')

  expect(status, what).toHaveTextContent(exactly(`${sr.home.calcResult} ${sr.home.calcWaiting}`))
  /* Never the word for a number that is not one, whichever way it was about to be printed. */
  expect(status, what).not.toHaveTextContent('NaN')
}

describe('the boxes of the calculator', () => {
  it('are text boxes with a keyboard for numbers, and every input in the widget is one of them', () => {
    const calc = mount()
    const boxes = within(calc).getAllByRole('textbox').map(inputElement)

    /* **The floor under the list below is the DOM itself**: every input in the widget is one of
       these, so a seventh box of any other kind makes the two counts differ, and the names must be
       exactly the six the race above is written for. */
    expect(boxes.length).toBe(calc.getElementsByTagName('input').length)
    expect(boxes.map((box) => box.name).sort()).toEqual([...BOXES].sort())

    for (const box of boxes) {
      const name = must(
        BOXES.find((one) => one === box.name),
        `a box this file knows by the name ${box.name}`,
      )

      expect(box.type, `the type of ${name}`).toBe('text')
      expect(box.getAttribute('inputmode'), `the keyboard of ${name}`).toBe(KEYBOARD[name])
      /* ADL A25, 23.08.2026: a name is what a browser looks at when it decides whether to offer a
         saved value, and there is nothing to remember about the length of somebody's last race. */
      expect(box.getAttribute('autocomplete'), `autocomplete of ${box.name}`).toBe('off')
    }
  })

  it.each(BOXES)('read a comma and a dot alike in the %s box, and neither is cut short', (name) => {
    const calc = mount()
    const fraction = FRACTION[name]
    const withIt = { ...RACE, [name]: fraction.number }

    writeRace(calc, RACE)
    expectFigure(calc, figureFor(RACE))

    /* The case can tell: a fraction in this box moves the figure, so a reader that cut the writing at
       the comma would land on the figure of the race without it and fail one of the two below. */
    expect(figureFor(withIt), `a fraction in ${name} changes nothing at two decimals`).not.toBe(
      figureFor(RACE),
    )

    write(calc, name, fraction.comma)
    expectFigure(calc, figureFor(withIt))

    write(calc, name, fraction.dot)
    expectFigure(calc, figureFor(withIt))
  })

  it.each(BOXES)('give no answer while the %s box holds writing that is not a number', (name) => {
    const calc = mount()

    writeRace(calc, RACE)
    expectFigure(calc, figureFor(RACE))

    for (const text of NOT_A_NUMBER) {
      write(calc, name, text)
      expectWaiting(calc, `${name} holding ${JSON.stringify(text)}`)

      /* And it comes back when the box does, so „no answer" was about the box and not a state the
         widget could not leave. */
      write(calc, name, String(RACE[name]))
      expectFigure(calc, figureFor(RACE))
    }
  })

  it('answer a race with nothing written for the climb and the fall', () => {
    /* An empty box is nought, as it always was: a flat race has none to write. */
    const calc = mount()

    write(calc, 'length', '10')
    write(calc, 'minutes', '50')

    expectFigure(calc, figureFor({ ...RACE, ascent: 0, descent: 0, hours: 0, seconds: 0 }))
  })
})
